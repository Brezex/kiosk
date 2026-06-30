import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import init_db
from app.routers import auth, dashboards, panels, proxy, zabbix_servers, notifications, users

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")

# Переменные окружения
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-to-a-very-secret-key-min-32-chars")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:5173,http://localhost:8000").split(",")

# Путь к фронтенду
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация и завершение работы приложения"""
    logger.info("Starting Zabbix Kiosk...")
    
    # Создаём таблицы БД
    init_db()
    logger.info("Database initialized")
    
    # Запуск фоновых задач
    try:
        from app.background import start_background_poller, start_notification_checker
        start_background_poller()
        start_notification_checker()
        logger.info("Background tasks started")
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")
    
    yield
    
    logger.info("Shutting down Zabbix Kiosk...")


app = FastAPI(
    title="Zabbix Kiosk",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Health Check ============
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "frontend_dist_exists": FRONTEND_DIST.exists()
    }


# ============ API Routes ============
app.include_router(auth.router)
app.include_router(dashboards.router)
app.include_router(proxy.router)
app.include_router(panels.router)
app.include_router(zabbix_servers.router)
app.include_router(notifications.router)
app.include_router(users.router)


# ============ Kiosk Public Routes ============
@app.get("/api/kiosk/state")
async def kiosk_state():
    """Публичный endpoint для киоска - возвращает дашборды и уведомления"""
    from app.database import SessionLocal
    from app.models import Dashboard, ScheduledNotification
    
    db = SessionLocal()
    try:
        # Дашборды в ротации
        dashboards_list = db.query(Dashboard).filter(
            Dashboard.in_rotation == True
        ).order_by(Dashboard.sort_order).all()
        
        # Активные системные уведомления (проблемы Zabbix)
        # Здесь можно добавить логику получения проблем из Zabbix
        
        # Календарные уведомления
        now = datetime.utcnow()
        scheduled = db.query(ScheduledNotification).filter(
            ScheduledNotification.is_active == True,
            ScheduledNotification.scheduled_at <= now,
            ScheduledNotification.is_sent == False
        ).all()
        
        return {
            "dashboards": [
                {
                    "id": d.id,
                    "name": d.name,
                    "zabbix_server_id": d.zabbix_server_id,
                    "rotation_interval": d.rotation_interval,
                    "panels": [
                        {
                            "id": p.id,
                            "panel_type": p.panel_type,
                            "title": p.title,
                            "position": p.position,
                            "size": p.size,
                            "config": p.config if isinstance(p.config, dict) else __import__('json').loads(p.config) if p.config else {}
                        }
                        for p in d.panels
                    ]
                }
                for d in dashboards_list
            ],
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "scheduled_at": n.scheduled_at.isoformat(),
                    "notification_type": n.notification_type,
                    "is_sent": n.is_sent
                }
                for n in scheduled
            ],
            "zabbix_connected": True,
            "global_rotation_interval": 30
        }
    finally:
        db.close()


@app.get("/api/kiosk/dashboards")
async def kiosk_dashboards():
    """Публичный endpoint для получения дашбордов"""
    from app.database import SessionLocal
    from app.models import Dashboard
    
    db = SessionLocal()
    try:
        dashboards_list = db.query(Dashboard).filter(
            Dashboard.in_rotation == True
        ).order_by(Dashboard.sort_order).all()
        
        return [
            {
                "id": d.id,
                "name": d.name,
                "zabbix_server_id": d.zabbix_server_id,
                "panels": [
                    {
                        "id": p.id,
                        "panel_type": p.panel_type,
                        "title": p.title,
                        "config": p.config if isinstance(p.config, dict) else __import__('json').loads(p.config) if p.config else {}
                    }
                    for p in d.panels
                ]
            }
            for d in dashboards_list
        ]
    finally:
        db.close()


@app.get("/api/kiosk/notifications")
async def kiosk_notifications():
    """Публичный endpoint для получения календарных уведомлений"""
    from app.database import SessionLocal
    from app.models import ScheduledNotification
    
    db = SessionLocal()
    try:
        notifications_list = db.query(ScheduledNotification).filter(
            ScheduledNotification.is_active == True
        ).order_by(ScheduledNotification.scheduled_at).all()
        
        return [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "scheduled_at": n.scheduled_at.isoformat(),
                "notification_type": n.notification_type,
                "is_sent": n.is_sent
            }
            for n in notifications_list
        ]
    finally:
        db.close()


# ============ Раздача статики фронтенда ============
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").exists():
    logger.info(f"Serving frontend from {FRONTEND_DIST}")
    
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Раздача файлов фронтенда"""
        # Не перехватываем API запросы
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi"):
            return {"detail": "Not found"}
        
        file_path = FRONTEND_DIST / full_path
        
        # Если файл существует - отдаём его
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Иначе отдаём index.html (для SPA роутинга)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"detail": "Frontend not built"}
else:
    logger.warning(f"️ Frontend dist not found at {FRONTEND_DIST}, serving API only")


# ============ Запуск ============
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
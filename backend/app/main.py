import os
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import init_db, SessionLocal
from app.config import settings
from app.routers import auth, dashboards, panels, proxy, zabbix_servers, notifications, users, statistics, chat

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")

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

# CORS - используем settings из config.py вместо ручного парсинга
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Health Check ============
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "frontend_dist_exists": FRONTEND_DIST.exists()
    }


# ============ API Routes ============
app.include_router(auth.router)
app.include_router(panels.router)
app.include_router(dashboards.router)
app.include_router(proxy.router)
app.include_router(zabbix_servers.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(statistics.router)
app.include_router(chat.router)


# ============ Kiosk Public Routes ============
@app.get("/api/kiosk/state")
def kiosk_state():
    """Публичный endpoint для киоска - возвращает только общие дашборды"""
    from app.models import Dashboard, ScheduledNotification
    
    db = SessionLocal()
    try:
        # Только общие дашборды (user_id is NULL) в ротации
        # Используем selectinload для загрузки panels
        dashboards_list = db.query(Dashboard)\
            .filter(Dashboard.in_rotation == True, Dashboard.user_id == None)\
            .options(selectinload(Dashboard.panels))\
            .order_by(Dashboard.sort_order)\
            .all()
        
        # Календарные уведомления
        now = datetime.utcnow()
        scheduled = db.query(ScheduledNotification)\
            .filter(
                ScheduledNotification.is_active == True,
                ScheduledNotification.scheduled_at <= now,
                ScheduledNotification.is_sent == False
            )\
            .all()
        
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
                            "config": json.loads(p.config) if p.config else {}
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
def kiosk_dashboards():
    """Публичный endpoint для получения только общих дашбордов"""
    from app.models import Dashboard
    
    db = SessionLocal()
    try:
        # Только общие дашборды
        # Используем selectinload для загрузки panels
        dashboards_list = db.query(Dashboard)\
            .filter(Dashboard.in_rotation == True, Dashboard.user_id == None)\
            .options(selectinload(Dashboard.panels))\
            .order_by(Dashboard.sort_order)\
            .all()
        
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
                        "config": json.loads(p.config) if p.config else {}
                    }
                    for p in d.panels
                ]
            }
            for d in dashboards_list
        ]
    finally:
        db.close()


@app.get("/api/kiosk/notifications")
def kiosk_notifications():
    """Публичный endpoint для получения календарных уведомлений"""
    from app.models import ScheduledNotification
    
    db = SessionLocal()
    try:
        notifications_list = db.query(ScheduledNotification)\
            .filter(ScheduledNotification.is_active == True)\
            .order_by(ScheduledNotification.scheduled_at)\
            .all()
        
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
    
    # Монтируем статику
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
    
    # Корневой маршрут - отдаём index.html
    @app.get("/")
    async def serve_root():
        """Отдаёт index.html для корневого пути"""
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"detail": "Frontend not built"}
    
    # Все остальные пути - для SPA роутинга
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Раздача файлов фронтенда для SPA роутинга"""
        # Не перехватываем API запросы и docs
        if (full_path.startswith("api/") or 
            full_path.startswith("docs") or 
            full_path.startswith("openapi") or
            full_path.startswith("assets/")):
            return {"detail": "Not found"}
        
        # Пробуем найти файл
        file_path = FRONTEND_DIST / full_path
        
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Если файл не найден - отдаём index.html (для React Router)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"detail": "File not found"}
else:
    logger.warning("⚠️ Frontend dist not found at /frontend/dist, serving API only")


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
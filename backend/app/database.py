import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Автоматически создаём папку для SQLite базы
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    db_path_str = SQLALCHEMY_DATABASE_URL.split("///", 1)[-1]
    db_path = Path(db_path_str)
    if db_path.parent and not db_path.parent.exists():
        os.makedirs(db_path.parent, exist_ok=True)

# Для асинхронного движка конвертируем sqlite:/// в sqlite+aiosqlite:///
if SQLALCHEMY_DATABASE_URL.startswith("sqlite://"):
    SQLALCHEMY_ASYNC_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "sqlite://", "sqlite+aiosqlite://", 1
    )
else:
    SQLALCHEMY_ASYNC_DATABASE_URL = SQLALCHEMY_DATABASE_URL

# Синхронный движок
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

# Асинхронный движок
async_engine = create_async_engine(
    SQLALCHEMY_ASYNC_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_ASYNC_DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async_session = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def init_db():
    from app.models import User, Dashboard, Panel, ZabbixServer, ScheduledNotification
    Base.metadata.create_all(bind=engine)
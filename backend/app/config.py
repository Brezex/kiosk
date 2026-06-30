from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Пути
    BASE_DIR: Path = Path(__file__).parent.parent
    DB_PATH: Path = BASE_DIR / "zabbix_kiosk.db"
    
    # База данных
    DATABASE_URL: str = "sqlite:///./zabbix_kiosk.db"
    
    # Безопасность
    SECRET_KEY: str = "change-this-to-a-very-secret-key-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Шифрование токенов Zabbix
    ENCRYPTION_KEY: str = "change-this-encryption-key-32-chars!!"
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:8000",
    ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


settings = Settings()
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    # Пути
    BASE_DIR: Path = Path(__file__).parent.parent
    DB_PATH: Path = BASE_DIR / "zabbix_kiosk.db"
    
    # База данных
    DATABASE_URL: str = "sqlite:///./data/zabbix_kiosk.db"
    
    # Безопасность
    SECRET_KEY: str = "change-this-to-a-very-secret-key-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Шифрование токенов Zabbix
    ENCRYPTION_KEY: str = "change-this-encryption-key-32-chars!!"
    
    # Zabbix настройки
    ZABBIX_TIMEOUT: int = 30
    ZABBIX_RETRY_COUNT: int = 3
    ZABBIX_RETRY_DELAY: int = 5
    ZABBIX_CACHE_TTL: int = 300
    
    # CORS - принимаем как строку, парсим в список
    CORS_ORIGINS: str = "http://localhost,http://localhost:5173,http://localhost:8000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Парсинг CORS_ORIGINS в список."""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


settings = Settings()
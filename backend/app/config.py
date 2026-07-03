from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Пути
    BASE_DIR: Path = Path(__file__).parent.parent
    DB_PATH: Path = BASE_DIR / "zabbix_kiosk.db"
    
    # База данных
    DATABASE_URL: str = "sqlite:///./data/zabbix_kiosk.db"
    
    # Безопасность
    SECRET_KEY: str = "PXAwbRKJ2A_cucguTRBqDs8XD50uxKZACnzbULuoEF4"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Шифрование токенов Zabbix
    ENCRYPTION_KEY: str = "PXAwbRKJ2A_cucguTRBqDs8XD50uxKZACnzbULuoEF4"
    
    # Zabbix настройки
    ZABBIX_TIMEOUT: int = 30
    ZABBIX_RETRY_COUNT: int = 3
    ZABBIX_RETRY_DELAY: int = 5
    ZABBIX_CACHE_TTL: int = 300
    
    # CORS - принимаем как строку через запятую
    CORS_ORIGINS: str = "http://localhost,http://localhost:5173,http://localhost:8000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Парсинг CORS_ORIGINS в список с обработкой разных форматов."""
        origins_str = self.CORS_ORIGINS.strip()
        
        # Если это JSON-массив (из .env)
        if origins_str.startswith("[") and origins_str.endswith("]"):
            origins_str = origins_str[1:-1]
        
        # Разбиваем по запятой и очищаем от кавычек и пробелов
        return [
            origin.strip().strip('"').strip("'")
            for origin in origins_str.split(",")
            if origin.strip()
        ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


settings = Settings()
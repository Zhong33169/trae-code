from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR: Path = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    BACKEND_PORT: int = 8002
    FRONTEND_PORT: int = 3002
    DATABASE_URL: str = "sqlite:///./data/app.db"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    @property
    def DATABASE_PATH(self) -> Path:
        if self.DATABASE_URL.startswith("sqlite:///"):
            return BASE_DIR / self.DATABASE_URL.replace("sqlite:///", "")
        return BASE_DIR / "data" / "app.db"

    @property
    def backend_port(self) -> int:
        return self.BACKEND_PORT

    @property
    def frontend_port(self) -> int:
        return self.FRONTEND_PORT


def get_settings() -> Settings:
    return Settings()


settings = get_settings()

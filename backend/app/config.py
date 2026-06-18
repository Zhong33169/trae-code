import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8002"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/exhibitor.db")
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3002").split(",")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "demo-secret-key")
    TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))


settings = Settings()

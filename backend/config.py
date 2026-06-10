from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./repair_system.db"
    SECRET_KEY: str = "repair-system-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    BACKEND_PORT: int = 8001
    FRONTEND_PORT: int = 3001
    FRONTEND_URL: str = "http://localhost:3001"


settings = Settings()

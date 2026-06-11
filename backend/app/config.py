import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", "8002"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/zhong33169.db")
    APP_NAME: str = "银行网点-风险分级处置开户申请系统"
    API_PREFIX: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

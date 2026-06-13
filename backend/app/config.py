from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "社区健身房-会员入会单系统"
    backend_port: int = 8107
    frontend_url: str = "http://localhost:3107"
    database_url: str = "sqlite:///./gym_membership.db"

    class Config:
        env_file = ".env"


settings = Settings()

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "售电合同到期预警处理系统"
    backend_port: int = 8003
    frontend_origin: str = "http://localhost:3003"
    cors_origins: str = Field(default="http://localhost:3003,http://127.0.0.1:3003")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return ",".join(v)
        return str(v)

    def get_cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Spark IoT"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./spark_iot.db"
    valkey_url: str = "redis://valkey:6379/0"
    jwt_secret: str = Field(default="dev-change-me-please")
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    mqtt_host: str = "mosquitto"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_consumer_enabled: bool = True
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_subject: str = "mailto:admin@rectronx.local"
    starter_max_users: int = 1
    starter_max_devices: int = 3
    starter_max_projects: int = 3
    starter_max_widgets: int = 10
    starter_retention_days: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

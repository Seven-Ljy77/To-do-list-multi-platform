from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Todo API"
    database_url: str = (
        "postgresql+psycopg://todo_app:todo_app_dev_2026@127.0.0.1:5432/todo"
    )
    session_ttl_days: int = 90
    session_touch_interval_minutes: int = 60
    login_max_attempts: int = 5
    login_window_seconds: int = 60
    cors_origins: list[str] = [
        "http://tauri.localhost",
        "https://tauri.localhost",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ]


settings = Settings()

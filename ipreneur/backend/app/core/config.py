"""
Core application configuration using pydantic-settings.
All settings are read from environment variables / .env file.
"""
from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "iPreneur"
    app_env: str = "development"
    app_secret_key: str = "change_me"
    app_debug: bool = True
    app_port: int = 8000

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://ipreneur:ipreneur_dev@localhost:5432/ipreneur"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_cache_ttl: int = 3600

    # ── Auth ─────────────────────────────────────────────────────────────────
    jwt_secret_key: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # ── Google Gemini (primary — better quality) ─────────────────────────────
    # Supports both AQ. OAuth2 tokens (new format) and AIzaSy... API keys (legacy)
    gemini_api_key: str = ""
    gemini_api_key_2: str = ""
    gemini_model: str = ""
    gemini_model_research: str = "gemini-1.5-flash"
    gemini_max_tokens: int = 8192
    gemini_thinking_budget: int = 0

    # ── Groq AI (automatic fallback when Gemini is unavailable) ──────────────
    # Free tier: llama-3.3-70b-versatile, ~12K tokens/request, 30 RPM
    groq_api_key: str = ""

    # ── Storage ──────────────────────────────────────────────────────────────
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "ipreneur"
    s3_region: str = "us-east-1"
    cdn_base_url: str = "http://localhost:9000/ipreneur"

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # ── Celery ───────────────────────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── Monitoring ───────────────────────────────────────────────────────────
    sentry_dsn: Optional[str] = None
    log_level: str = "DEBUG"

    # ── Billing ──────────────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_enterprise_price_id: str = ""

    # ── Crawler ──────────────────────────────────────────────────────────────
    playwright_headless: bool = True
    crawl_timeout_ms: int = 30000
    crawl_max_pages: int = 18


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — call this everywhere."""
    return Settings()


# Export singleton
settings = get_settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str  # Required — no default, must be set in .env
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    fireworks_api_key: str = ""
    fireworks_base_url: str = "https://api.fireworks.ai/inference/v1"
    fireworks_model: str = "accounts/fireworks/models/qwen3-8b"
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"
    together_model: str = "Qwen/Qwen2.5-7B-Instruct-Turbo"
    ovh_api_key: str = "none"
    ovh_base_url: str = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"
    ovh_model: str = "Qwen3-32B"
    ollama_base_url: str = ""
    ollama_model: str = "qwen2.5:7b-instruct"
    qwen_api_url: str = ""
    qwen_api_key: str = ""
    crawl_rate_limit_ms: int = 1000
    crawl_user_agent: str = "CanadianAI/0.1 (toronto-services-research)"

    # Deploy webhook
    deploy_webhook_secret: str = ""

    # Admin
    admin_password: str = ""
    webhook_url: str = "http://127.0.0.1:9033"

    # Langfuse (optional, for tracing)
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_base_url: str = "https://us.cloud.langfuse.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

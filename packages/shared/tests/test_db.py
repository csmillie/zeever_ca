import pytest
from shared.config import Settings


def test_settings_requires_database_url():
    with pytest.raises(Exception):
        Settings(_env_file=None)


def test_settings_defaults():
    s = Settings(database_url="postgresql://test:test@localhost/test")
    assert s.database_url == "postgresql://test:test@localhost/test"
    assert s.crawl_rate_limit_ms == 1000


def test_settings_has_all_fields():
    s = Settings(database_url="postgresql://test:test@localhost/test")
    assert hasattr(s, 'anthropic_api_key')
    assert hasattr(s, 'openai_api_key')
    assert hasattr(s, 'qwen_api_url')
    assert hasattr(s, 'qwen_api_key')
    assert hasattr(s, 'crawl_user_agent')

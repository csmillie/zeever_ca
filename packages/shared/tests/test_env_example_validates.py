"""The .env.example in the repo must be a file you can actually use as .env.

Settings sets extra="forbid" on purpose, so a key it does not declare is not a
warning — it is a startup crash, before uvicorn binds the port, on every restart.

That happened on 2026-09-14. Three keys were added to .env for the Node and
Next.js halves of the system (DEPLOY_GITHUB_TOKEN, A2A_API_KEY, MCP_API_KEY),
none of which Python reads, and the API crash-looped 630 times with "Extra
inputs are not permitted" while the website served a maintenance page. Five more
such keys were already sitting in .env.example at the time, so anyone who
followed the documented setup would have hit the same wall.

Reading the file rather than listing expected keys is the point: a key added to
.env.example in future fails here, at review time, instead of on the box.
"""
import re
from pathlib import Path

import pytest

from shared.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_EXAMPLE = REPO_ROOT / ".env.example"


def example_keys() -> list[str]:
    if not ENV_EXAMPLE.exists():  # pragma: no cover - repo layout changed
        pytest.skip(f"{ENV_EXAMPLE} not found")
    return [
        m.group(1)
        for line in ENV_EXAMPLE.read_text().splitlines()
        if (m := re.match(r"^([A-Z][A-Z0-9_]*)=", line.strip()))
    ]


def test_env_example_is_not_empty():
    """Guards the test itself: a regex that stopped matching would otherwise
    make every assertion below vacuously true."""
    assert len(example_keys()) > 20


@pytest.mark.parametrize("key", example_keys())
def test_every_documented_key_is_declared(key):
    assert key.lower() in Settings.model_fields, (
        f"{key} is in .env.example but not declared on Settings. With "
        f'extra="forbid", an operator who copies .env.example to .env gets an '
        f"API that cannot start. Declare it, even if only the Node or Next.js "
        f"side reads it."
    )


def test_settings_accepts_the_example_file_verbatim():
    """The end-to-end version: load .env.example as if it were .env.

    Catches what the per-key check cannot — a declared key whose type rejects
    the value the example actually ships. Handing the file to pydantic-settings
    rather than reconstructing it from parsed pairs means the test exercises the
    same parser the API does, including how it treats quotes and comments.
    """
    Settings(_env_file=str(ENV_EXAMPLE))

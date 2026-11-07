"""Test-suite-wide setup.

Loaded by pytest before any test module is imported, which is the only point
early enough to matter here: `query_engine.api` configures Langfuse from
`settings` at import time, and importing it is the first thing several test
modules do.

## Why tracing is switched off

On 2026-09-19 a local `uv run pytest` wrote observations into the *production*
Langfuse project, because a developer `.env` carries real LANGFUSE_* keys and
most tests do not patch the client. The traces are identifiable -- they record
`model="test-model"`, the mock from `test_api.py` -- which is how they were
found, sitting between two real questions from the site.

Two separate problems, both bad. Analytics computed over that project now
include runs that were never questions from anyone, and a test suite that talks
to a hosted service is a test suite that fails when the service is down or slow.

`LANGFUSE_TRACING_ENABLED=false` makes every `@observe` and every
`start_as_current_observation` a no-op while keeping the API present, so code
under test still calls it and tests that assert on those calls still work by
patching `get_client` themselves.
"""
import os

# Set before import, not in a fixture: by the time a fixture runs, the module
# under test has already read this and built its client.
os.environ["LANGFUSE_TRACING_ENABLED"] = "false"

# Cleared as well as disabled. The flag is what stops the tracing; these stop a
# future SDK change, or a code path that constructs its own client, from finding
# live credentials sitting in the environment.
for _key in ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"):
    os.environ[_key] = ""

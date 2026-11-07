

def test_allowlist_tracks_together_serverless_reality():
    """The default model must be requestable, and the retired one must not be."""
    from query_engine.models import ALLOWED_MODELS
    from shared.config import Settings

    # The declared default, not settings.together_model: the singleton reads the
    # deployment's .env, so on a host that pins a model this asserted about that
    # host rather than about the code. Drift between .env and the allowlist is a
    # deployment problem and needs a deployment check, not a unit test that only
    # fires when someone runs pytest on the server.
    shipped = Settings.model_fields["together_model"].default
    assert shipped in ALLOWED_MODELS, (
        f"default model {shipped} is not in ALLOWED_MODELS, so an "
        f"explicit request for it would be rejected"
    )
    assert "Qwen/Qwen2.5-7B-Instruct-Turbo" not in ALLOWED_MODELS, (
        "Qwen2.5-7B-Instruct-Turbo is dedicated-endpoint only on Together and 400s"
    )

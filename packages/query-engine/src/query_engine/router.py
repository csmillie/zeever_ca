def select_model(query: str, query_class: str) -> str:
    """Route to appropriate model based on query classification.

    DeepSeek (via Fireworks) is the default model.
    Claude available as fallback for cases where DeepSeek struggles.
    """
    return "deepseek"

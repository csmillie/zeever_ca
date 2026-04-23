def classify_query(query: str) -> str:
    """Classify a user query into a category for routing."""
    q = query.lower().strip()

    if any(p in q for p in ["what document", "what do i need to submit", "form", "drawing"]):
        return "documents"
    if any(p in q for p in ["do i need", "is a permit required", "can i build", "do i require"]):
        return "conditional"
    if any(p in q for p in ["how much", "cost", "fee", "price"]):
        return "fees"
    if any(p in q for p in ["how to", "process", "steps", "how long", "timeline", "apply"]):
        return "process"
    if any(p in q for p in ["inspection", "inspector"]):
        return "inspections"

    return "general"

def classify_content(title: str, text: str) -> str:
    """Classify document content type based on title and text keywords.

    Title-based matches take priority over text-based matches to avoid
    false positives (e.g., a review streams page that mentions "fees"
    in passing should not be classified as fee_schedule).
    """
    title_lower = title.lower()
    text_lower = text.lower()

    # Title-based classification (high confidence)
    if any(w in title_lower for w in ["fee schedule", "permit fees", "fees and charges"]):
        return "fee_schedule"

    if any(w in title_lower for w in ["inspection"]):
        return "inspection"

    if any(w in title_lower for w in ["form index", "application form"]):
        return "form"

    if any(w in title_lower for w in ["regulation", "building code", "bylaw", "by-law"]):
        return "regulation"

    if any(w in title_lower for w in [
        "guide", "how to", "review stream", "review process",
        "before you apply", "after you apply", "express",
        "application guide", "submission guide", "user guide",
    ]):
        return "guide"

    # Text-based classification (lower confidence, only for ambiguous titles)
    if any(w in title_lower for w in ["fee"]):
        return "fee_schedule"

    if any(w in text_lower[:500] for w in ["step 1", "step 2", "process", "how to apply"]):
        return "guide"

    if "inspection" in text_lower[:500]:
        return "inspection"

    if any(w in text_lower[:500] for w in ["regulation", "building code act"]):
        return "regulation"

    return "page"

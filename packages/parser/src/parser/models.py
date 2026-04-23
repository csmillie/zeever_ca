from dataclasses import dataclass, field


@dataclass
class ParsedContent:
    url: str
    title: str
    text: str
    headings: list[str] = field(default_factory=list)
    source_format: str = "html"  # "html" or "pdf"

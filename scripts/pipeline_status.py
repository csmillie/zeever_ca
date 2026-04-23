"""Pipeline status file for progress tracking.

Writes status to a JSON file that the webhook server reads
to provide real-time progress to the admin dashboard.
"""
import json
import os
import tempfile
from datetime import datetime, timezone

STATUS_FILE = os.environ.get("PIPELINE_STATUS_FILE", "/tmp/zeever-pipeline-status.json")


def _write(data: dict):
    """Atomic write — uses rename so readers never see a truncated file."""
    try:
        dir_ = os.path.dirname(STATUS_FILE) or "/tmp"
        with tempfile.NamedTemporaryFile("w", dir=dir_, delete=False, suffix=".tmp") as f:
            json.dump(data, f)
            tmp = f.name
        os.replace(tmp, STATUS_FILE)
    except Exception:
        pass  # Best effort, don't crash the pipeline


def read_status() -> dict:
    try:
        with open(STATUS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {"running": False}


def start(skip_crawl: bool = False):
    _write({
        "running": True,
        "step": "starting",
        "skip_crawl": skip_crawl,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None,
        "progress": {
            "pages_found": 0,
            "pages_crawled": 0,
            "pdfs_downloaded": 0,
            "new_documents": 0,
            "documents_parsed": 0,
            "chunks_embedded": 0,
        },
        "before": {},
        "after": {},
    })


def update_step(step: str, **kwargs):
    status = read_status()
    status["step"] = step
    if kwargs:
        status.setdefault("progress", {}).update(kwargs)
    _write(status)


def set_before(stats: dict):
    status = read_status()
    status["before"] = stats
    _write(status)


def set_after(stats: dict):
    status = read_status()
    status["after"] = stats
    _write(status)


def complete():
    status = read_status()
    status["running"] = False
    status["step"] = "complete"
    status["completed_at"] = datetime.now(timezone.utc).isoformat()
    _write(status)


def fail(error: str):
    status = read_status()
    status["running"] = False
    status["step"] = "failed"
    status["error"] = error
    status["completed_at"] = datetime.now(timezone.utc).isoformat()
    _write(status)

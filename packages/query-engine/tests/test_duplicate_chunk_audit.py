"""The audit decides whether thousands of chunks get collapsed, so its counting
has to be right about what counts as a copy.

Two mistakes would matter. Normalising too aggressively merges chunks that are
genuinely different and overstates the saving. Counting occurrences where pages
are meant hides the difference between a paragraph repeated three times on one
document and one appearing on three hundred.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import audit_duplicate_chunks as audit  # noqa: E402


def test_normalise_collapses_only_whitespace():
    """Line wrapping differs between a PDF and its accessible re-publication, so
    whitespace has to go. Nothing else does: case and punctuation carry meaning in
    a dollar limit or a section number."""
    assert audit.normalise("Approval\n  authority   for") == "Approval authority for"
    assert audit.normalise("  leading and trailing  ") == "leading and trailing"
    assert audit.normalise("$50,000") != audit.normalise("$500,00")
    assert audit.normalise("Section A") != audit.normalise("section a")


def test_normalise_survives_empty_and_none():
    assert audit.normalise("") == ""
    assert audit.normalise(None) == ""


def test_texts_differing_by_a_digit_are_not_one_family():
    """These documents differ from each other by a tracking number and an address.
    If those collapsed, the audit would recommend deleting distinct records."""
    a = audit.normalise("TRACKING NO.: 2016-091 3701 Keele St")
    b = audit.normalise("TRACKING NO.: 2025-021 610 Bay St")
    assert a != b

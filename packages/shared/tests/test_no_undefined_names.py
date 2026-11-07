"""Nothing in the repo may reference a name that does not exist.

This exists because of a bug the whole test suite was blind to. Three imports
were added to the wrong function in scripts/recrawl.py — placed in
discover_changed_urls, which uses none of them, while recrawl_urls used all
three. Every call would have raised NameError before reaching any of the logic,
and 449 tests passed, because nothing imports or executes that script.

The test written alongside that change read the source as text and asserted the
order of two calls. It could not see that neither call could run.

A linter can. These three rules are the ones that catch code which cannot
execute, as opposed to code that is untidy:

    F821  undefined name
    F822  undefined name in __all__
    F811  redefinition of an unused name

The full pyflakes set is deliberately not enforced. It reports 53 pre-existing
findings here, nearly all unused imports, and turning that on would mean either
a large unrelated cleanup or an ignore list that quietly grows until the check
means nothing. These three are clean today and each one means something is
broken.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
RULES = "F821,F822,F811"
TARGETS = ["scripts", "packages"]


def test_no_undefined_or_redefined_names():
    ruff = shutil.which("ruff")
    if ruff is None:
        pytest.skip("ruff not installed; it is in the dev dependency group")

    result = subprocess.run(
        [ruff, "check", "--select", RULES, "--no-cache", "--output-format", "concise",
         *TARGETS],
        cwd=REPO, capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, (
        "code references names that do not exist, so it raises NameError when "
        f"reached:\n\n{result.stdout}{result.stderr}"
    )

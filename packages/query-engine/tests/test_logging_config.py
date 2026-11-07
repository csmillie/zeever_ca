"""The service logs its measurements, and does not log what people asked.

Two findings in one file.

`retriever.py` has always logged

    retrieve | backend=pgvector mode=vector embed=118ms search=45ms total=163ms

and that line has never appeared in production. The service runs under bare
uvicorn, which configures its own loggers and not the application's, so every
logger.info in this codebase was discarded. Warnings and errors got through --
which is why a 404 was visible -- but timings never did.

It surfaced while investigating a request that spent 12.9 seconds before
generation began. The measurement that would have identified the phase existed
in the code and had never once been written to disk, so diagnosing it meant
re-measuring from outside.

The obvious fix -- raise the level globally -- would start recording residents'
questions, because cache.py logs them on every hit and store. This site answers
questions about permits, evictions and property taxes, and these same log files
held a leaked API key on 2026-09-14. So the loggers that emit measurements are
raised and the one that emits user content is not, and these tests hold that
line in place.
"""
import logging

import pytest

from query_engine import api  # noqa: F401  - importing installs the configuration


# Reached through the modules, never by name.
#
# The first version of this file listed logger names as strings and asserted on
# those. Every assertion passed while the configuration was inert, because the
# names in the test were the same wrong names as in the configuration -- the
# suite confirmed that the list agreed with itself. retriever.py and
# generator.py both log to "zeever.timing"; cache.py logs to "zeever.cache".
#
# Importing the module and reading its `logger` attribute is what closes that:
# rename the logger in retriever.py and this file fails, which is the point.
from query_engine import cache as cache_mod          # noqa: E402
from query_engine import generator as generator_mod  # noqa: E402
from query_engine import provider_chain as chain_mod # noqa: E402
from query_engine import retriever as retriever_mod  # noqa: E402
from query_engine import sanitizer as sanitizer_mod  # noqa: E402
from indexer import embedder as embedder_mod         # noqa: E402

MEASUREMENT_MODULES = [
    ("retriever", retriever_mod),
    ("generator", generator_mod),
    ("provider_chain", chain_mod),
    ("embedder", embedder_mod),
]


@pytest.mark.parametrize("label,module", MEASUREMENT_MODULES)
def test_measurements_are_emitted(label, module):
    """Each of these records how long something took or what it cost."""
    assert module.logger.isEnabledFor(logging.INFO), (
        f"{label} logs to {module.logger.name!r}, which is below INFO, so its "
        f"timings are discarded exactly as they were before this configuration "
        f"existed. Check the name in api.py against the one the module builds."
    )


def test_the_retrieval_timing_line_reaches_a_handler():
    """isEnabledFor is not delivery. A level with no handler is still silence,
    and the record has to travel through the module's own logger to prove it."""
    records = []

    class _Capture(logging.Handler):
        def emit(self, record):
            records.append(record.getMessage())

    handler = _Capture()
    logging.getLogger().addHandler(handler)
    try:
        retriever_mod.logger.info(
            "retrieve | backend=%s mode=%s embed=%dms search=%dms total=%dms",
            "pgvector", "vector", 118, 45, 163)
    finally:
        logging.getLogger().removeHandler(handler)

    assert any("embed=118ms" in m for m in records), (
        "The retrieval timing line did not reach a handler. This is the exact "
        "state that made a 12.9-second request undiagnosable."
    )


def test_the_cache_logger_does_not_record_what_people_asked():
    """cache.py logs the question text on every hit and every store.

    Not a level oversight -- a deliberate boundary. Retaining what residents
    asked is a privacy decision, and it should not be made as a side effect of
    wanting millisecond timings.
    """
    assert not cache_mod.logger.isEnabledFor(logging.INFO), (
        f"{cache_mod.logger.name!r} is at INFO, which writes residents' questions "
        f"into the PM2 logs. If that is intended it needs deciding on its own "
        f"terms, not inherited from a logging change."
    )


def test_no_question_text_escapes_through_the_cache_logger():
    """The behavioural half of the assertion above."""
    records = []

    class _Capture(logging.Handler):
        def emit(self, record):
            records.append(record.getMessage())

    handler = _Capture()
    logging.getLogger().addHandler(handler)
    try:
        cache_mod.logger.info("cache store | question=%s", "appeal an eviction notice")
    finally:
        logging.getLogger().removeHandler(handler)

    assert not any("eviction" in m for m in records)


def test_the_cache_logger_still_reports_failures():
    """Quiet about questions, not quiet about problems."""
    assert cache_mod.logger.isEnabledFor(logging.WARNING)


def test_the_security_logger_is_left_at_warning():
    """It records suspicious queries with the client IP, and it is supposed to.

    Asserted so that the one place user content is deliberately logged stays a
    decision somebody made rather than something a future level change sweeps up.
    """
    assert sanitizer_mod.logger.isEnabledFor(logging.WARNING)
    assert not sanitizer_mod.logger.isEnabledFor(logging.INFO)


def test_the_root_logger_is_not_raised():
    """Third-party libraries at INFO would bury the lines that matter, and some
    of them log request bodies."""
    assert logging.getLogger().level == logging.WARNING


def test_a_handler_exists_at_all():
    """uvicorn attaches handlers to its own loggers, not to the root. Without
    one here the records have nowhere to go, whatever their level."""
    assert logging.getLogger().handlers

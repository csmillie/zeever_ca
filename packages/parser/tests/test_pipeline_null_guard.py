"""A parsed document with no raw document must not stop the pipeline.

Redirect records are parsed_documents rows with raw_document_id NULL: the City
page was a pointer, so there is no fetched content behind them. The unparsed
filter is `RawDocument.id NOT IN (SELECT raw_document_id FROM parsed_documents)`,
and in SQL a NOT IN over a set containing NULL is never true. One such row would
make every document look already-parsed and the pipeline would quietly do nothing
for the rest of time.

This asserts the guard is in the query. It is a cheap test for an expensive
silence: nothing would raise, nothing would log, the corpus would simply stop
growing.
"""
from parser.pipeline import run_parse_pipeline
import inspect


def test_the_subquery_excludes_nulls():
    source = inspect.getsource(run_parse_pipeline)
    assert "raw_document_id.isnot(None)" in source, (
        "the unparsed-documents subquery must exclude NULL raw_document_id, or a "
        "single redirect record stops all parsing"
    )

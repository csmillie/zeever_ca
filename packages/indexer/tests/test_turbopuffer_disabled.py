"""Turning Turbopuffer off must be one line in .env, not a code change.

The API key is the switch. With it empty, the paths that can carry on without
the service skip it, and the paths that cannot get an error naming the switch
rather than a 401 from the API. That distinction is the point: a 401 sent us
looking at the crawler for twenty minutes when the crawler was fine.
"""
from unittest.mock import patch

import pytest

from indexer import turbopuffer_store as tp


def test_an_empty_key_means_disabled():
    for value in ("", "   ", None):
        with patch.object(tp.settings, "turbopuffer_api_key", value):
            assert tp.enabled() is False


def test_a_key_means_enabled():
    with patch.object(tp.settings, "turbopuffer_api_key", "tpuf-abc"):
        assert tp.enabled() is True


def test_using_it_while_disabled_names_the_switch():
    """Not a 401, and not an AttributeError three frames deep. The message has to
    say which setting turned it off and where retrieval is reading from, because
    the last time this failed the error read 'Error fetching <url>' and pointed
    at the crawler."""
    tp._client = None
    with patch.object(tp.settings, "turbopuffer_api_key", ""), \
         patch.object(tp.settings, "retrieval_backend", "pgvector"):
        with pytest.raises(RuntimeError, match="TURBOPUFFER_API_KEY is empty"):
            tp._get_client()


def test_the_error_reports_where_retrieval_is_actually_reading():
    tp._client = None
    with patch.object(tp.settings, "turbopuffer_api_key", ""), \
         patch.object(tp.settings, "retrieval_backend", "pgvector"):
        with pytest.raises(RuntimeError, match="retrieval_backend='pgvector'"):
            tp.get_namespace()

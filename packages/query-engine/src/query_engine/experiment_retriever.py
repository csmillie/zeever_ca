from indexer.embedder import embed_texts
from indexer.vector_store import search_similar
from indexer.turbopuffer_store import search_vector, search_hybrid

SIMILARITY_THRESHOLD = 0.2

BACKENDS = frozenset({"pgvector", "pgvectorscale", "turbopuffer"})
# Hybrid fuses dense results with BM25, so it needs a lexical index. Only
# Turbopuffer has one here.
HYBRID_BACKENDS = frozenset({"turbopuffer"})


def check_arm(backend: str, mode: str) -> None:
    """Raise if this arm cannot be run, without running it.

    Exists so a caller can ask before doing expensive work. The breadth eval
    generates a question per page from a local model, so an arm that fails on
    every row failed after all of that, reported nothing scored, and left the
    reason in the CSV.

    The rule lives here rather than in the caller because retrieve_arm enforces
    the same one; two copies would eventually disagree, and the copy that is
    wrong would be the one that lets a bad arm through.
    """
    if backend not in BACKENDS:
        raise ValueError(f"unknown backend: {backend!r}")
    if mode == "hybrid":
        if backend not in HYBRID_BACKENDS:
            raise ValueError(
                f"{backend} supports only mode='vector': hybrid needs a lexical "
                f"index, which only {'/'.join(sorted(HYBRID_BACKENDS))} has here")
    elif mode != "vector":
        raise ValueError(f"unknown mode: {mode!r}")


def retrieve_arm(query, backend, mode, limit=5, query_embedding=None):
    """Retrieve chunks for one experiment arm. Returns (chunks, query_embedding).

    backend: "pgvector" | "turbopuffer" | "pgvectorscale"; mode: "vector" | "hybrid".
    Applies a uniform similarity threshold so no arm gets a free recall edge.

    pgvectorscale is imported lazily because it needs its own database URL and is
    a benchmark arm rather than a production path. Importing it at module scope
    would make every caller of this module depend on a host that only exists for
    the experiment.
    """
    check_arm(backend, mode)
    if query_embedding is None:
        query_embedding = embed_texts([query])[0]

    if backend == "pgvector":
        chunks = search_similar(query_embedding, limit=limit)
    elif backend == "pgvectorscale":
        from indexer.pgvectorscale_store import search_vector as pvs_search
        chunks = pvs_search(query_embedding, limit=limit)
    elif mode == "hybrid":
        chunks = search_hybrid(query_embedding, query, limit)
    else:
        chunks = search_vector(query_embedding, limit=limit)

    filtered = [c for c in chunks if c.get("similarity", 0) >= SIMILARITY_THRESHOLD]
    return filtered, query_embedding


def retrieve_arm_ranked(query, backend, mode, limit=5, query_embedding=None):
    """One arm, ranked the way production ranks.

    retrieve_arm returns the raw hit list. Production over-fetches, drops near
    duplicates and caps how many chunks any one page may contribute, and those
    steps decide whether the target page lands in the top five as much as the
    store does. Comparing raw lists would measure the stores under conditions
    neither of them ever runs in.

    Deliberately not retriever.retrieve, which falls back to pgvector when
    Turbopuffer errors. That is right for serving and wrong for measuring: a
    Turbopuffer arm that quietly answered from pgvector would be reported as a
    Turbopuffer result.
    """
    from query_engine.retriever import _dedupe

    chunks, query_embedding = retrieve_arm(
        query, backend, mode, limit=limit * 3, query_embedding=query_embedding)
    return _dedupe(chunks, limit), query_embedding

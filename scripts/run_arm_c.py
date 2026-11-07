#!/usr/bin/env python
"""Arm C: a modern dense embedding against the Stage 2 baseline.

    uv run python scripts/run_arm_c.py --ollama-url http://HOST_2_TAILNET_IP:11434
    uv run python scripts/run_arm_c.py --ollama-url ... --max-chunks 500 --limit 5   # smoke test

This is the decision gate for the requirement-aware retrieval experiment. Stage 2
found 11 of the 74 scorable Benchmark A questions with no relevant chunk in the
exact top 10 under nomic-embed-text. If Qwen3-Embedding finds most of them, the
gap was the embedding model, the later stages would be measuring a weak
baseline, and the experiment should be reconsidered before they are built. If it
finds few, the gap is about how questions are represented, and the experiment
proceeds.

## Why exact search, and no table

The question is whether the vectors can find the page, not whether an index can.
Stage 2 showed the production IVFFlat index costs nothing against exact search,
so exact search is the fair ceiling for both models. 57,400 chunks at 1024
dimensions is about 235 MB of float32, small enough to search in memory in
milliseconds, so nothing is written to the database: no new table, no index, no
probes sweep. Those matter only if Arm C wins and is proposed for production,
and the 1024-d vectors would then need their own sweep, because lists=240 and
probes=40 were tuned for 768-d nomic.

## The arms

  B        nomic-embed-text through the production chain, exact search in
           Postgres. The same function as Stage 2's arm B, run again here so
           both arms see the corpus as it is today rather than as it was.
  C        Qwen3-Embedding, query wrapped in the instruction the model card
           recommends for retrieval. Documents are embedded without one.
  C-plain  the same document vectors, query sent bare. Costs 74 embeddings and
           shows how much of any difference is the instruction.

## Running it on the server

Chunks are read from the live database (read only), so this runs on the VPS,
from `/tmp`, never from a copy inside the repo. See "The repository directory is
not scratch space" in docs/DEPLOYMENT.md. Document vectors are cached under
--runs-dir in parts, so an interrupted run resumes; the cache is keyed by model
and by the exact set of chunk ids, so a corpus that changed is re-embedded rather
than scored against stale vectors.

Measured against the RTX 3070 host on 2 November 2026: about 23 chunks a second
on chunk-sized text, so the full corpus takes roughly 40 minutes; the 56 a
second measured earlier was nomic. That host is also EMBEDDING_BASE_URL_2, the
site's second embedding endpoint, which only serves when the first is down.

Vectors are not bit-reproducible. The same text embedded twice agrees at cosine
0.9997, not 1.0, because GPU batching changes the arithmetic. That is far below
anything that reorders a ranking in practice, but it means a resumed run and a
fresh one can differ in the last digits, and an exact tie between two runs is
not something to expect.
"""
import argparse
import hashlib
import json
import os
import platform
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import httpx
import numpy as np
from evals.prompts import BENCHMARK_PROMPTS
from evals.retrieval_metrics import (
    DEFAULT_KS,
    aggregate,
    by_category,
    hit_rank,
    score_query,
)
from evals.retrieval_truth import coverage
from evals.retrieval_truth import load as load_truth
from shared.db import get_session
from sqlalchemy import text as sql

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_retrieval_baseline import (
    DEFAULT_RUNS_DIR,
    _git,
    corpus_fingerprint,
    run_arm,
)

DEFAULT_MODEL = "qwen3-embedding:0.6b"
DIMENSIONS = 1024

# From the Qwen3-Embedding model card. The model was trained with an instruction
# on the query side only; omitting it is reported to cost 1-5%, which is why
# C-plain exists rather than trusting the claim.
TASK = "Given a web search query, retrieve relevant passages that answer the query"

PART_SIZE = 512     # chunks per cached file
BATCH_SIZE = 32     # chunks per request to Ollama
# The model's full window. 8192 looked generous against the chunker's 2048-token
# cap, but older chunks were embedded by Fireworks, which accepts 8192 nomic
# tokens, and the first full run stopped at part 6 on one longer than 8192 Qwen
# tokens. Measured on the 3070: the same throughput at 32768 as at 8192 for
# chunk-sized batches, and 4.0 GB of VRAM, beside nomic's 0.3 GB.
NUM_CTX = 32768


class TooLong(RuntimeError):
    """Ollama refused an input longer than NUM_CTX."""


def instructed(query: str) -> str:
    return f"Instruct: {TASK}\nQuery:{query}"


def snapshot_chunks() -> list[dict]:
    """Every chunk production can retrieve, in a fixed order.

    The same filter as retrieval, `embedding IS NOT NULL`, so Arm C searches the
    same population arm B does.
    """
    with get_session() as s:
        rows = s.execute(sql("""
            SELECT dc.id, dc.chunk_text, pd.url, pd.title
            FROM canadian_ai.document_chunks dc
            JOIN canadian_ai.parsed_documents pd ON dc.parsed_document_id = pd.id
            WHERE dc.embedding IS NOT NULL
            ORDER BY dc.id
        """)).mappings().all()
    return [dict(r) for r in rows]


def cache_key(model: str, chunk_ids: list) -> str:
    h = hashlib.sha256(model.encode())
    for cid in chunk_ids:
        h.update(str(cid).encode() + b"\n")
    return h.hexdigest()[:16]


class Ollama:
    """Ollama's native /api/embed, because the OpenAI-compatible route cannot
    refuse to truncate. With truncate=false an over-long input is an error
    instead of a vector for a shorter document."""

    def __init__(self, base_url: str, model: str):
        self.url = base_url.rstrip("/").removesuffix("/v1") + "/api/embed"
        self.model = model
        self.client = httpx.Client(timeout=300)

    def preflight(self) -> str | None:
        """Why this host cannot serve the run, or None if it can.

        Checked before anything else, because the retries in embed() are built
        for a host having a bad moment and take minutes to give up on one that
        cannot be reached at all. On 2 November 2026 the VPS had dropped off the
        tailnet, and the first sign was four connection timeouts and a traceback.
        """
        base = self.url.removesuffix("/api/embed")
        try:
            r = httpx.get(f"{base}/api/tags", timeout=5)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            return (f"Cannot reach Ollama at {base}: {exc}.\n"
                    f"The hosts listen on their Tailscale address only, so check "
                    f"`tailscale status` on this machine first.")
        names = {m.get("name") for m in r.json().get("models", [])}
        if self.model not in names:
            return (f"{base} does not have {self.model}. Pull it there with "
                    f"`ollama pull {self.model}`.")
        return None

    def embed(self, texts: list[str], attempts: int = 5, truncate: bool = False) -> np.ndarray:
        body = {"model": self.model, "input": texts, "truncate": truncate,
                "options": {"num_ctx": NUM_CTX}}
        for attempt in range(1, attempts + 1):
            try:
                r = self.client.post(self.url, json=body)
                if r.status_code == 200:
                    break
                # A 4xx is the request, not the host: retrying will not help,
                # and the message is the useful part.
                if r.status_code < 500:
                    kind = TooLong if "exceeds the context length" in r.text else RuntimeError
                    raise kind(f"{self.url} {r.status_code}: {r.text[:300]}")
            except httpx.TransportError as exc:
                if attempt == attempts:
                    raise
                print(f"  embed attempt {attempt} failed: {exc}", flush=True)
            if attempt == attempts:
                raise RuntimeError(f"{self.url} {r.status_code}: {r.text[:300]}")
            time.sleep(min(2 ** attempt, 30))
        vecs = np.asarray(r.json()["embeddings"], dtype=np.float32)
        if vecs.shape != (len(texts), DIMENSIONS):
            raise RuntimeError(f"expected {(len(texts), DIMENSIONS)} vectors, got {vecs.shape}")
        return normalize(vecs)


def normalize(vecs: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    if (norms == 0).any():
        raise RuntimeError("zero vector returned; the model produced nothing for some input")
    return vecs / norms


def embed_batch(batch: list[dict], ollama: Ollama, truncated: list) -> np.ndarray:
    """One request's worth of chunks. A single over-long chunk fails the whole
    request, so on that refusal the batch is embedded one chunk at a time and
    only the chunk that is actually too long is truncated. It is recorded, not
    hidden: a truncated vector is for different text, and a relevant chunk
    among them would bias the comparison."""
    texts = [c["chunk_text"] or "" for c in batch]
    try:
        return ollama.embed(texts)
    except TooLong:
        pass
    out = []
    for c, t in zip(batch, texts):
        try:
            out.append(ollama.embed([t]))
        except TooLong:
            print(f"  chunk {c['id']} ({c['url']}) is over {NUM_CTX} tokens; "
                  f"embedding its first {NUM_CTX}", flush=True)
            truncated.append({"id": str(c["id"]), "url": c["url"], "words": len(t.split())})
            out.append(ollama.embed([t], truncate=True))
    return np.concatenate(out)


def embed_corpus(chunks: list[dict], ollama: Ollama,
                 cache_dir: Path) -> tuple[np.ndarray, list[dict]]:
    """Document vectors, from cache where they exist, and the chunks that had to
    be truncated. One file per PART_SIZE chunks, written only when complete, so
    a killed run loses at most one part."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    log = cache_dir / "truncated.json"
    truncated = json.loads(log.read_text(encoding="utf-8")) if log.exists() else []
    parts = []
    n_parts = (len(chunks) + PART_SIZE - 1) // PART_SIZE
    t0 = time.time()
    embedded = 0
    for p in range(n_parts):
        path = cache_dir / f"part-{p:05d}.npy"
        if path.exists():
            parts.append(np.load(path))
            continue
        part = chunks[p * PART_SIZE:(p + 1) * PART_SIZE]
        vecs = np.concatenate([embed_batch(part[i:i + BATCH_SIZE], ollama, truncated)
                               for i in range(0, len(part), BATCH_SIZE)])
        # The log first, then the part: a crash between the two re-embeds the
        # part and logs its chunks again, which the dedupe below absorbs, rather
        # than keeping a part whose truncations nothing recorded.
        truncated = list({t["id"]: t for t in truncated}.values())
        log.write_text(json.dumps(truncated, indent=1) + "\n", encoding="utf-8")
        tmp = path.with_suffix(".tmp.npy")
        np.save(tmp, vecs)
        tmp.rename(path)
        parts.append(vecs)
        embedded += len(part)
        rate = embedded / max(time.time() - t0, 1e-9)
        left = len(chunks) - (p + 1) * PART_SIZE
        print(f"  part {p + 1}/{n_parts}  {rate:.1f} chunks/s  "
              f"~{max(left, 0) / max(rate, 1e-9) / 60:.0f} min left", flush=True)
    matrix = np.concatenate(parts) if parts else np.zeros((0, DIMENSIONS), np.float32)
    return matrix, truncated


def top_k(matrix: np.ndarray, query: np.ndarray, k: int) -> list[int]:
    """Indices of the k most similar rows, best first. Ties break on row order,
    which is chunk id order, for the reason Stage 2's search_exact gives: an
    unordered tie can move a question between two identical runs."""
    scores = matrix @ query
    k = min(k, len(scores))
    idx = np.argpartition(-scores, k - 1)[:k]
    return sorted(idx.tolist(), key=lambda i: (-scores[i], i))


def run_dense_arm(arm: str, prompts, truths, chunks, matrix, ollama: Ollama, k_max: int) -> list:
    results = []
    for bp in prompts:
        q = bp.prompt if arm == "C-plain" else instructed(bp.prompt)
        t0 = time.time()
        qv = ollama.embed([q])[0]
        embed_ms = int((time.time() - t0) * 1000)
        t1 = time.time()
        hits = [{"id": chunks[i]["id"], "url": chunks[i]["url"], "title": chunks[i]["title"]}
                for i in top_k(matrix, qv, k_max)]
        search_ms = int((time.time() - t1) * 1000)
        results.append(score_query(bp.id, bp.category, hits, truths[bp.id],
                                   total_ms=embed_ms + search_ms,
                                   embed_ms=embed_ms, search_ms=search_ms))
    return results


def gate(baseline: list, challenger: list, k: int) -> dict:
    """The decision number: of the questions the baseline cannot reach at depth
    k, how many the challenger can, and what it loses in exchange."""
    base = {r.prompt_id: r.recall[k] > 0 for r in baseline}
    chal = {r.prompt_id: r.recall[k] > 0 for r in challenger}
    unreachable = sorted(p for p, found in base.items() if not found)
    return {
        "k": k,
        "baseline_unreachable": len(unreachable),
        "recovered": sorted(p for p in unreachable if chal.get(p)),
        "lost": sorted(p for p, found in base.items() if found and not chal.get(p)),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ollama-url", default=os.environ.get("ARM_C_OLLAMA_URL"),
                    help="Ollama host serving the model, e.g. http://HOST_2_TAILNET_IP:11434")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--limit", type=int, help="score only the first N scorable prompts")
    ap.add_argument("--max-chunks", type=int,
                    help="embed only the first N chunks (smoke test; scores are meaningless)")
    ap.add_argument("--k-max", type=int, default=10)
    ap.add_argument("--note", default="", help="recorded in the manifest")
    ap.add_argument("--runs-dir", type=Path,
                    default=Path(os.environ.get("EXPERIMENT_RUNS_DIR") or DEFAULT_RUNS_DIR),
                    help="where to write results and the vector cache "
                         "(default: $EXPERIMENT_RUNS_DIR, else experiments/runs)")
    args = ap.parse_args()
    if not args.ollama_url:
        ap.error("--ollama-url (or ARM_C_OLLAMA_URL) is required")

    truths = load_truth()
    if not truths:
        print("No ground truth. Run scripts/build_retrieval_truth.py first.")
        return 2
    cov = coverage(truths)
    scorable_ids = {t.id for t in truths.values() if t.is_scorable}
    prompts = [bp for bp in BENCHMARK_PROMPTS if bp.id in scorable_ids]
    if args.limit:
        prompts = prompts[: args.limit]
    print(f"Benchmark A: {cov['scorable']} scorable, {len(prompts)} being run, "
          f"HUMAN VERIFIED: {cov['verified']}")

    ollama = Ollama(args.ollama_url, args.model)
    print(f"model {args.model} at {ollama.url}")
    problem = ollama.preflight()
    if problem:
        print(f"\n{problem}")
        return 3

    corpus_before = corpus_fingerprint()
    chunks = snapshot_chunks()
    if args.max_chunks:
        chunks = chunks[: args.max_chunks]
    key = cache_key(args.model, [c["id"] for c in chunks])
    cache_dir = args.runs_dir / "arm-c-cache" / f"{args.model.replace(':', '_')}-{key}"
    print(f"{len(chunks):,} chunks; vector cache {cache_dir}")

    t0 = time.time()
    matrix, truncated = embed_corpus(chunks, ollama, cache_dir)
    # A truncated chunk only matters if it is an answer to a scored question.
    truncated_relevant = sorted({bp.id for bp in prompts for t in truncated
                                 if hit_rank([t], truths[bp.id])})
    if truncated:
        print(f"{len(truncated)} chunks were over {NUM_CTX} tokens and embedded truncated; "
              f"relevant to: {', '.join(truncated_relevant) or 'no scored question'}")
    embed_wall = round(time.time() - t0, 1)
    for c in chunks:
        c.pop("chunk_text", None)       # 235 MB of vectors is enough to hold

    run_id = f"arm-c-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:6]}"
    manifest = {
        "run_id": run_id,
        "started": datetime.now(UTC).isoformat(),
        "git_commit": _git("rev-parse", "HEAD"),
        "git_dirty": bool(_git("status", "--porcelain")),
        "host": platform.node(),
        "benchmark": "Zeever Retrieval Benchmark A - Existing Questions",
        "benchmark_scored": len(prompts),
        "benchmark_coverage": cov,
        "corpus": corpus_before,
        "chunks_embedded": len(chunks),
        "smoke_test": bool(args.max_chunks),
        "challenger_model": args.model,
        "challenger_dimensions": DIMENSIONS,
        "challenger_endpoint": ollama.url,
        "challenger_query_instruction": TASK,
        "challenger_embed_wall_seconds": embed_wall,
        "vector_cache": str(cache_dir),
        "challenger_num_ctx": NUM_CTX,
        "challenger_truncated_chunks": truncated,
        "challenger_truncated_relevant_to": truncated_relevant,
        "search": "exact cosine, both arms",
        "k_max": args.k_max,
        "ks": list(DEFAULT_KS),
        "note": args.note,
        "arms": {},
    }

    per_query = {}
    for arm in ("B", "C", "C-plain"):
        print(f"\n=== arm {arm}")
        t0 = time.time()
        if arm == "B":
            results = run_arm("B", prompts, truths, args.k_max)
        else:
            results = run_dense_arm(arm, prompts, truths, chunks, matrix, ollama, args.k_max)
        agg = aggregate(results)
        agg["wall_seconds"] = round(time.time() - t0, 1)
        manifest["arms"][arm] = agg
        manifest.setdefault("by_category", {})[arm] = by_category(results)
        per_query[arm] = results
        cells = "  ".join(f"R@{k}={agg[f'recall@{k}']:.3f}" for k in DEFAULT_KS)
        print(f"  {cells}  MRR={agg['mrr']:.3f}  found={agg['found']}/{agg['n']}")

    manifest["gate"] = {arm: gate(per_query["B"], per_query[arm], args.k_max)
                        for arm in ("C", "C-plain")}
    corpus_after = corpus_fingerprint()
    manifest["corpus_after"] = corpus_after
    if corpus_after != corpus_before:
        print("\nWARNING: the corpus changed during the run (a recrawl?). Arm B searched "
              "the live table; Arm C searched the snapshot. Re-run when it is quiet.")

    print("\n=== gate")
    for arm, g in manifest["gate"].items():
        print(f"  {arm}: recovers {len(g['recovered'])} of the {g['baseline_unreachable']} "
              f"questions B cannot reach at {g['k']}, loses {len(g['lost'])}")
        print(f"    recovered: {', '.join(g['recovered']) or '-'}")
        print(f"    lost:      {', '.join(g['lost']) or '-'}")
    if args.max_chunks:
        print("  (smoke test on a partial corpus: these numbers mean nothing)")

    runs_dir = args.runs_dir
    runs_dir.mkdir(parents=True, exist_ok=True)
    (runs_dir / f"{run_id}.manifest.json").write_text(
        json.dumps(manifest, indent=2, default=str) + "\n", encoding="utf-8")
    with (runs_dir / f"{run_id}.jsonl").open("w", encoding="utf-8") as fh:
        for arm, results in per_query.items():
            for r in results:
                fh.write(json.dumps({"run_id": run_id, "arm": arm, **r.__dict__},
                                    default=str) + "\n")
    print(f"\nwrote {runs_dir / run_id}.manifest.json and .jsonl")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

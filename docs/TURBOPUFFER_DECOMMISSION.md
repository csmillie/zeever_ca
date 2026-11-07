# Retiring Turbopuffer, in stages

Decision, 7 September 2026: production retrieval moves back to pgvector, and
Turbopuffer is retired once the switch has held.

## Why, given Turbopuffer won the original comparison

It did not. The comparison that chose it measured Turbopuffer against a pgvector
setup whose index was never used, so every pgvector query read all 58,000 rows.
That is documented in `/research/turbopuffer-vs-pgvector` and in
`db/migrations/005_ivfflat_lists_240.sql`.

With the index rebuilt at 240 lists and probes swept to 40, measured over the same
300 pages and the same questions:

| backend | recall@5 | p50 | p95 |
|---|---|---|---|
| Turbopuffer | 58.1% | 28ms | 35ms |
| pgvector | 57.1% | 35ms | 128ms |

Recall is a tie, and this is the paired test rather than a comparison of totals,
run over the same 300 pages with the same cached questions:

```
recall  172/296 = 58.1%   ->   169/296 = 57.1%   (-3)
  found only after      2
  found only before     5
  unchanged           289
  McNemar exact two-sided p = 0.4531

RANK, for the 167 pages found in both runs
  mean 1.68 -> 1.68   (+0.00)
  moved up 0, down 0, unchanged 167
```

Seven pages disagree out of 296, and the difference is indistinguishable from
chance. The second half is the stronger evidence: of the 167 pages both backends
found, every one came back at the same rank. These two stores are not merely
scoring alike, they are returning the same ordering.

Turbopuffer keeps a real advantage at the tail, roughly four times tighter at p95,
on a VPS shared with other sites.

That is the whole of the case for it, and it is worth less than the reasons against:
an external dependency, an API key, a monthly bill, and a second copy of the corpus
that drifts. This project exists partly to show that a Canadian public-sector
assistant can run on infrastructure its operator controls. Ninety milliseconds at
the 95th percentile, against an answer that takes several seconds to generate, is
not worth trading that for.

### What would have changed this decision

Recall separating by more than a page or two, or the rank comparison showing
movement. Neither did. If a future run shows either, this document is wrong and
the decision should be revisited rather than defended.

## Stage 1: switch reads (reversible in seconds)

```bash
# in the VPS .env
RETRIEVAL_BACKEND=pgvector
```
```bash
pm2 restart zeever-api
```

Dual-write continues, so Turbopuffer stays current and the switch back is the same
one line. Verify:

```bash
uv run python scripts/explain_vector_search.py     # Index Scan, single-digit ms
```

Watch the answer latency in the logs for a few days. `retrieve | backend=pgvector`
appears on every query with its embed and search split.

## Stage 2: watch, with the escape hatch intact

Leave it here for at least a week of real traffic. What would send us back:

* p95 retrieval latency that a user can feel, rather than one visible only in a table
* any recall complaint that reproduces against pgvector and not Turbopuffer
* the VPS running short of memory again, which is what sent us to a hosted store in
  the first place

Nothing in this stage is irreversible, and that is the point of keeping it.

## Where this actually stands, 8 September 2026

Parked between stages 2 and 3, and not by choice. The Turbopuffer API key began
returning 401, which blocked every maintenance path in the project: re-crawl,
parse, dedupe and prune all retire pages through retire_parsed_documents, which
deleted a page's vectors before its rows. A store that was no longer serving
anything could stop maintenance of the store that was.

Turbopuffer is therefore disabled by clearing TURBOPUFFER_API_KEY. That is the
switch: no key means no dual-write, no vector deletes, and a legible error from
anything that still asks for it. Nothing in the code path only exists while it is
off, so re-enabling is the same one line.

What being off costs: the namespace is now drifting, since new content is written
only to pgvector. Before Turbopuffer could serve again it needs a rebuild, not
just a key:

```bash
uv run python scripts/rebuild_turbopuffer.py --namespace <new> --verify
```

Which means the one-line rollback promised in stage 1 no longer exists. That is
worth stating plainly rather than discovering during an incident.

## Stage 3: stop dual-writing

Only after stage 2 passes. `index_pipeline` writes both stores today, and its
failure handling already distinguishes which backend is serving: with pgvector
active an unsynced chunk is a warning, not an error.

Removing the write means the eval harness loses its Turbopuffer arm, so the
comparison in this document cannot be re-run afterwards. Re-run it before removing
anything, and record the result, or the next person has to take these numbers on
trust.

## Stage 4: delete the namespace and the key

Last, and only when nobody wants the arm back. Delete `toronto-chunks-v2`, remove
`TURBOPUFFER_API_KEY` from the VPS `.env`, and cancel the plan.

Keep `turbopuffer_store.py` and the eval arm in the repo. They cost nothing, they
document how the comparison was run, and re-adding a key is easier than rewriting
a store.

## What must not happen

Do not drop the pgvector index or the embedding column. Issue #119 proposed exactly
that, on the premise that pgvector was 20 times slower. It was never 20 times
slower: it was an unindexed table. Acting on that issue would delete the only
retrieval path that runs on hardware we control.

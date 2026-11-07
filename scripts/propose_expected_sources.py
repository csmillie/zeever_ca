"""Propose a narrower expected_sources for prompts scored against a whole section.

    uv run python scripts/propose_expected_sources.py
    uv run python scripts/propose_expected_sources.py --prompt-id bp-85
    uv run python scripts/propose_expected_sources.py --max-urls 5 --show 6

Only 19 of the 100 benchmark prompts name something specific. bp-85 expects
"community-people", which matches 1,645 corpus URLs; bp-81 expects "health",
which matches 819. A hit against those says retrieval stayed in the right
neighbourhood, not that it found the answer, so most of the benchmark cannot
detect an improvement or a regression.

Worse, a loose expectation hides gaps. bp-70 expects "water", 431 URLs, and
scored a retrieval hit on every run in this investigation while the page that
answers it has never been crawled. A healthy 89 percent was reported over a
corpus missing an entire content section.

This proposes replacements rather than making them. For each prompt it takes the
corpus URLs the current substring matches, scores them on how much of the
prompt's own vocabulary appears in the URL path, and prints the best candidates
with the substring that would select each one. A person still has to decide,
because "the page that answers this question" is a judgement the corpus cannot
make, and an automatic narrowing would replace a measurement that is too loose
with one that is confidently wrong.

Ranking deliberately ignores retrieval. Using the retriever to choose the target
would make the benchmark measure its own output.
"""
import argparse
import re
from collections import Counter

from sqlalchemy import text as sql

from evals.prompts import BENCHMARK_PROMPTS
from shared.db import get_session

# Words that carry no signal about which page answers a question. "toronto"
# appears in the prompt text and in most URLs, so it separates nothing.
STOPWORDS = {
    "the", "a", "an", "is", "are", "do", "does", "did", "how", "what", "when",
    "where", "who", "why", "which", "can", "i", "my", "me", "for", "to", "in",
    "of", "on", "at", "and", "or", "with", "from", "get", "got", "need", "there",
    "toronto", "city", "am", "be", "it", "if", "any", "have", "has",
}

# Bands from audit_expected_sources: one page is an expectation, a handful still
# identifies a page family, past that the substring stops distinguishing.
PRECISE = 5


def stem(word: str) -> str:
    """Crude plural stripping, enough to match a prompt against a URL slug.

    Without it "pothole" did not match "potholes", and bp-54 was handed 'plowto'
    scoring zero terms while the correct page sat two rows below in its own
    candidate list.

    The "es" rule follows the English one rather than stripping blindly: "es"
    only comes off after a sibilant, so boxes becomes box while potholes becomes
    pothole. Stripping it blindly turned "rates" into "rat", which would then
    match pest control pages, and "potholes" into "pothol", which matched nothing
    at all.
    """
    # Short words are left alone: "bus" and "gas" are not plurals, and the rules
    # below would eat their last letter.
    if len(word) < 4:
        return word
    if len(word) >= 5 and word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith("es") and word[:-2].endswith(("s", "x", "z", "ch", "sh")):
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def tokens(text: str) -> set[str]:
    return {stem(w) for w in re.split(r"[^a-z0-9]+", (text or "").lower())
            if len(w) > 2 and w not in STOPWORDS}


def path_segments(url: str) -> list[str]:
    """Path segments of a URL, longest last, ignoring the filename extension."""
    path = re.sub(r"^https?://[^/]+", "", url or "").strip("/")
    return [s for s in path.split("/") if s]


def score(url: str, want: set[str]) -> tuple[int, int]:
    """How well a URL matches the prompt, and how specific it is.

    Sorted on match first, then on brevity of the final segment: between two URLs
    that match equally, the shorter, more direct one is usually the answer page
    rather than a subsection of it.
    """
    segs = path_segments(url)
    url_tokens = tokens(" ".join(segs))
    return (len(want & url_tokens), -len(segs[-1]) if segs else 0)


def suggest_substring(url: str) -> str:
    """The narrowest path segment that would select this URL."""
    segs = path_segments(url)
    return segs[-1] if segs else url


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prompt-id", help="only this prompt")
    ap.add_argument("--max-urls", type=int, default=PRECISE,
                    help=f"treat an expectation as fine if it matches this many or fewer "
                         f"(default {PRECISE})")
    ap.add_argument("--show", type=int, default=4, help="candidates to print per prompt")
    args = ap.parse_args()

    with get_session() as session:
        urls = [r[0] for r in session.execute(sql(
            "SELECT DISTINCT url FROM canadian_ai.parsed_documents WHERE url IS NOT NULL"
        )) if r[0]]
    lowered = [(u, u.lower()) for u in urls]
    print(f"{len(urls):,} distinct URLs in the corpus\n")

    prompts = BENCHMARK_PROMPTS
    if args.prompt_id:
        prompts = [p for p in prompts if p.id == args.prompt_id]
        if not prompts:
            print(f"No prompt {args.prompt_id!r}.")
            return 2

    proposed = skipped = unfixable = 0
    for bp in prompts:
        matches = {s: [u for u, low in lowered if s.lower() in low]
                   for s in bp.expected_sources}
        worst = max((len(v) for v in matches.values()), default=0)
        if 0 < worst <= args.max_urls and not args.prompt_id:
            skipped += 1
            continue

        want = tokens(bp.prompt)
        candidates = sorted({u for v in matches.values() for u in v},
                            key=lambda u: score(u, want), reverse=True)

        print(f"{bp.id}  ({bp.category})  {bp.prompt}")
        print(f"  now: {bp.expected_sources}  -> "
              + ", ".join(f"{s!r}={len(v)}" for s, v in matches.items()))

        if not candidates:
            print("  NOTHING MATCHES. The expected page is not in the corpus, so this")
            print("  prompt can never score a hit. Check toronto.ca before narrowing.\n")
            unfixable += 1
            continue

        for url in candidates[:args.show]:
            hits, _ = score(url, want)
            sub = suggest_substring(url)
            selects = sum(1 for _, low in lowered if sub.lower() in low)
            flag = "" if selects <= args.max_urls else f"  (still matches {selects})"
            print(f"    {hits} term(s)  {sub!r}{flag}")
            print(f"              {url[:104]}")

        best = candidates[0]
        sub = suggest_substring(best)
        selects = sum(1 for _, low in lowered if sub.lower() in low)
        if selects <= args.max_urls:
            print(f"  best candidate: expected_sources=[{sub!r}]   (matches {selects})")
            proposed += 1
        else:
            print(f"  No single segment narrows this far; needs a judgement call.")
        print()

    if not args.prompt_id:
        print(f"{proposed} proposals, {skipped} already specific enough, "
              f"{unfixable} match nothing at all")
        print("\nNothing was changed, and the top line is a starting point rather than an")
        print("answer. Measured against a human reading the same lists, roughly one in six")
        print("of these was right: token overlap on a URL slug does not capture meaning, so")
        print("'report a pothole' was once handed 'plowto' while 'potholes' sat two rows")
        print("below it. Read the candidates. A wrong narrowing is worse than a loose one,")
        print("because it looks precise.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

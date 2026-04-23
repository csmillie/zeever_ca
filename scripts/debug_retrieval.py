"""Debug retrieval quality for specific queries."""
from indexer.embedder import embed_texts
from indexer.vector_store import search_similar

QUERIES = [
    "What happens if I build without a permit in Toronto?",          # bp-11: 0.0 relevance
    "What is an express building permit and do I qualify?",           # bp-09: 0.33 relevance
    "What documents do I need to submit with a building permit application?",  # bp-02: 0.33/0.67
    "How long does it take to get a building permit approved?",       # bp-05: 0.50
    "Do I need a building permit to build a deck in Toronto?",        # bp-01: 0.75 but 0.0 citation
]

def main():
    for query in QUERIES:
        print(f"\n{'='*80}")
        print(f"QUERY: {query}")
        print(f"{'='*80}")

        embedding = embed_texts([query])[0]
        results = search_similar(embedding, limit=5)

        if not results:
            print("  NO RESULTS FOUND")
            continue

        for i, r in enumerate(results):
            sim = r.get("similarity", 0)
            url = r.get("url", "?")
            text = r.get("chunk_text", "")[:200]
            print(f"\n  [{i+1}] similarity={sim:.4f}")
            print(f"      url: {url}")
            print(f"      text: {text}...")


if __name__ == "__main__":
    main()

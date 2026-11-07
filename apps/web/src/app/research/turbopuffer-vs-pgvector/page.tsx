import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/turbopuffer-vs-pgvector'

export const metadata: Metadata = {
  title: 'Turbopuffer vs pgvector: The Speed Claim We Got Wrong',
  description: 'We benchmarked Turbopuffer against pgvector on 100 Toronto questions. Quality was a tie. The 20x speed claim was not: our index had never been used.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Turbopuffer vs pgvector: The Speed Claim We Got Wrong', description: 'Same answer quality. The 20x speed claim was measured against an unindexed Postgres table, and is corrected here.', url: PAGE_URL },
}

const FAQS = [
  {
    question: 'What is Turbopuffer and why did you test it?',
    answer:
      'Turbopuffer is an object-storage-native vector search engine: it keeps its data in cloud object storage with a memory and SSD cache in front, which makes it cheap to run at scale. We test our retrieval on Postgres with the pgvector extension, and it works well, but Postgres runs on a shared VPS that keeps running low on memory, and the vector index is one of the heavier things on that box. We wanted to know whether a purpose-built vector database could do the same job faster and off the server.',
  },
  {
    question: 'Did Turbopuffer give better answers than pgvector?',
    answer:
      'No, and we did not expect it to. Answer quality was a tie. Across 100 questions scored by a neutral judge, pgvector and Turbopuffer landed within about one point of each other on every dimension (relevance, completeness, groundedness, citation). Turbopuffer vector search even returned 97 percent of the same chunks as pgvector, so the answers came from the same evidence. The win was not quality, it was speed.',
  },
  {
    question: 'How much faster was Turbopuffer?',
    answer:
      'Not 20 times, which is what this article originally said. That figure compared Turbopuffer against a pgvector setup whose index was never being used. The corpus had outgrown how the index was built, the query planner had quietly stopped choosing it, and every search was reading all 58,000 rows. Rebuilt and tuned in September 2026, pgvector answers in about 35 milliseconds at the median against Turbopuffer 28, measured on a later 300-page retrieval eval. Turbopuffer still wins on worst case, where it is roughly four times tighter, and it does the work off our own server.',
  },
  {
    question: 'What was wrong with the original speed comparison?',
    answer:
      'The pgvector side had no working index. Our vector index was created when the corpus held a few thousand chunks and was built with 20 lists, which is a reasonable choice at that size. The corpus grew to 58,000 chunks and nobody revisited it. At that size each list held about 2,900 vectors, so a search had to read roughly half of a 226 MB index on a server with about 1.2 GB of free memory, and Postgres correctly decided a full table scan was cheaper. It was: forcing the index took 12.5 seconds against under a second for the scan. Postgres counts index use, and the counter for that index read 1, which was our own diagnostic query. It had never once been used to answer a real question. The 520 millisecond figure in this article was a sequential scan over the whole table.',
  },
  {
    question: 'Did the knowledge graph (GraphRAG) help?',
    answer:
      'No. Turning the graph layer on moved the average scores by about a hundredth of a point, which is inside the judge noise. We even sliced the results by category to check the building-permit and process questions, where an earlier test of ours had seen the graph help. It did not help there either. The likely reason is that our retrieval has improved enough since that earlier test that there is no gap left for the graph to fill.',
  },
  {
    question: 'Why did hybrid search do worse?',
    answer:
      'Hybrid search adds keyword (BM25) matching on top of vector search and fuses the two result sets. On our content it hurt citation quality, dropping from about 0.955 to 0.86, and it only overlapped the pure-vector results by 36 percent. The keyword half pulled in chunks that matched words but cited poorly. For a system where every answer must cite an official source, that is the wrong trade.',
  },
  {
    question: 'Does moving to Turbopuffer keep the data in Canada?',
    answer:
      'Yes. Turbopuffer runs a Toronto region, so the vectors and their text stay on Canadian soil. That matters to us because Canadian data residency is a long-term goal for the project, and it is one reason we were comfortable moving this layer off our own server.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'At our scale (tens of thousands of chunks) the usage is tiny, so the launch-tier minimum of about 16 US dollars per month dominates the bill. pgvector has no separate line item, but it costs memory and disk on a VPS that was already running out of both. So the real comparison is not dollars against dollars. It is roughly 16 dollars a month to move vectors off a memory-starved box and get much tighter worst-case latency. It is not, as this article originally claimed, 16 dollars for a 20x speedup.',
  },
]

export default function Page() {
  return (
    <BlogPost title="Turbopuffer vs pgvector: The Speed Claim We Got Wrong" description="We benchmarked Turbopuffer against our pgvector setup on 100 Toronto questions. Answer quality was a tie. The 20x speed claim was wrong, and is corrected here." date="2026-07-31" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <p>
        Our retrieval runs on Postgres with the pgvector extension, and it works. But
        Postgres sits on a shared VPS that keeps running low on memory, and the vector
        index is one of the heavier tenants on that box. So we asked a simple question:
        could a purpose-built vector database do the same job faster, cheaper, and off
        the server that keeps running out of RAM?
      </p>
      <p>
        We tested Turbopuffer, an object-storage-native vector search engine, against
        our pgvector setup. Same 100-question benchmark across 16 categories of
        Toronto.ca, same embeddings, same generation model, scored by a neutral judge
        from a different model family. Six configurations in all: pgvector and
        Turbopuffer, each with and without our graph layer, plus a Turbopuffer hybrid
        mode that adds keyword search. Retrieval was the only thing that changed.
      </p>

      <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong>Correction, 6 September 2026.</strong> This article originally reported that Turbopuffer retrieved
          about 20 times faster than pgvector, and said so in its title. The quality finding stands, and so does the
          97 percent chunk overlap. The speed comparison does not. The pgvector side had no working index: it was built
          with 20 lists when the corpus held a few thousand chunks, the corpus grew to 58,000, and Postgres quietly
          stopped choosing an index that had become more expensive than reading the whole table. Its usage counter read
          1, and that one use was our own diagnostic query in September. The 520 milliseconds below is a sequential
          scan over all 58,000 rows, not pgvector doing vector search. Rebuilt and tuned, pgvector runs the same class
          of query in about 35 milliseconds at the median against Turbopuffer 28. The section below the table has the
          detail.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Config</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Relevance</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Grounded</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Citation</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Latency</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Same chunks</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['pgvector (index unused, see correction)', '0.955', '0.955', '0.930', '~520ms', 'baseline', false],
              ['Turbopuffer vector', '0.950', '0.965', '0.955', '24ms', '97%', true],
              ['Turbopuffer hybrid', '0.955', '0.935', '0.860', '168ms', '36%', false],
            ].map(([config, rel, grnd, cite, lat, overlap, selected]) => (
              <tr key={config as string} className={`border-t border-zeever-accent/10 ${selected ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{config as string}{selected ? <span className="text-xs text-zeever-primary ml-1">(selected)</span> : null}</td>
                <td className="px-3 py-2 text-center">{rel as string}</td>
                <td className="px-3 py-2 text-center">{grnd as string}</td>
                <td className="px-3 py-2 text-center">{cite as string}</td>
                <td className="px-3 py-2 text-center">{lat as string}</td>
                <td className="px-3 py-2 text-center">{overlap as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        Judge scores are averages over 100 questions, each from 0 to 1. Latency is the
        median retrieval time. &ldquo;Same chunks&rdquo; is the overlap with what
        pgvector retrieved for the same question. The pgvector latency is a sequential
        scan, for the reason given in the correction above; the quality columns are
        unaffected, because a sequential scan is exact search and returns the right
        rows, just slowly.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The short version</h2>
      <p>
        Quality was a tie. Every vector configuration scored between 0.93 and 0.97 on
        every judge dimension, close enough to sit inside the judge&rsquo;s own margin
        of error, and Turbopuffer vector search returned 97 percent of the same chunks
        as pgvector. Both backends were finding the same evidence. That part of this
        article has held up under everything we have measured since.
      </p>
      <p>
        The speed half was wrong, and it was wrong in an instructive way. We were not
        comparing two vector indexes. We were comparing a vector index against a
        Postgres table with no usable index at all, which answers every query by
        reading all 58,000 rows and comparing each one. That is exact search, so it
        returns the right chunks, which is why nothing in the quality columns looked
        unusual and why the error survived for two months. It is simply slow.
      </p>
      <p>
        Measured properly, the gap is roughly 35 milliseconds against 28. Turbopuffer
        is still ahead at the tail, where its 95th percentile is about four times
        tighter, and it still runs off a server that has too little memory. Those are
        real reasons. A 20x speedup was not one of them.
      </p>
      <p className="text-sm text-gray-500">
        Two numbers for pgvector appear in this article and they measure different
        things. The database executes the search itself in about 5 milliseconds, which
        is what Postgres reports for the query plan. The application sees about 35,
        because it also encodes a 768-dimension vector into the request, waits on a
        connection from the pool, joins the chunk back to its page and reads the text
        out. We quote the 35, because that is the number a person waiting for an answer
        actually pays, and it is what the 28 for Turbopuffer is measured the same way
        against.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The graph added nothing</h2>
      <p>
        We layer a knowledge graph on top of retrieval, pulling in entities and
        relationships connected to the retrieved chunks. Turning it on moved the
        average scores by about a hundredth of a point, well inside the noise, on both
        pgvector and Turbopuffer. That matches an earlier finding of ours, but this
        time we went further and sliced the scores by category to check the
        building-permit and process questions, the exact place an earlier test had seen
        the graph help. It did not help there either. Building-permit questions scored
        0.979 with and without the graph.
      </p>
      <p>
        The reason is encouraging: our plain retrieval has improved enough since that
        earlier test that there is no gap left for the graph to fill. When the baseline
        was weaker, structured graph context helped patch the holes. Now the holes are
        mostly gone, and the graph is carrying cost (one extraction pass per chunk) and
        latency (a graph lookup per query) for no measurable gain.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Hybrid search made citations worse</h2>
      <p>
        Turbopuffer also does hybrid search, combining vector similarity with keyword
        (BM25) matching. On our content it was a net loss. Citation quality fell from
        about 0.955 to 0.86, groundedness slipped, and it overlapped the pure-vector
        results by only 36 percent. The keyword half kept pulling in chunks that matched
        the words in the question but did not cite an official source cleanly. For a
        system whose whole promise is that every answer points back to Toronto.ca, that
        is the wrong trade. We stayed with pure vector.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Cost, and where the data lives</h2>
      <p>
        At our scale, tens of thousands of chunks, Turbopuffer usage is small enough
        that the launch-tier minimum of about 16 US dollars a month is effectively the
        whole bill. pgvector has no separate invoice, but it costs memory and disk on a
        VPS that was already running out of both. So the honest framing is not dollars
        against dollars. It is roughly 16 dollars a month to move vectors off a
        memory-starved box and get worst-case latency about four times tighter. When
        this article was written we thought we were also buying a 20x speedup. We were
        not, and the money is still defensible without it, which is worth saying
        plainly rather than quietly restating the price.
      </p>
      <p>
        There was one more reason we were comfortable making the move. Turbopuffer runs
        a Toronto region, so the vectors and their text stay on Canadian soil. Canadian
        data residency is a long-term goal for this project, and it is unusual to get
        that from a hosted vector database.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">How we shipped it</h2>
      <p>
        We did not flip a switch in production. We staged it. New content now writes to
        both stores at once, so pgvector stays current as a fallback. Reads are gated by
        a config flag that defaults to pgvector, and the Turbopuffer path falls back to
        pgvector automatically if anything goes wrong. Once we flip the flag and watch
        the latency drop with no fallback errors, Turbopuffer is live, and pgvector is
        still there for an instant rollback. Only later, once we trust it, do we drop
        the pgvector index and actually reclaim the memory. That last step is where the
        server pressure finally eases.
      </p>
      <p>
        We have since abandoned that last step. The plan to drop the pgvector index was
        written when we believed pgvector was 20 times slower; it was really an
        unindexed table. A working pgvector index costs 38 MB, and it is the only path
        that keeps this capability on hardware we control. Deleting it would have
        removed the sovereign option at the moment it became viable.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Methodology</h2>
      <p>
        Six retrieval configurations ran against the same 100 benchmark questions.
        Every configuration used the same Nomic query embedding, the same top-5 chunk
        limit, the same generation model (Qwen2.5-7B), and the same judge
        (Llama-3.3-70B, from a different family than any model under test, to avoid
        self-scoring bias). We mirrored the exact pgvector chunks into Turbopuffer and
        reused their existing embeddings, so nothing about the content or the vectors
        changed between backends. Retrieval was the only variable.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Limitations</h2>
      <p>
        The quality differences between configurations are small, often a hundredth or
        two, which is inside the noise of a single judge. We would not read the exact
        ranking as gospel. One finding is robust and has survived everything we have
        measured since: none of the alternatives beat pure vector on quality. The speed
        finding did not survive, for the reason given in the correction above, and at
        the median the two backends are close to a wash. One more signal worth naming: many categories scored a perfect 1.000
        on both backends, which means the benchmark is getting close to too easy for
        these models. That caps what any retrieval change can demonstrate, and it tells
        us the next useful step is a harder set of questions.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Frequently asked questions</h2>
      <div className="space-y-4 mt-2">
        {FAQS.map((faq) => (
          <details key={faq.question} className="group" open>
            <summary className="text-sm font-semibold text-zeever-text cursor-pointer list-none flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {faq.question}
            </summary>
            <p className="text-sm text-gray-700 leading-relaxed pl-6 pt-1">{faq.answer}</p>
          </details>
        ))}
      </div>
    </BlogPost>
  )
}

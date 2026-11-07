import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/the-index-that-was-never-used'

export const metadata: Metadata = {
  title: 'Our Vector Index Had Never Been Used Once',
  description: 'For months every search read all 58,000 rows. The answers stayed correct, which is why nobody noticed, and it wrecked a vector database comparison.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Our Vector Index Had Never Been Used Once', description: 'Every search read all 58,000 rows for months. The answers were correct the whole time, which is exactly why nobody noticed.', url: PAGE_URL },
}

const FAQS = [
  {
    question: 'How can a Postgres index be present but never used?',
    answer: 'The query planner compares the estimated cost of using it against the cost of reading the table. An ivfflat index built with too few lists becomes expensive to scan as the table grows, and at some size the planner correctly decides a sequential scan is cheaper. Nothing errors and nothing warns. Our index was created with lists = 20 when the corpus held a few thousand chunks; at 58,000 chunks each list held about 2,900 vectors, so ten probes read roughly half of a 226MB index on a server with 1.2GB free.',
  },
  {
    question: 'Why did nobody notice for months?',
    answer: 'Because a sequential scan is exact search. It compares the query against every row and returns the genuinely closest matches, so the answers were correct, the citations were correct, and every quality metric looked normal. The only symptom was time, and it was hidden inside a language model call that takes several seconds anyway. A bug that produces right answers slowly is far harder to see than one that produces wrong answers.',
  },
  {
    question: 'How do you check whether your own vector index is being used?',
    answer: 'Two queries. Read pg_stat_user_indexes for the index and look at idx_scan, which counts lifetime uses; ours read 1, and that one was our own diagnostic. Then run EXPLAIN ANALYZE on the query your application actually issues, with the vector bound as a parameter, and check the plan says Index Scan rather than Seq Scan. Do not test with a hand-written query: a scalar subquery for the vector produces a different plan shape than a bound parameter does.',
  },
  {
    question: 'What did fixing the index change?',
    answer: 'Server-side search time went from 575 to 845 milliseconds for a sequential scan to about 5 milliseconds for an index scan. Recall fell from 58.2 to 53.1 percent, because approximate search is not exact search, and a sweep of the probes setting recovered that to 57.1 percent at 35 milliseconds end to end. Against the exact scan that is three pages in 295, statistically indistinguishable.',
  },
  {
    question: 'Does this mean the Turbopuffer comparison was wrong?',
    answer: 'The speed half of it, yes. We reported Turbopuffer as about 20 times faster than pgvector, which compared it against a table with no working index rather than against pgvector. Measured properly the gap is 28 milliseconds against 35 at the median, and a paired test over 296 questions cannot distinguish their recall at all. That article now carries a correction, and we are moving retrieval back to Postgres.',
  },
]

export default function Page() {
  return (
    <BlogPost title="Our Vector Index Had Never Been Used Once" description="For months every search read all 58,000 rows. The answers were correct the whole time, which is why nobody noticed." date="2026-09-08" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="bg-zeever-primary/5 border border-zeever-primary/20 rounded-xl p-5 mb-2">
        <p className="text-sm font-semibold text-zeever-text mb-2">Key finding</p>
        <p className="text-sm text-gray-700">
          Postgres counts how many times each index is used. Ours read 1, and that
          one use was the diagnostic query we ran while investigating. Every search
          this site had ever performed read all 58,022 rows and compared each one.
          The answers were right every time, which is precisely why it went
          unnoticed.
        </p>
      </div>

      <p>
        We spent a week comparing vector databases. We tested pgvector, Turbopuffer,
        pgvectorscale and HNSW, on the same questions and the same pages, and every
        comparison came back a tie inside the noise. That result was suspicious enough
        to keep pulling at, and pulling at it turned up something better than a winner.
      </p>
      <p>
        We asked Postgres to explain how it was running our search. It answered with a
        sequential scan over 58,022 rows, taking between 575 and 845 milliseconds. The
        vector index was sitting right there in the table definition.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The planner was right</h2>
      <p>
        The obvious reaction is that the query planner made a mistake. It did not. We
        forced it to use the index and timed the result: <strong>12.5 seconds</strong>,
        against 0.6 for reading the whole table. Refusing that index was the correct
        decision, made correctly, every time, for months.
      </p>
      <p>
        The index was created with 20 lists, which is a reasonable choice for a few
        thousand vectors. The corpus grew to 58,000 and nobody revisited the number. At
        that size each list holds about 2,900 vectors, so the ten probes our retriever
        requests have to read roughly half of a 226MB index, in random order, on a
        virtual server with about 1.2GB of free memory. It thrashes. A linear read of
        the table is genuinely cheaper.
      </p>
      <p>
        Then we looked at the usage counter, which is the moment the whole thing became
        clear:
      </p>
      <pre className="bg-gray-50 border border-zeever-accent/20 rounded-xl p-4 text-xs overflow-x-auto text-gray-700">{`      indexrelname       | idx_scan | idx_tup_read
-------------------------+----------+--------------
 document_chunks_pkey    |   262163 |     47091581
 idx_chunks_embedding    |        1 |            5`}</pre>
      <p>
        One lifetime scan of the vector index, five rows read. That was our own
        diagnostic, minutes earlier. The index had never once answered a question from
        a resident.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why a bug this large can hide</h2>
      <p>
        Because a sequential scan is exact search. It compares the question against
        every chunk in the corpus and returns the genuinely closest ones. The answers
        were correct. The citations were correct. Our quality evaluations, which score
        relevance and groundedness, saw nothing wrong, because nothing was wrong with
        the output.
      </p>
      <p>
        The only symptom was time, and time is exactly where this system hides its
        costs. A retrieval taking 300 milliseconds instead of 5 disappears inside a
        language model call that takes several seconds. Nobody watching the site would
        feel it. Nobody reading the logs would question it.
      </p>
      <p>
        A bug that returns wrong answers gets found in an afternoon. A bug that returns
        right answers slowly can live for months, and this one did.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What it cost us</h2>
      <p>
        Not the milliseconds. What it cost was a decision.
      </p>
      <p>
        In July we published a comparison finding Turbopuffer, a hosted vector database,
        about 20 times faster than pgvector at equal answer quality, and we moved our
        retrieval onto it. The measurement was real. It was also not a measurement of
        pgvector: 520 milliseconds was a sequential scan over the whole table. We had
        compared a purpose-built vector database against a database with no working
        index, and then made an architecture decision on the result.
      </p>
      <p>
        With the index rebuilt at 240 lists and its probes setting swept, the honest
        comparison looks like this:
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Store</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Recall@5</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Median</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">95th percentile</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Turbopuffer (hosted)', '58.1%', '28ms', '35ms'],
              ['pgvector, index working', '57.1%', '35ms', '125ms'],
              ['pgvector, index unused', '58.3%', '295ms', '350ms'],
            ].map(([store, recall, p50, p95]) => (
              <tr key={store} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{store}</td>
                <td className="px-3 py-2 text-center">{recall}</td>
                <td className="px-3 py-2 text-center">{p50}</td>
                <td className="px-3 py-2 text-center">{p95}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        The third row scores highest on recall because a sequential scan is exact. It
        is the ceiling, not a competitor.
      </p>
      <p>
        Seven pages out of 296 disagree between the first two rows, which a paired
        statistical test cannot separate from chance. Stronger still: of the 167 pages
        both stores found, every single one came back at the same rank. They are not
        merely scoring alike, they are returning the same ordering.
      </p>
      <p>
        So we are moving retrieval back to Postgres. The remaining advantage of the
        hosted service is its tail, 35 milliseconds against 125 at the 95th percentile,
        which is real and which we are trading for keeping this capability on hardware
        we control. Ninety milliseconds at the 95th percentile, against an answer that
        takes several seconds to write, is not worth an external dependency for a
        project whose point is partly that this can be run without one.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">How to check your own</h2>
      <p>
        Two queries, and the first takes seconds.
      </p>
      <p>
        Read the usage counter. <code className="text-sm bg-gray-50 px-1 rounded-sm">
        pg_stat_user_indexes</code> carries an <code className="text-sm bg-gray-50 px-1 rounded-sm">
        idx_scan</code> column counting lifetime uses of each index. If the number
        beside your vector index is small while your application has served thousands
        of queries, it is not being used, whatever the table definition says.
      </p>
      <p>
        Then run <code className="text-sm bg-gray-50 px-1 rounded-sm">EXPLAIN ANALYZE</code> on
        the query your application actually issues, with the vector bound as a
        parameter rather than written into the statement. That distinction matters: a
        hand-written test query using a subquery to fetch a vector produces a different
        plan shape than your application&rsquo;s bound parameter does, and can send you
        looking in the wrong place. Check the plan says Index Scan.
      </p>
      <p>
        And if you take one thing from this: the parameters that govern an approximate
        index are only meaningful relative to the size of your data. Ours was correct
        when it was written and became wrong without changing, because the corpus grew
        underneath it. Nothing in Postgres will tell you the day that happens.
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

      <p className="text-sm text-gray-500 pt-4">
        The corrected original is at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/turbopuffer-vs-pgvector">
          Turbopuffer vs pgvector
        </a>
        . A different measurement of ours that failed the same way, by comparing
        against a component that was not doing the work it appeared to be doing, is at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/what-my-gpu-benchmark-was-hiding">
          My GPU Benchmark Was Measuring a Cold Model
        </a>
        .
      </p>
    </BlogPost>
  )
}

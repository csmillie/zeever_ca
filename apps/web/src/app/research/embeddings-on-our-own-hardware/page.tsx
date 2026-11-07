import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/embeddings-on-our-own-hardware'

export const metadata: Metadata = {
  title: 'The Smaller Card Won Again',
  description: 'We moved our embeddings off a US provider onto our own GPUs. The 8GB NVIDIA card beat the 20GB AMD one again, and the move surfaced a months-old bug.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'The Smaller Card Won Again', description: 'An 8GB RTX 3070 beat a 20GB RX 7900 XT at embeddings, and moving the work in-house surfaced a chunker bug nothing could have seen.', url: PAGE_URL },
}

const FAQS = [
  {
    question: 'Why is the embedding call so important to a RAG site?',
    answer: 'Because it runs before anything else can. A question has to become a vector before the database can be searched for matching passages, and on our site it also has to happen before the semantic cache can be consulted, since the cache is keyed on the question vector itself. That ordering means an embedding provider being unreachable is not a slow site, it is every question failing, including the ones whose answers were already computed and stored. The generation model can fail over to another provider; until this change, the embedding call had nowhere to go.',
  },
  {
    question: 'Can you switch embedding providers without rebuilding the index?',
    answer: 'Only if the new provider runs the same model weights. Vectors from different embedding models are not comparable, so changing model normally means re-embedding the entire corpus. We were moving between two deployments of nomic-embed-text-v1.5, so we measured rather than assumed: vectors from our self-hosted copies agreed with the hosted provider at cosine 0.99994 or better, against 0.52 for two unrelated pages. Same weights, same vector space, no reindex.',
  },
  {
    question: 'Why did the 8GB NVIDIA card beat the 20GB AMD card?',
    answer: 'Because the embedding model is small enough that memory bandwidth stops being the constraint. The AMD RX 7900 XT moves data at 800GB/s against the RTX 3070 at 448, and that advantage decides things when a 13GB language model has to be read for every token generated. The embedding model is 274MB in F16. Nothing is waiting on memory, so what remains is how efficiently each card converts its throughput into finished work, and in our earlier measurements the NVIDIA card converted 89 percent of its theoretical bandwidth against AMD 75 percent.',
  },
  {
    question: 'What is the risk of running embeddings on a self-hosted model?',
    answer: 'Silent truncation. Ollama caps embedding input at 2,048 tokens and does not warn when text exceeds it — it returns a well-formed 768-dimension vector for the first 2,048 tokens. That vector is not a worse match for the document, it is a vector for a different document; we measured 0.53 cosine against the untruncated version, which is what two unrelated pages score. Nothing about the result looks wrong from the outside, so the check has to happen before the call, not after it.',
  },
  {
    question: 'How much did this save?',
    answer: 'Less than the effort, if money were the point. Our embedding spend ran to roughly 26 million tokens across the life of the project, which is a few dollars at current rates. What it actually bought was the elimination of the last external dependency in the answer path, a provider whose latency varied between 172 and 331 milliseconds replaced by one that varies between 81 and 87, and the discovery of a chunking bug that had been quietly producing unsearchable content.',
  },
]

export default function Page() {
  return (
    <BlogPost title="The Smaller Card Won Again" description="We moved our embeddings onto our own GPUs. The 8GB NVIDIA card beat the 20GB AMD one, and the move surfaced a bug that had been writing unsearchable chunks for months." date="2026-09-19" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="bg-zeever-primary/5 border border-zeever-primary/20 rounded-xl p-5 mb-2">
        <p className="text-sm font-semibold text-zeever-text mb-2">Key finding</p>
        <p className="text-sm text-gray-700">
          An 8GB RTX 3070 embeds faster than a 20GB RX 7900 XT with nearly twice its
          memory bandwidth: 56.3 chunks per second against 48.9, and 84 milliseconds
          per query against 99. It is the third time the smaller card has won a
          measurement here, and the reason is the same each time.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The call that runs before everything else</h2>
      <p>
        Most descriptions of a retrieval-augmented site put the language model at the
        centre, because that is the part that writes sentences. The embedding step gets
        a clause. It converts text into a list of numbers so that passages can be
        compared by meaning rather than by keyword, and then the interesting part
        begins.
      </p>
      <p>
        That description is accurate and it badly understates the dependency. On this
        site the embedding call is the first thing that happens to a question and
        nothing can proceed without it. The question has to become a vector before the
        database can be asked which passages are relevant. It also has to become a
        vector before we can check whether we have answered this question before,
        because our cache matches on the meaning of a question rather than its exact
        wording, and the key it matches on <em>is</em> the vector.
      </p>
      <p>
        So the cache cannot save you from an embedding outage. An answer can be sitting
        in the database, complete and correct, and still be unreachable, because the
        lookup that would find it needs the call that just failed.
      </p>
      <p>
        We had a fallback chain four providers deep for generation. For embeddings we
        had one US provider and no second option. The most load-bearing call in the
        system was the only one with nowhere to go.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Moving it in-house without rebuilding anything</h2>
      <p>
        We run two machines with consumer GPUs, already serving the language models
        behind the site. The embedding model we pay for, nomic-embed-text-v1.5, is
        open-weight and about 274 megabytes. There was no technical reason it could not
        run beside them.
      </p>
      <p>
        The obstacle was the 57,400 vectors already in our database. Vectors produced by
        different embedding models cannot be compared to each other, so switching models
        normally means re-embedding the entire corpus before anything works. We were not
        switching models, only deployments of the same model, but that is exactly the
        kind of assumption worth checking rather than believing.
      </p>
      <p>
        So we embedded the same passages both ways and compared:
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Comparison</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Cosine similarity</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Our hardware vs the hosted provider', '0.99994 – 1.0000'],
              ['One card vs the other', '0.999988'],
              ['Two unrelated Toronto pages, for scale', '0.52'],
            ].map(([what, score]) => (
              <tr key={what} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{what}</td>
                <td className="px-3 py-2 text-center">{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        The third row is the control. Without it, 0.9999 is a number with no scale
        attached to it.
      </p>
      <p>
        Same weights, same vector space. The stored vectors stayed valid, no reindex was
        needed, and the two sources can even be mixed within a single crawl without
        splitting the corpus into two coordinate systems that cannot see each other.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Then the benchmark, which went the wrong way again</h2>
      <p>
        We have two cards. The sensible expectation was that the larger one would win
        and the question was only by how much.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Where the work runs</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Bulk</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">One question</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Spread</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Hosted provider (what we replaced)', '25.1/s', '270ms', '172 – 331ms'],
              ['AMD RX 7900 XT, 20GB, 800GB/s', '48.9/s', '99ms', '98 – 107ms'],
              ['NVIDIA RTX 3070, 8GB, 448GB/s', '56.3/s', '84ms', '81 – 87ms'],
            ].map(([where, bulk, one, spread]) => (
              <tr key={where} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{where}</td>
                <td className="px-3 py-2 text-center">{bulk}</td>
                <td className="px-3 py-2 text-center">{one}</td>
                <td className="px-3 py-2 text-center">{spread}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        Bulk is 200 distinct passages from our own corpus in batches of 50, which is how
        the crawler sends them. Both cards warmed first, after learning the hard way
        that a cold model under-reports.
      </p>
      <p>
        The smaller card won both measurements. It has 40 percent of the memory and 56
        percent of the bandwidth of the card it beat.
      </p>
      <p>
        This is the third time we have measured these two against each other and the
        third time the result has been counter to the specifications, so at this point
        the surprise is not that it happened but that we keep expecting otherwise.
      </p>
      <p>
        The explanation is the same one each time, and it is not that the AMD card is
        bad. Generating text is memory-bound: every token requires reading the whole
        model, so a card that moves data faster produces tokens faster, and the 7900 XT
        duly wins that contest. Our earlier work found it converts about 75 percent of
        its theoretical bandwidth into tokens where the 3070 manages 89 percent, but 75
        percent of 800 still beats 89 percent of 448.
      </p>
      <p>
        Embedding is not that shape of problem. The model is 274 megabytes. It fits
        comfortably in cache, there is no token-by-token loop, and each call is a single
        forward pass. Nothing waits on memory, so the bandwidth advantage never appears
        and the efficiency gap decides the outcome by itself.
      </p>
      <p>
        Which is worth stating plainly, because &ldquo;bigger card, better performance&rdquo;
        is a reasonable heuristic that happens to be wrong for this workload: the specification
        that decides one job on a GPU can be irrelevant to the next one.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Giving the small card a job</h2>
      <p>
        The larger card runs the model that writes answers and it will keep doing so —
        20GB of memory is exactly what a 13GB language model needs, and the 3070 cannot
        hold one. The smaller card had been sitting as a fallback that had served no
        production traffic in months.
      </p>
      <p>
        Embeddings now go to it first. It is the faster of the two at this particular
        job, it is otherwise idle, and the model needs 274MB of the 8GB it has.
      </p>
      <p>
        We expected the stronger argument to be contention — that a full recrawl
        hammering the same card the site answers from would make the site slow. We
        measured that too, and it is true but small:
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">While answering a question</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Time to answer</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Nothing else running', '1.02s'],
              ['Recrawl embedding on the same card', '1.12s'],
              ['Recrawl embedding on the other card', '1.00s'],
            ].map(([what, time]) => (
              <tr key={what} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{what}</td>
                <td className="px-3 py-2 text-center">{time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A hundred milliseconds. Real, worth having, and not the reason. We had assumed
        it would be the headline and the measurement demoted it to a footnote, which is
        the ordinary outcome of measuring something you were about to assert.
      </p>
      <p>
        The actual reason is that two cards each doing one job can each cover for the
        other. Embeddings try the NVIDIA card, then the AMD card, then the hosted
        provider we used to depend on. The call that had no fallback now has two.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Sixteen seconds of patience in the wrong place</h2>
      <p>
        The first live test of that chain worked and took sixteen seconds to do it.
      </p>
      <p>
        The retry logic was written for a different failure. In September a crawl died
        forty minutes in because a provider dropped a connection, so retries back off
        and wait — one second, two, four, eight — on the reasonable theory that
        something briefly overloaded will recover if given a moment.
      </p>
      <p>
        A machine that is switched off refuses in a millisecond and will not recover in
        sixteen seconds. Spending that patience in front of a fallback that is sitting
        right there, on the one call that blocks every question on the site, is close to
        the worst place to spend it.
      </p>
      <p>
        Now patience goes where it pays: two quick attempts when there is somewhere else
        to go, the full sequence on the last option, where giving up early means giving
        up. Failover went from sixteen seconds to four.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The bug we would not have found otherwise</h2>
      <p>
        Self-hosting has a constraint the hosted provider does not: Ollama caps
        embedding input at 2,048 tokens, where the provider accepts 8,192.
      </p>
      <p>
        It does not warn you. Send it 3,000 tokens and it returns a well-formed
        768-dimension vector, indistinguishable from any other, built from the first
        2,048. That is not a slightly worse match for your document. It is a vector for
        a different document. We measured a truncated passage against its untruncated
        version at 0.53 cosine — the same score two unrelated pages get.
      </p>
      <p>
        Checking how much of our corpus this would affect turned up something we were
        not looking for. Our chunker is configured to produce passages of about 500
        tokens. The corpus contained chunks of <strong>7,239</strong>.
      </p>
      <p>
        The cause was a gap in the splitting logic. Text is divided at blank lines, and
        any resulting piece larger than the limit was supposed to be subdivided — but a
        single paragraph with no blank line in it was passed through whole, never split.
        Toronto.ca has plenty of those: fee tables, eligibility lists, schedules that
        render as one continuous block.
      </p>
      <p>
        This had been harmless for as long as we sent those chunks somewhere that
        accepted 8,192 tokens. It was one configuration change away from silently
        corrupting a portion of the index, in the specific way that produces no error
        and no visible symptom — the passages would still be there, still returned by
        searches, describing content they no longer contained.
      </p>
      <p>
        Both halves are now fixed: oversized paragraphs are split at sentence
        boundaries, and the embedding call refuses text over the limit instead of
        sending it. Notably it refuses rather than quietly using the provider with the
        larger window, which would work and would hide a chunking bug behind a bill.
      </p>
      <p>
        We have written before about how the worst bugs here are the ones that produce
        correct-looking output. An index that had never been used still returned right
        answers. A GPU benchmark measuring a cold model still produced plausible
        numbers. A truncated embedding is the same family: everything downstream
        continues to work, and the only sign is that retrieval gets quietly worse in a
        way no test asserts against.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What it adds up to</h2>
      <p>
        Embeddings were the last inference this project paid for and the last call that
        left the country. Both are now gone, which matters more to us than the money,
        since the money was a few dollars across the life of the project.
      </p>
      <p>
        What we gained that is measurable: embedding is about twice as fast as the
        provider it replaced and far more consistent — 81 to 87 milliseconds against 172
        to 331. Rebuilding the whole corpus takes 17 minutes instead of 38. And the
        single most load-bearing call in the system finally has a fallback, tested by
        switching a host off and watching the next one take over.
      </p>
      <p>
        What we gained that is harder to count: an old bug found, because a new
        constraint made visible something a generous limit had been hiding. That keeps
        happening. Constraints are not only costs.
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
        The earlier measurements of these two cards are at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/local-ollama-benchmark">
          Benchmarking Local Inference
        </a>{' '}
        and{' '}
        <a className="text-zeever-primary hover:underline" href="/research/what-my-gpu-benchmark-was-hiding">
          My GPU Benchmark Was Measuring a Cold Model
        </a>
        . The other bug that produced correct-looking output for months is at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/the-index-that-was-never-used">
          Our Vector Index Had Never Been Used Once
        </a>
        .
      </p>
    </BlogPost>
  )
}

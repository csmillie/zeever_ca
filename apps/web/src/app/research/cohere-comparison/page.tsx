import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/cohere-comparison'

export const metadata: Metadata = {
  title: 'Does Proprietary Beat Open? Cohere Command on City RAG',
  description: 'We put Cohere\'s three Command models against our open-source Qwen2.5-7B baseline on 100 Toronto questions. Quality was a wash and the open model held up.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Does Proprietary Beat Open? Cohere Command on City RAG', description: 'Cohere Command vs our open Qwen baseline on 100 Toronto questions. The open model held its ground.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Does Proprietary Beat Open? Cohere Command on City RAG" description="We put Cohere's three Command models against our open-source Qwen2.5-7B baseline on 100 Toronto questions, scored by a neutral judge." date="2026-07-28" url={PAGE_URL}>
      <p>
        Our seven-model comparison from March promised two follow-ups: rerun the
        benchmark at full scale, and stop letting a model grade its own homework.
        This post does both. It also answers a question we kept getting asked. Would
        a model built specifically for retrieval, like Cohere&apos;s Command family,
        beat a small general-purpose open model on city government content?
      </p>
      <p>
        We put Cohere&apos;s three Command models against Qwen2.5-7B, our current
        default, on all 100 benchmark questions across 16 categories of Toronto.ca.
        Every model received the same retrieved context, so the only variable was
        the generation step. A neutral judge scored every answer on four dimensions.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Relevance</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Complete</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Grounded</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Citation</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Latency</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Cost</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Qwen2.5-7B', '0.96', '0.93', '0.97', '0.95', '1.8s', '$0.089', true],
              ['Command R7B', '0.97', '0.95', '0.98', '0.94', '3.9s', '$0.015', false],
              ['Command R', '0.96', '0.93', '0.98', '0.91', '3.9s', '$0.053', false],
              ['Command A', '0.92', '0.90', '0.95', '0.95', '4.7s', '$0.932', false],
            ].map(([model, rel, comp, grnd, cite, lat, cost, current]) => (
              <tr key={model as string} className={`border-t border-zeever-accent/10 ${current ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{model as string}{current ? <span className="text-xs text-zeever-primary ml-1">(current default)</span> : null}</td>
                <td className="px-3 py-2 text-center">{rel as string}</td>
                <td className="px-3 py-2 text-center">{comp as string}</td>
                <td className="px-3 py-2 text-center">{grnd as string}</td>
                <td className="px-3 py-2 text-center">{cite as string}</td>
                <td className="px-3 py-2 text-center">{lat as string}</td>
                <td className="px-3 py-2 text-center">{cost as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        Scores are averages over 100 questions, each from 0 to 1. Cost is the total
        for all 100 questions at each model&apos;s published per-token price. Command A
        failed on 3 of the 100 questions, so its scores are averaged over the 97 that
        completed.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The short version</h2>
      <p>
        Quality was a wash. All four models scored between 0.90 and 0.98 on every
        dimension, and the spread across them is small enough to sit inside the
        judge&apos;s own margin of error. Cohere&apos;s retrieval tuning did not open up
        a clear lead over a small general-purpose open model. When the answers all come
        from the same retrieved evidence, the generation step just does not move the
        needle very much.
      </p>
      <p>
        With quality effectively tied, the decision comes down to speed and cost, and
        there the picture is clearer.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Command R7B was the value winner</h2>
      <p>
        Command R7B posted the best composite score of the four and was by far the
        cheapest, at $0.015 for all 100 questions. That is roughly six times cheaper
        than our current Qwen default and about sixty times cheaper than Command A. If
        cost were the only thing we optimized for, it would be an easy pick.
      </p>
      <p>
        The catch is latency. Every Cohere model averaged close to 4 seconds per
        answer, while Qwen came back in 1.8 seconds. For a chat where someone is
        waiting on the other end, half the response time is worth more than a fraction
        of a cent per query.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Command A was the loser</h2>
      <p>
        The flagship was the weakest model in the test. It scored lowest on relevance,
        completeness, and groundedness, was the slowest at 4.7 seconds, cost about ten
        times more than Qwen, and was the only model that failed outright, erroring on
        3 of the 100 questions. Paying the premium for the largest model bought us worse
        answers here, not better ones. On grounded RAG over a fixed corpus, raw model
        size is not the thing that matters.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the scores mean</h2>
      <p>
        Each answer was scored on four dimensions. Relevance measures whether the
        answer directly addresses the question with specific, actionable information.
        Completeness checks whether it covers the concepts the question should touch.
        Groundedness asks whether the claims are supported by the retrieved evidence
        rather than invented. Citation quality evaluates whether the sources cited are
        relevant to the claims made.
      </p>
      <p>
        Groundedness is the one we care about most, because users make real decisions
        about permits, taxes, and city services based on these answers. Every model
        landed at 0.95 or higher there, which is reassuring. The corpus and the
        retrieval step, not the model, are doing most of the work of keeping answers
        honest.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A neutral judge this time</h2>
      <p>
        In our March comparison, the judge model was also one of the models under test,
        which risks a model scoring its own answers too kindly. We fixed that here. The
        judge was Llama-3.3-70B, a model from a different family than anything in the
        lineup, so it had no stake in either the Qwen answers or the Cohere answers. It
        graded all four the same way, blind to which model produced each response.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Limitations</h2>
      <p>
        The differences between the top models are small, often 0.01 to 0.04 on a given
        dimension. Across 100 questions that is inside the noise of a single judge, so
        we would not read the exact ranking as gospel. A second judge, or a human review
        pass, could reshuffle the middle of the table. The headline holds regardless:
        none of the Cohere models pulled decisively ahead of the open baseline.
      </p>
      <p>
        This was also a one-shot run at temperature 0. It measures answer quality on a
        fixed benchmark, not reliability under load, cost at production volume, or how
        each model handles the long tail of weird real questions people actually ask.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why we are staying open</h2>
      <p>
        We have committed from the start to open-source models on infrastructure we can
        move between providers. This test was a genuine check on that principle. If a
        proprietary model had clearly beaten our open default on the quality that
        matters, we would have had a real decision to make.
      </p>
      <p>
        It did not. Qwen2.5-7B is twice as fast as any Cohere model, sits within a
        rounding error of the best quality scores, costs little, and stays open. Command
        R7B is the one result worth remembering, since it matched the field on quality
        for a fraction of the cost, and we would revisit it if cost ever became the
        binding constraint. For now, the open baseline holds, and we are keeping it.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Methodology</h2>
      <p>
        All four models were called at temperature 0. Chunks were retrieved once per
        question and reused for every model, so score differences come purely from the
        generation step. Cohere&apos;s Command models were reached through their
        OpenAI-compatible endpoint, and Qwen ran on Together.ai, the same provider we
        use in production. Cost was calculated from actual token usage at each model&apos;s
        published per-token price. The judge, Llama-3.3-70B on Together.ai, scored every
        answer on the four dimensions above and was independent of all four models under
        test.
      </p>
    </BlogPost>
  )
}

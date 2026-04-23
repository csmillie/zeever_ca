import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/model-comparison'

export const metadata: Metadata = {
  title: 'Comparing 7 Open-Source Models for RAG on City Data',
  description: 'We tested 7 open-source LLMs on 10 Toronto building permit questions. GPT-oss 120B won on relevance and cost. Here are the full results.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Comparing 7 Open-Source Models for RAG on City Data', description: 'GPT-oss 120B won on relevance and cost. Full results from our 7-model comparison.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Comparing 7 Open-Source Models for RAG on City Data" description="We tested 7 open-source LLMs on 10 Toronto building permit questions. GPT-oss 120B won on relevance and cost." date="2026-03-28" url={PAGE_URL}>
      <p>
        We ran 7 open-source models through 10 building permit questions and scored
        them with our LLM-as-judge. Every model got identical retrieved context from
        our permits-only corpus so the only variable was the generation step. We
        wanted the best answer quality at the lowest cost for a system grounded in
        city government content.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Relevance</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Grounded</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Citation</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Latency</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Cost</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['GPT-oss 120B', '0.94', '1.00', '0.83', '5.8s', '$0.006', true],
              ['Kimi K2.5', '0.88', '0.96', '0.96', '6.3s', '$0.041', false],
              ['GLM-5', '0.86', '0.96', '0.92', '9.5s', '$0.031', false],
              ['DeepSeek v3.2', '0.83', '0.96', '0.92', '8.4s', '$0.035', false],
              ['Mixtral 8x22B', '0.82', '0.92', '0.71', '3.9s', '$0.022', false],
              ['GLM-4.7', '0.78', '0.92', '0.86', '17.9s', '$0.010', false],
              ['DeepSeek v3.1', '0.75', '0.88', '0.75', '4.0s', '$0.024', false],
            ].map(([model, rel, grnd, cite, lat, cost, selected]) => (
              <tr key={model as string} className={`border-t border-zeever-accent/10 ${selected ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{model as string}{selected ? <span className="text-xs text-zeever-primary ml-1">(selected)</span> : null}</td>
                <td className="px-3 py-2 text-center">{rel as string}</td>
                <td className="px-3 py-2 text-center">{grnd as string}</td>
                <td className="px-3 py-2 text-center">{cite as string}</td>
                <td className="px-3 py-2 text-center">{lat as string}</td>
                <td className="px-3 py-2 text-center">{cost as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The winner</h2>
      <p>
        GPT-oss 120B came out on top for relevance (0.94), hit perfect groundedness
        (1.00), and was the cheapest option by a wide margin at $0.006 for all 10
        benchmark prompts. That is about 7 times cheaper than the runner-up. Based on
        these results, we made it our default model.
      </p>
      <p>
        Kimi K2.5 had the best citation quality (0.96) but cost 7 times more. DeepSeek
        v3.1, which we originally started with, finished last on judge relevance at 0.75.
        Upgrading from DeepSeek v3.1 to GPT-oss 120B improved relevance by 25%.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the scores mean</h2>
      <p>
        Each answer was scored by an LLM judge on three dimensions. Relevance measures
        whether the answer directly addresses the question with specific, actionable
        information. Groundedness checks whether the claims are supported by the
        retrieved evidence rather than hallucinated. Citation quality evaluates whether
        the sources cited are relevant to the claims made.
      </p>
      <p>
        GPT-oss 120B was the only model to score a perfect 1.00 on groundedness, meaning
        every claim in its answers was supported by the evidence. This matters for a
        system where trust is the priority. Users are making decisions about building
        permits based on these answers, so accuracy is more important than eloquence.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Limitations of this test</h2>
      <p>
        This comparison used only 10 questions, all about building permits, against a
        small subset of Toronto.ca content. A model that handles building permits well
        might struggle with property taxes, recycling rules, or housing questions. We
        plan to rerun this comparison with our expanded 100-question benchmark covering
        all 16 categories of Toronto.ca content.
      </p>
      <p>
        The judge model was GPT-oss 120B itself, which creates a risk of self-evaluation
        bias. A model might score its own answers more favourably than a neutral judge
        would. We plan to test cross-model judging in future work.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Methodology</h2>
      <p>
        All 7 models were accessed through Fireworks.ai on the same OpenAI-compatible
        API. Chunks were retrieved once and reused for every model, so score differences
        come purely from the generation step. Each model received identical context and
        the same 10 questions in the same order. Cost was calculated from actual token
        usage at each model's published per-token price.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-4">Why open-source models only</h3>
      <p>
        We committed early on to using only open-source models hosted on Canadian-friendly
        infrastructure. All inference runs through Fireworks.ai, which provides
        OpenAI-compatible APIs for open models. This keeps us independent from any single
        provider and ensures we can switch models as the field evolves.
      </p>
    </BlogPost>
  )
}

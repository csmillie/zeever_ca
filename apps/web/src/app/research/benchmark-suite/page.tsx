import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/benchmark-suite'

export const metadata: Metadata = {
  title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark',
  description: 'We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories, then tested 9 models. The smallest model won.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: '100 Questions Across Toronto.ca: Building a Comprehensive Benchmark', description: 'From 12 building permit questions to 100 prompts across 16 categories. The smallest model won.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="100 Questions Across Toronto.ca: Building a Comprehensive Benchmark" description="We expanded our evaluation from 12 building permit questions to 100 prompts across 16 categories, then tested 9 models." date="2026-03-31" dateModified="2026-04-02" url={PAGE_URL}>
      <p>
        We started with 12 questions, all about building permits. That worked when
        building permits were all we covered. As we expanded to property taxes, recycling,
        parking, health, recreation, and city government, we needed a benchmark that
        could tell us whether the system actually worked across the full breadth of
        Toronto.ca content.
      </p>
      <p>
        So we wrote 100 questions spanning 16 categories. Every major section of
        Toronto.ca is represented. Each question maps to a real topic a resident
        might ask about, with expected keywords and source URLs so we can score
        answers automatically.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Coverage</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-4 py-2 font-medium text-gray-700">Category</th>
              <th className="text-center px-4 py-2 font-medium text-gray-700">Questions</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Building permits', 12], ['Sign permits', 4], ['Tree & ravine permits', 4],
              ['Zoning', 4], ['Property tax', 8], ['Utility bills', 4],
              ['Business licences', 6], ['Recycling & garbage', 8], ['Streets & parking', 8],
              ['Tickets & fines', 6], ['Water & environment', 6], ['Grants & incentives', 4],
              ['Housing & shelter', 6], ['Health & community', 6], ['Parks & recreation', 8],
              ['City government', 6],
            ].map(([cat, count]) => (
              <tr key={cat as string} className="border-t border-zeever-accent/10">
                <td className="px-4 py-2">{cat as string}</td>
                <td className="px-4 py-2 text-center font-mono">{count as number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Question types</h2>
      <p>
        The benchmark covers seven question patterns that real users ask:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><span className="font-medium">Conditional:</span> &quot;Do I need a permit for...?&quot;</li>
        <li><span className="font-medium">Process:</span> &quot;How do I apply for...?&quot;</li>
        <li><span className="font-medium">Cost:</span> &quot;How much does... cost?&quot;</li>
        <li><span className="font-medium">Location:</span> &quot;Where can I find...?&quot;</li>
        <li><span className="font-medium">Requirements:</span> &quot;What documents do I need?&quot;</li>
        <li><span className="font-medium">Eligibility:</span> &quot;Am I eligible for...?&quot;</li>
        <li><span className="font-medium">Compliance:</span> &quot;What happens if I don&apos;t...?&quot;</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">9-model comparison results</h2>
      <p>
        We ran all 100 questions through 9 open-source models on Fireworks.ai. Every
        model got the same retrieved context for each question so score differences
        come purely from how well the model generates an answer from the evidence.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Relevance</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Citation</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Latency</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Errors</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Qwen3-8B', '0.94', '0.80', '5.7s', '0', true],
              ['Kimi K2.5', '0.89', '0.87', '18.7s', '2', false],
              ['GLM-5', '0.88', '0.82', '8.0s', '0', false],
              ['DeepSeek v3.2', '0.88', '0.81', '7.9s', '3', false],
              ['DeepSeek v3.1', '0.88', '0.82', '9.6s', '0', false],
              ['Mixtral 8x22B', '0.86', '0.81', '4.6s', '0', false],
              ['GLM-4.7', '0.86', '0.84', '17.2s', '0', false],
              ['Llama 3.3 70B', '0.86', '0.81', '3.6s', '0', false],
              ['GPT-oss 120B', '0.82', '0.82', '8.9s', '0', false],
            ].map(([model, rel, cite, lat, errors, selected]) => (
              <tr key={model as string} className={`border-t border-zeever-accent/10 ${selected ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{model as string}{selected ? <span className="text-xs text-zeever-primary ml-1">(selected)</span> : null}</td>
                <td className="px-3 py-2 text-center">{rel as string}</td>
                <td className="px-3 py-2 text-center">{cite as string}</td>
                <td className="px-3 py-2 text-center">{lat as string}</td>
                <td className="px-3 py-2 text-center">{errors as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the results tell us</h2>
      <p>
        Qwen3-8B scored highest on relevance at 0.94 with zero errors. It is an 8 billion
        parameter model, the smallest in the comparison. GPT-oss 120B, which won our earlier
        10-question building permits test, dropped to last place on relevance when tested
        against the full breadth of Toronto.ca content. The model that wins on a narrow
        benchmark is not always the model that wins on a broad one.
      </p>
      <p>
        Llama 3.3 70B was the fastest at 3.6 seconds average with solid scores across the
        board. Kimi K2.5 had the best citation quality at 0.87 but was one of the slowest
        and had reliability issues with server disconnects.
      </p>
      <p>
        Based on these results, we switched our default model from GPT-oss 120B to Qwen3-8B.
        It scores 15% higher on relevance, costs less per token, and had zero errors across
        all 100 questions.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Planning for dedicated hosting</h2>
      <p>
        One reason we included smaller models in the benchmark was to evaluate options for
        self-hosted inference. Running a model on dedicated hardware eliminates per-token
        API costs and gives full control over availability, latency, and data residency.
        For a Canadian-first platform, keeping inference within Canadian infrastructure
        is a long-term goal.
      </p>
      <p>
        Qwen3-8B is small enough to run on a single GPU with 16GB of VRAM. Llama 3.3 70B
        needs more hardware but is still within reach of a dedicated server with a larger
        GPU or quantized weights. Both scored competitively against models 10 to 15 times
        their size, which makes the economics of dedicated hosting much more attractive
        than paying per-token for a 120B model.
      </p>
      <p>
        We are not self-hosting yet. The current setup uses Fireworks.ai for all inference,
        which keeps things simple while we focus on the product. But knowing that an 8B
        model outperforms a 120B model on our specific task gives us confidence that
        dedicated hosting will be viable when we are ready to make that move.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Reliability</h2>
      <p>
        Six of the nine models completed all 100 questions without a single error. Kimi
        K2.5 had 2 errors and DeepSeek v3.2 had 3, both from server disconnects on the
        Fireworks.ai infrastructure. These are transient issues rather than model quality
        problems, but reliability matters in production. A model that drops requests
        unpredictably is harder to trust even if its scores are good.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">How the benchmark works</h2>
      <p>
        The benchmark runs each question through the full production pipeline: query
        classification, vector retrieval, context assembly, and LLM generation. Answers
        are scored by keyword signal matching against expected topics for each question.
        The benchmark supports running against a single model or all 9 models in sequence,
        with retry logic for transient API errors and a 5 second delay between requests
        to stay within rate limits.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-4">How we selected the questions</h3>
      <p>
        The 100 questions were written to cover the same topics real users ask about.
        Each question maps to a specific Toronto.ca section and includes expected signals
        (keywords the answer should contain) and expected source URLs. Questions span
        conditional ("Do I need...?"), process ("How do I...?"), cost, location,
        requirements, eligibility, and compliance patterns.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-4">What makes a good benchmark</h3>
      <p>
        A useful benchmark for RAG systems needs to test breadth, not just depth. Our
        original 12 questions told us which model handles building permits best. Our
        100 questions tell us which model handles everything best. The rankings changed
        completely when we widened the test, which is exactly why broad benchmarks matter.
      </p>
    </BlogPost>
  )
}

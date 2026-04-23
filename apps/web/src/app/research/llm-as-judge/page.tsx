import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/llm-as-judge'

export const metadata: Metadata = {
  title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring',
  description: 'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00. Here is how we built a semantic evaluation system using open-source models.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'How We Built an LLM-as-Judge to Replace Keyword Scoring', description: 'Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="How We Built an LLM-as-Judge to Replace Keyword Scoring" description="Keyword matching scored our best answer at 0.00. The LLM judge scored it 1.00." date="2026-03-28" url={PAGE_URL}>
      <p>
        Our first evaluation system was simple: check whether specific keywords show up
        in the answer. If we expected the word &quot;fine&quot; and the model said
        &quot;penalty,&quot; it scored zero. The system was working better than the numbers
        suggested.
      </p>

      <p>
        The clearest example was the question &quot;What happens if I build without a permit
        in Toronto?&quot; The answer covered penalties, fees, stop-work consequences, and
        legal risks in detail. The keyword scorer gave it 0.00 because the wording
        didn&apos;t match the expected signals (&quot;enforcement,&quot; &quot;stop work,&quot;
        &quot;fine,&quot; &quot;order&quot;). A good answer, scored as a total failure.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The fix: let a model judge the model</h2>
      <p>
        We built an LLM-as-judge that scores each answer on four dimensions, each
        rated 0.0 to 1.0:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li><span className="font-medium">Relevance:</span> Does the answer directly address the question?</li>
        <li><span className="font-medium">Completeness:</span> Does it cover the expected topics (semantically, not by keyword)?</li>
        <li><span className="font-medium">Groundedness:</span> Is it supported by evidence, not hallucinated?</li>
        <li><span className="font-medium">Citation quality:</span> Are sources cited and relevant?</li>
      </ul>

      <p>
        The prompt tells the judge explicitly that expected topics are concepts, not
        exact words. It runs at temperature=0 so results are deterministic. The judge
        is the same open-source model we use for answer generation (GPT-oss 120B via
        Fireworks.ai).
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-4 py-2 font-medium text-gray-700">Metric</th>
              <th className="text-center px-4 py-2 font-medium text-gray-700">Keyword Score</th>
              <th className="text-center px-4 py-2 font-medium text-zeever-primary">LLM Judge Score</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            <tr className="border-t border-zeever-accent/10">
              <td className="px-4 py-2 font-medium">Relevance</td>
              <td className="px-4 py-2 text-center">0.60</td>
              <td className="px-4 py-2 text-center font-semibold text-zeever-primary">0.88</td>
            </tr>
            <tr className="border-t border-zeever-accent/10">
              <td className="px-4 py-2 font-medium">Groundedness</td>
              <td className="px-4 py-2 text-center text-gray-400">n/a</td>
              <td className="px-4 py-2 text-center font-semibold text-zeever-primary">1.00</td>
            </tr>
            <tr className="border-t border-zeever-accent/10">
              <td className="px-4 py-2 font-medium">Citation quality</td>
              <td className="px-4 py-2 text-center">0.62</td>
              <td className="px-4 py-2 text-center font-semibold text-zeever-primary">0.75</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">
        100% groundedness means every claim in every answer was supported by retrieved
        evidence from Toronto.ca. No hallucination was detected.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Cost</h2>
      <p>
        Each judge call costs about $0.0002 at Fireworks pricing. A full 100-question
        run with judging comes in under $0.02. We run both keyword and judge scoring
        together so we can see how they compare.
      </p>
    </BlogPost>
  )
}

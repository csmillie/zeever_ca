import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/provider-comparison'

export const metadata: Metadata = {
  title: 'Switching Inference Providers: A 24-Hour Latency Test',
  description: 'We ran a 24-hour latency test across three inference providers. Together.ai was 1.7x faster than Fireworks. Here is why we switched.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Switching Inference Providers: A 24-Hour Latency Test', description: 'Together.ai was 1.7x faster than Fireworks. Here is why we switched.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Switching Inference Providers: A 24-Hour Latency Test Across Three Providers" description="We ran a 24-hour latency test across three inference providers. Together.ai was 1.7x faster than Fireworks. Here is why we switched." date="2026-04-03" url={PAGE_URL}>
      <p>
        Latency matters more than most people think. When someone asks a question
        about Toronto city services, they are usually trying to solve a problem right
        now. A 3-second answer feels instant. An 8-second answer feels broken. We
        were regularly seeing 8 to 10 second response times on Fireworks.ai, and that
        was before counting retrieval and context assembly. Total user-facing latency
        was pushing 12 to 15 seconds. That is not good enough.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The test</h2>
      <p>
        We built a comparison tool that fires the same question at multiple inference
        providers simultaneously, once per hour at a random minute, over 24 hours. Each
        test picks a random question from our 100-question benchmark, retrieves the same
        chunks from our database, and sends the identical context to every provider. The
        only variable is the provider and model.
      </p>
      <p>
        We tested three providers:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Fireworks.ai running Qwen3-8B (our previous default)</li>
        <li>Together.ai running Qwen2.5-7B-Instruct-Turbo (closest available Qwen model)</li>
        <li>OVHcloud AI Endpoints running Qwen3-32B (free tier, for comparison)</li>
      </ul>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Provider</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Avg</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Min</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Max</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Errors</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Together.ai', 'Qwen2.5-7B-Turbo', '2.4s', '0.97s', '3.7s', '0', true],
              ['Fireworks.ai', 'Qwen3-8B', '4.0s', '3.2s', '5.7s', '0', false],
              ['OVHcloud', 'Qwen3-32B', '15.2s', '7.8s', '26.7s', '0', false],
            ].map(([provider, model, avg, min, max, errors, selected]) => (
              <tr key={provider as string} className={`border-t border-zeever-accent/10 ${selected ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{provider as string}{selected ? <span className="text-xs text-zeever-primary ml-1">(selected)</span> : null}</td>
                <td className="px-3 py-2 text-gray-500">{model as string}</td>
                <td className="px-3 py-2 text-center">{avg as string}</td>
                <td className="px-3 py-2 text-center">{min as string}</td>
                <td className="px-3 py-2 text-center">{max as string}</td>
                <td className="px-3 py-2 text-center">{errors as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why Fireworks was too slow</h2>
      <p>
        Fireworks.ai is a solid platform. We used it for months and it gave us access
        to a wide catalog of open-source models. Our 9-model benchmark comparison that
        found Qwen3-8B as the best model was run entirely on Fireworks. But as we moved
        from evaluation to production, the latency became a problem.
      </p>
      <p>
        The average of 4 seconds does not tell the full story. During peak hours, we
        regularly saw individual requests take 8 to 10 seconds. For a user sitting on
        the homepage waiting for an answer about their building permit, that feels like
        the system is broken. The inconsistency was as much of a problem as the average.
        Some responses came back in 3 seconds, others took three times as long. Users
        do not know which one they are going to get.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The model tradeoff</h2>
      <p>
        The catch with switching to Together.ai is that they do not offer Qwen3-8B. Their
        closest equivalent is Qwen2.5-7B-Instruct-Turbo. This is a different model from
        a previous generation of the Qwen family. Qwen3-8B scored 94% relevance in our
        100-question benchmark. We do not yet know how Qwen2.5-7B compares on the same
        test.
      </p>
      <p>
        This is the classic tradeoff in production AI systems: the model you want to run
        is not always available on the provider that gives you the best latency. We chose
        to prioritize user experience. A slightly less accurate answer that arrives in 2
        seconds is more useful than a slightly more accurate answer that takes 8 seconds.
        But we are not guessing about the quality gap. We are running the full 100-question
        benchmark on Together.ai with Qwen2.5-7B to measure the actual difference.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">OVHcloud: promising but early</h2>
      <p>
        OVHcloud AI Endpoints is interesting for a different reason. It is a European
        provider with data centres in Canada, and their free tier gives you access to
        Qwen3-32B with no API key required. The latency (15 seconds average, up to 27
        seconds) makes it impractical for production right now, but the fact that they
        offer free inference on a capable model is notable.
      </p>
      <p>
        We plan to revisit OVHcloud to look for better endpoints and models. If they
        add smaller models or improve their serving infrastructure, the combination of
        Canadian data residency and free or low-cost inference would be compelling.
        Their model catalog already includes Llama 3.1 8B and Mistral 7B alongside
        the larger options.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">How we built the test</h2>
      <p>
        The comparison tool runs as a Python script on the production server. Every hour,
        at a random minute within that hour, it picks a random question from our benchmark
        suite. It retrieves chunks from the database once (same context for all providers),
        then fires the question at all three providers simultaneously using asyncio. This
        ensures the tests happen at different times of day to capture peak and off-peak
        latency patterns.
      </p>
      <p>
        Results are logged to a CSV file with timestamp, provider, question, latency,
        token count, and any errors. The random timing within each hour prevents the test
        from always hitting the same traffic pattern, and running for 24 hours gives enough
        data points to see real trends rather than lucky or unlucky individual requests.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What is next</h2>
      <p>
        We are running the full 100-question benchmark through Together.ai with
        Qwen2.5-7B-Instruct-Turbo. This will tell us whether the relevance and citation
        quality hold up compared to Qwen3-8B on Fireworks. If the quality is comparable,
        Together stays as our default. If there is a meaningful drop, we will look for
        Qwen3-8B availability on Together or evaluate other models in their catalog.
      </p>
      <p>
        We also plan to revisit OVHcloud once they expand their model selection and
        improve latency. A Canadian-hosted inference provider with competitive
        performance would be ideal for our long-term data sovereignty goals.
      </p>
    </BlogPost>
  )
}

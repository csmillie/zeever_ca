import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const FAQS = [
  {
    question: 'Can you run Ollama on an NVIDIA RTX 3070?',
    answer: 'Yes. The RTX 3070 with 8GB of VRAM can run 7B parameter models like qwen2.5:7b-instruct comfortably through Ollama. Larger models are possible but push the hardware harder and produce less consistent response times.',
  },
  {
    question: 'How fast is local Ollama compared to cloud inference providers?',
    answer: 'In our test, Ollama on a Dell XPS with an RTX 3070 responded in 2.8 seconds, faster than Fireworks.ai at 3.8 seconds and OVHcloud at 9.9 seconds. Together.ai was the fastest at 1.2 seconds. Local inference was competitive with commercial APIs.',
  },
  {
    question: 'What LLM model works best with 8GB of VRAM?',
    answer: 'qwen2.5:7b-instruct was the best fit for 8GB of VRAM in our testing. It ran comfortably without pushing the GPU too hard, produced strong answers, and offered a good balance between model capability and hardware feasibility.',
  },
  {
    question: 'How do you avoid cold starts in Ollama?',
    answer: 'Configure Ollama to keep the model loaded in memory between requests. If the model unloads and has to reload for each request, latency increases significantly. Persisting the model in VRAM makes the local setup behave like a steady service rather than a one-off experiment.',
  },
  {
    question: 'Is local LLM inference practical for production use?',
    answer: 'For small-scale projects, internal tools, and research workloads, yes. A local Ollama node gives you predictable access, no per-request billing, and more privacy. Hosted providers still win on convenience and scale, but local inference on consumer hardware is no longer just a novelty.',
  },
]

const PAGE_URL = 'https://www.zeever.ca/research/local-ollama-benchmark'

export const metadata: Metadata = {
  title: 'Running Ollama on an Old Dell XPS With an NVIDIA 3070',
  description: 'We tested local inference with Ollama on a Dell XPS with an RTX 3070 against Fireworks, Together.ai, and OVHcloud. The old desktop held its own.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Local Ollama Benchmark: Old Dell XPS vs Cloud Providers', description: 'We tested local inference with Ollama on a Dell XPS with an RTX 3070 against Fireworks, Together.ai, and OVHcloud.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Running Ollama on an Old Dell XPS With an NVIDIA 3070: A Practical Local LLM Test Against Fireworks, Together.ai, and OVHcloud" description="We tested local inference with Ollama on a Dell XPS with an RTX 3070 against Fireworks, Together.ai, and OVHcloud. The old desktop held its own." date="2026-04-17" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="bg-zeever-primary/5 border border-zeever-primary/20 rounded-xl p-5 mb-2">
        <p className="text-sm font-semibold text-zeever-text mb-2">Key finding</p>
        <p className="text-sm text-gray-700">
          A Dell XPS desktop with an NVIDIA RTX 3070 and 8GB of VRAM, running
          Ollama with qwen2.5:7b-instruct, responded in 2.8 seconds. That was
          faster than Fireworks.ai (3.8s) and OVHcloud (9.9s), and within range
          of Together.ai (1.2s). Older consumer hardware can deliver competitive
          inference latency when paired with a right-sized model and proper
          configuration.
        </p>
      </div>

      <p>
        There is something appealing about taking an aging desktop and turning it
        into a usable private AI node.
      </p>
      <p>
        In this case, I used my son&apos;s old Dell XPS desktop with an NVIDIA RTX 3070
        and 8GB of VRAM to see how far I could push a local inference setup with
        Ollama. The goal was not to build the fastest AI stack in the world. It was
        to test whether older consumer hardware could still deliver acceptable latency
        for real work, while giving me more control over cost, privacy, and deployment.
      </p>
      <p>
        After testing a few models, I settled on qwen2.5:7b-instruct as the best fit
        for the machine. With only 8GB of VRAM available, model size matters fast.
        Larger models were possible to experiment with, but they pushed the system
        harder, increased the chance of slower responses, and made the setup feel less
        practical for day-to-day use. Qwen2.5 7B hit the right balance between
        capability and feasibility on this hardware.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why this experiment mattered</h2>
      <p>
        There are already excellent hosted inference providers. Services like
        Together.ai, Fireworks.ai, and OVHcloud make it easy to call powerful models
        through an API without worrying about local hardware, drivers, or runtime
        management.
      </p>
      <p>
        But local inference still has real advantages. Lower marginal cost once the
        hardware is available. More control over where data goes. The ability to
        experiment without depending entirely on third-party endpoints. And a path
        toward lightweight private infrastructure for niche workloads.
      </p>
      <p>
        I also wanted to see how close a local setup on old hardware could get to
        commercial API latency.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The hardware and setup</h2>
      <p>
        The machine was an older Dell XPS desktop with an NVIDIA RTX 3070 and 8GB of
        VRAM. That makes it a good test case for a lot of people who have a gaming PC
        or a retired workstation sitting around.
      </p>
      <p>
        The local inference stack used:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Ollama for local model serving</li>
        <li>qwen2.5:7b-instruct as the selected model</li>
        <li>Tailscale to connect the machine securely to my VPS</li>
        <li>A persistence approach in Ollama to keep the model loaded and avoid unnecessary cold start delays</li>
      </ul>
      <p>
        That last point matters. One of the biggest issues with local inference is
        that if the model unloads between requests, latency gets worse fast. If the
        goal is to use the machine as a real service endpoint, not just a one-off
        experiment, you need to reduce the reload penalty. Keeping the model resident
        made the system much more usable.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why Tailscale helped</h2>
      <p>
        Rather than expose the old Dell directly, I used Tailscale to connect it into
        my existing infrastructure through a private mesh network. That made it much
        easier to reach the Ollama instance securely from my VPS without opening ports
        to the public internet or building a more complicated VPN setup.
      </p>
      <p>
        This pattern is especially useful if you want to experiment with hybrid
        infrastructure:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Public VPS for orchestration, APIs, or routing</li>
        <li>Private local GPU machine for inference</li>
        <li>Secure connection between the two without a lot of networking overhead</li>
      </ul>
      <p>
        For small-scale projects, that is a surprisingly effective architecture.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Model testing and the decision to use qwen2.5:7b-instruct</h2>
      <p>
        With only 8GB of VRAM, model choice is constrained by reality, not ambition.
      </p>
      <p>
        I tested a few options, but qwen2.5:7b-instruct came out as the practical
        winner for this box. It was small enough to run comfortably, capable enough
        to produce strong answers, and a better operational fit than trying to force
        a larger model into limited VRAM.
      </p>
      <p>
        This is an important lesson in local AI infrastructure: the best model is not
        always the biggest one. It is the one that fits the hardware well enough to
        produce consistent, usable results.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Latency test</h2>
      <p>
        To get a rough comparison, I ran the same question across four providers:
        Fireworks.ai, Together.ai, OVHcloud, and Ollama running locally on the Dell
        XPS. The prompt was: &ldquo;What is a zoning certificate in Toronto?&rdquo;
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Provider</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Latency</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Tokens</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Answer Length</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Together.ai', 'Qwen2.5-7B-Turbo', '1.2s', '2,098', '633 chars', true],
              ['Ollama (local)', 'qwen2.5:7b-instruct', '2.8s', '2,148', '942 chars', false],
              ['Fireworks.ai', 'Qwen3-8B', '3.8s', '2,438', '1,157 chars', false],
              ['OVHcloud', 'Qwen3-32B', '9.9s', '2,368', '829 chars', false],
            ].map(([provider, model, latency, tokens, length, fastest]) => (
              <tr key={provider as string} className={`border-t border-zeever-accent/10 ${fastest ? 'bg-zeever-primary/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{provider as string}{fastest ? <span className="text-xs text-zeever-primary ml-1">(fastest)</span> : null}</td>
                <td className="px-3 py-2 text-gray-500">{model as string}</td>
                <td className="px-3 py-2 text-center">{latency as string}</td>
                <td className="px-3 py-2 text-center">{tokens as string}</td>
                <td className="px-3 py-2 text-center">{length as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the results suggest</h2>
      <p>
        The first takeaway is that Together.ai was the fastest in this test at 1206 ms.
      </p>
      <p>
        The second is that local Ollama performed surprisingly well at 2793 ms. It was
        slower than Together.ai, but faster than Fireworks.ai in this run, and
        dramatically faster than OVHcloud.
      </p>
      <p>
        That is a useful result. A recycled desktop with a 3070 is not supposed to
        beat the convenience of hosted inference. But it does not need to. It only
        needs to be good enough to justify itself for certain workloads. In this case,
        it looked viable.
      </p>
      <p>
        A few observations stand out:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Together.ai delivered the best latency in this sample</li>
        <li>Ollama on local hardware was competitive enough to be interesting</li>
        <li>Fireworks.ai was slower than the local setup in this specific run</li>
        <li>OVHcloud showed the highest latency by a wide margin</li>
      </ul>
      <p>
        This does not prove that one provider is always better than another. It only
        shows what happened in this particular test, with this prompt, at this moment.
        But it does reinforce the idea that a modest local GPU machine can hold its
        own better than many people expect.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The hidden value of local inference</h2>
      <p>
        The value of a setup like this is not just latency. It is also about control.
      </p>
      <p>
        A local Ollama node gives you:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Predictable access to a model you choose</li>
        <li>No per-request API billing</li>
        <li>More privacy for sensitive prompts</li>
        <li>Flexibility to experiment with deployment patterns</li>
        <li>A better understanding of what modern inference actually requires</li>
      </ul>
      <p>
        It also changes the economics for hobby projects, internal tools, and research
        environments. If you already have the hardware, the question is no longer
        &ldquo;can I afford to test this?&rdquo; but &ldquo;is the operational complexity worth it?&rdquo;
      </p>
      <p>
        For many experiments, the answer is yes.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Avoiding cold starts matters more than people think</h2>
      <p>
        One of the more important practical lessons was the need to keep the model
        loaded.
      </p>
      <p>
        If Ollama has to reload the model repeatedly, the user experience degrades
        fast. That makes any local setup feel slower than it really is. Persisting the
        model in memory reduced that issue and made the machine behave more like a
        steady service than a hobby box.
      </p>
      <p>
        That is a key difference between a demo and an actual usable endpoint.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Final thoughts</h2>
      <p>
        This experiment made one thing clear: older consumer hardware still has real
        value in the local AI stack.
      </p>
      <p>
        A Dell XPS with an RTX 3070 and 8GB of VRAM is not a datacenter server. But
        paired with Ollama, connected through Tailscale, and running a right-sized
        model like qwen2.5:7b-instruct, it can become a credible inference node.
      </p>
      <p>
        For anyone exploring private AI infrastructure, hybrid deployments, or just
        trying to stretch the value of hardware they already own, this kind of setup
        is worth testing.
      </p>
      <p>
        Hosted inference will still win on convenience, scale, and often latency. But
        local inference is no longer just a novelty. With the right model and a
        practical architecture, it can be good enough to matter.
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

import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/canadian-inference'

export const metadata: Metadata = {
  title: 'The Missing Layer: AI Inference in Canada',
  description: 'Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'The Missing Layer: AI Inference in Canada', description: 'Canada has GPU hosting but no easy way to test and prototype open-source models.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="The Missing Layer: AI Inference in Canada" description="Canada has GPU hosting but no easy way to test and prototype open-source models. That gap is pushing Canadian companies toward US-hosted black boxes." date="2026-04-02" url={PAGE_URL}>
      <p>
        When we built Zeever.ca, we wanted to run open-source models on Canadian-friendly
        infrastructure. What we found was a gap in the market that affects anyone building
        AI products in Canada.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What exists today</h2>
      <p>
        Canada has dedicated GPU hosting. Companies like OVHcloud (Montreal), CENGN, and
        several colocation providers offer bare metal servers with A100s and H100s. If you
        know exactly which model you want to run, you can lease a server, set up your
        inference stack, and get to work.
      </p>
      <p>
        The problem is what comes before that. Before you commit to dedicated hardware,
        you need to test models. You need to run a benchmark against your data with
        multiple candidates, compare latency and quality, try different sizes, and figure
        out what actually works for your use case. That testing and prototyping layer
        barely exists in Canada.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The inference gap</h2>
      <p>
        In the US, services like Fireworks.ai, Together.ai, and Replicate let you call
        dozens of open-source models through a simple API. Pay per token, no hardware
        commitment, swap models in minutes. We used Fireworks.ai to test 9 different models
        against our 100-question benchmark before choosing Qwen3-8B as our default. That
        kind of rapid experimentation is essential for building good AI products.
      </p>
      <p>
        In Canada, the equivalent does not exist. Your options are:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Lease dedicated GPUs and manage your own inference stack (high commitment, slow iteration)</li>
        <li>Use US-hosted API providers like Fireworks.ai or Together.ai (data leaves Canada)</li>
        <li>Use the big cloud providers, AWS Bedrock or Google Vertex AI (expensive, limited model selection, US-controlled)</li>
        <li>Default to OpenAI, Anthropic, or Google directly (closed-source, US-hosted, no model choice)</li>
      </ul>
      <p>
        None of these solve the core problem: easy, pay-per-token access to open-source
        models running on Canadian infrastructure.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why this matters for Canadian companies</h2>
      <p>
        Government and regulated industries want data residency. Healthcare, finance,
        legal, and public sector organizations increasingly need to keep data within
        Canadian borders. The sensitivity to US data exposure is growing, especially
        for personally identifiable information and confidential government content.
      </p>
      <p>
        Federal and provincial procurement processes have a bias toward Canadian vendors.
        If you are building AI products for government clients, being able to say "all
        inference happens on Canadian infrastructure" is a competitive advantage. But right
        now, that claim requires leasing dedicated hardware before you even know which
        model to use.
      </p>
      <p>
        Without easy access to test smaller or open-source models, Canadian companies
        default to the large proprietary models from OpenAI, Anthropic, Google, and xAI.
        These are black boxes hosted in the US. You cannot inspect the model, control
        where inference happens, or switch providers without rewriting your integration.
        For many use cases, a well-chosen open-source model running on Canadian hardware
        would be cheaper, more transparent, and give better results.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we learned building Zeever.ca</h2>
      <p>
        Our 9-model benchmark showed that an 8 billion parameter open-source model
        (Qwen3-8B) outperformed a 120 billion parameter model on our specific task.
        Smaller models that follow instructions well can beat larger ones on
        retrieval-grounded tasks where the context provides the facts. But we only
        discovered this because we had access to an inference API that let us test
        multiple models quickly.
      </p>
      <p>
        If we had to lease dedicated hardware for each model we wanted to try, we
        would have picked one model early, committed to it, and never discovered
        that a model 15 times smaller gives better answers. That is the cost of the
        inference gap. It is not just about where data is hosted. It is about the
        ability to experiment, iterate, and make informed choices about which model
        to deploy.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What a Canadian inference layer would look like</h2>
      <p>
        The missing piece is a managed inference service running in Canadian data centres
        that offers pay-per-token access to a catalog of open-source models. No hardware
        commitment, no DevOps overhead, just an API key and a model ID. The same developer
        experience that Fireworks.ai provides in the US, but with data staying in Canada.
      </p>
      <p>
        This would let Canadian companies prototype with multiple models against their own
        data, run benchmarks, and make confident decisions about which model to deploy on
        dedicated hardware when they are ready to scale. The dedicated GPU providers already
        exist for the production step. What is missing is the experimentation step that
        comes before it.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where Zeever.ca sits today</h2>
      <p>
        We currently use Fireworks.ai for all inference. It gives us the model flexibility
        we need at a reasonable cost. The tradeoff is that inference happens in the US.
        For our use case, answering questions about publicly available Toronto.ca content,
        the data sensitivity risk is low. But we recognize this would not be acceptable
        for applications handling health records, financial data, or confidential
        government information.
      </p>
      <p>
        Our long-term plan is to self-host Qwen3-8B on Canadian infrastructure. At 8
        billion parameters, it can run on a single GPU with 16GB of VRAM, making dedicated
        hosting economically viable. When a Canadian inference provider fills this gap, we
        will be among the first to move.
      </p>
    </BlogPost>
  )
}

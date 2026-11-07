import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const FAQS = [
  {
    question: 'What is an agent-first AI model?',
    answer: 'An agent-first AI model is designed to execute multi-step tasks rather than produce single-turn answers. These models are built around tool use, planning, and action. They can call APIs, execute code, retrieve data, and iterate toward a result. The shift from chat-first to agent-first reflects a broader change in how AI platforms evaluate and deploy models.',
  },
  {
    question: 'What is Mixture of Experts (MoE) in AI?',
    answer: 'Mixture of Experts is a neural network architecture where the model is composed of many smaller specialized sub-networks called experts. A routing mechanism selects which experts to activate for each input, so only a fraction of the total model runs per request. This provides large model capacity at lower compute cost per token, enabling better performance per dollar.',
  },
  {
    question: 'Why are AI inference platforms deprecating older models?',
    answer: 'Platforms like Together.ai and Fireworks.ai are removing models that lack strong agent capabilities. Models like DeepSeek v3.2, Qwen3 8B, and Llama 3.3 70B were effective chat models but struggle with tool use, multi-step reasoning, and long-horizon execution. The replacements, such as Kimi K2.6 and Qwen3.6 Plus, are designed for agent workflows from the ground up.',
  },
  {
    question: 'What is the difference between Together.ai and Fireworks.ai?',
    answer: 'Together.ai operates as a broad discovery layer with rapid adoption of new model releases and high experimentation velocity. Fireworks.ai takes a more curated approach, focusing on fewer production-ready models and aggressively deprecating weaker options. Both are converging on MoE and agent-first models as the standard for inference.',
  },
  {
    question: 'Can MoE models produce different results on the same input?',
    answer: 'Yes. Because MoE architectures route inputs to different expert sub-networks, the same prompt can activate different experts across runs. This introduces variability in reasoning paths and outputs. For anyone evaluating or benchmarking AI systems, this divergence is an important factor to account for in testing methodology.',
  },
]

const PAGE_URL = 'https://www.zeever.ca/research/agent-first-ai'

export const metadata: Metadata = {
  title: 'The Shift to Agent-First AI: What Model Changes Tell Us',
  description: 'Inference platforms are dropping chat-first models for agent-first architectures built on Mixture of Experts. What the shift means for production AI.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'The Shift to Agent-First AI: What Model Deprecations Tell Us', description: 'AI inference platforms are deprecating chat-first models and replacing them with agent-first MoE architectures. What this shift means.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="The Shift to Agent-First AI: What Model Changes Tell Us" description="Inference platforms are dropping chat-first models for agent-first architectures built on Mixture of Experts. What the shift means for production AI." date="2026-04-23" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <p>
        AI inference platforms are deprecating mid-tier chat models and replacing
        them with agent-first architectures built on Mixture of Experts. The shift
        reflects a fundamental change in what AI systems are optimized for: not
        answering questions, but executing multi-step workflows with tool use,
        planning, and action. Platforms like Together.ai and Fireworks.ai are
        converging on MoE plus agent capability as the baseline for production
        inference.
      </p>

      <p>
        Over the past few weeks, something important has been happening across AI
        infrastructure platforms like Together AI and Fireworks AI.
      </p>
      <p>
        Models are being deprecated. Replaced. Consolidated.
      </p>
      <p>
        At first glance, it looks like routine platform churn.
      </p>
      <p>
        It isn&apos;t.
      </p>
      <p>
        It&apos;s a signal.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The models disappearing</h2>
      <p>
        Across platforms, a consistent set of models is being removed or deprioritized:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>DeepSeek v3.2</li>
        <li>Qwen3 8B</li>
        <li>Qwen3 VL 30B</li>
        <li>GLM 4.x and early 5 versions</li>
        <li>Llama 3.3 70B</li>
      </ul>
      <p>
        These models share a common profile: mid-tier capability, earlier-generation
        reasoning, limited agent functionality.
      </p>
      <p>
        They were strong chat models. They are weaker agent models.
      </p>
      <p>
        And that distinction now matters more than anything else.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What&apos;s replacing them</h2>
      <p>
        The replacements are models like Kimi K2.6, Qwen3.6 Plus, GLM 5.1, and
        the GPT-OSS 20B and 120B class.
      </p>
      <p>
        These aren&apos;t better versions of the same thing. They represent a different
        design philosophy:
      </p>
      <p className="pl-4 border-l-2 border-zeever-primary/30 text-gray-600 italic">
        AI is no longer optimized for answering questions. It&apos;s optimized for
        doing work.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The rise of agent-first architecture</h2>
      <p>
        Modern models are increasingly built around a simple idea: the model is not
        the endpoint. It&apos;s the orchestrator.
      </p>
      <p>
        This shift shows up in three core capabilities.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Tool use</h3>
      <p>
        Models are expected to call APIs, execute code, and retrieve data.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Multi-step reasoning</h3>
      <p>
        Not &ldquo;answer this question,&rdquo; but break down tasks, plan steps,
        and iterate toward a result.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Execution capability</h3>
      <p>
        The output isn&apos;t just text. It&apos;s actions, workflows, and decisions.
      </p>
      <p>
        That is what defines an agent-first model. And it&apos;s why older models are
        being phased out.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">MoE dominance: the architecture behind the shift</h2>
      <p>
        At the center of this transition is one idea: Mixture of Experts (MoE).
      </p>
      <p>
        Instead of one monolithic neural network, MoE models are built from many
        smaller &ldquo;experts.&rdquo;
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">The 1,000 employee analogy</h3>
      <p>
        Imagine a company with 1,000 employees, but only 5 to 10 people work on any
        given task. You still have massive bench strength and deep specialization.
        But you only use the most relevant team for the job at hand.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">How it works</h3>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>A router decides which experts to activate</li>
        <li>Only a subset of the model runs per token</li>
        <li>Different inputs may trigger different experts</li>
      </ul>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Why MoE is winning</h3>
      <p>
        <strong>Performance per dollar.</strong>{' '}Massive total capacity, lower compute
        per request.
      </p>
      <p>
        <strong>Specialization.</strong>{' '}Experts can focus on coding, reasoning, or
        language nuance.
      </p>
      <p>
        <strong>Better scaling.</strong>{' '}You can grow total model size without
        proportionally increasing cost.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Tradeoffs</h3>
      <p>
        MoE is not free. It&apos;s harder to train, routing decisions are complex, and
        load balancing is a real engineering challenge.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">A subtle but important effect</h3>
      <p>
        Because different experts can be selected on different runs, the same model
        can produce different results across runs. That introduces variability and
        divergence in reasoning paths. For anyone evaluating AI systems, that becomes
        incredibly important.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Why older models are being removed</h2>
      <p>
        Now the earlier list makes sense.
      </p>
      <p>
        The deprecated models don&apos;t use MoE effectively. They lack strong routing
        and specialization. They struggle with long-horizon reasoning. They aren&apos;t
        designed for agent workflows.
      </p>
      <p>
        They&apos;re optimized for answers. Not execution.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Platform strategy: Together vs Fireworks</h2>
      <p>
        These shifts also reveal how the platforms are positioning themselves.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Together AI</h3>
      <p>
        Broad, fast-moving model catalog. Rapid adoption of new releases. High
        experimentation velocity. Think of it as the discovery layer for emerging
        models.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Fireworks AI</h3>
      <p>
        Curated, performance-focused selection. Aggressive deprecation of weaker
        models. Standardizing around fewer, stronger options. Think of it as the
        production-ready inference layer.
      </p>
      <p>
        Both are converging on the same conclusion: MoE plus agent-first models
        are the future.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">A different path: OVHcloud</h2>
      <p>
        While Together and Fireworks compete on which models to run, OVHcloud is
        taking a different approach.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Infrastructure first</h3>
      <p>
        OVH focuses on GPU infrastructure, sovereign cloud environments, and private
        deployments.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Model-agnostic strategy</h3>
      <p>
        Instead of curating models, they enable Hugging Face ecosystems, custom
        deployments, and enterprise-controlled AI stacks.
      </p>

      <h3 className="text-lg font-semibold text-zeever-text pt-2">Why this matters</h3>
      <p>
        OVH isn&apos;t competing on model quality. They&apos;re competing on where and how
        models run. That matters most for regulated industries, data sovereignty
        requirements, and serious enterprise AI adoption.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The real takeaway</h2>
      <p>
        This isn&apos;t a model refresh cycle. It&apos;s a shift in what AI is.
      </p>
      <p>
        <strong>Then:</strong>{' '}chat-first, static responses, one-shot answers.
      </p>
      <p>
        <strong>Now:</strong>{' '}agent-first, tool-using, multi-step, execution-driven.
      </p>
      <p>
        And under the hood, MoE architectures are enabling massive scale, efficient
        compute, and specialized reasoning all at once.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What to watch next</h2>
      <p>
        If this trend continues, and it will:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>Smaller models will disappear from serious workflows</li>
        <li>Agent capability will become the default expectation</li>
        <li>Model evaluation will shift from &ldquo;accuracy&rdquo; to &ldquo;task completion and reliability&rdquo;</li>
      </ul>
      <p>
        The shift is already underway. Chat-era models are being quietly retired,
        and agent-era models are taking their place.
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

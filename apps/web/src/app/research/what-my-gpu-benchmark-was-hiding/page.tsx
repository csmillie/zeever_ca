import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/what-my-gpu-benchmark-was-hiding'

export const metadata: Metadata = {
  title: 'My GPU Benchmark Was Measuring a Cold Model',
  description: 'We published a GPU comparison for local language models. One finding was wrong: the first request after a model loads under-reports prompt processing.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'My GPU Benchmark Was Measuring a Cold Model', description: 'One finding in our GPU comparison was wrong. The way it was wrong is more interesting than the finding.', url: PAGE_URL },
}

const FAQS = [
  {
    question: 'Why does the first request to a local LLM report slower prompt processing?',
    answer: 'Because the model is being loaded into VRAM while the request is served, and the timing counters do not separate the two. In our measurements the first request after a load under-reported prompt processing by about 25 percent. The server reported its own load time as roughly one millisecond either way, so nothing in the output indicates that anything unusual happened. Discard the first run and measure the second.',
  },
  {
    question: 'Is an AMD RX 7900 XT faster than an NVIDIA RTX 3070 for local LLM inference?',
    answer: 'Yes, but by less than the specifications suggest. Measured warm against warm on the same model and quantization, the RX 7900 XT generated tokens about 21 percent faster and tied on prompt processing. Its memory bandwidth advantage is 1.8 times, so paper specifications would predict a much larger gap. The 20GB of VRAM matters more than the speed: it is what allows the card to hold a 20 billion parameter model at all.',
  },
  {
    question: 'Why does the AMD card only reach 60 percent of its memory bandwidth?',
    answer: 'The bottleneck is the routine that unpacks the compressed model weights, not the card. Running the same model at Q8_0 instead of Q4_K_M raised efficiency from 60 percent to 77 percent, while the NVIDIA card reached 89 percent on Q4_K_M. Q4_K uses a super-block structure with nested scales that is expensive to decode; Q8_0 is close to a multiply. The AMD implementation of the harder format does not keep the memory controller busy.',
  },
  {
    question: 'Should I enable a quantized KV cache in Ollama?',
    answer: 'Only if you have a VRAM problem. On our hardware it cost 5.4 percent of generation speed while saving under one percent of memory traffic, because the KV cache is small next to the model at ordinary context lengths. It is a memory-saving option, and paying for it without needing the memory is a straight loss. It also requires flash attention to be enabled: setting it without that makes the model fail to load entirely, and the server returns errors to every request.',
  },
  {
    question: 'Does flash attention help on AMD GPUs?',
    answer: 'In our testing, yes, and considerably. We suspected it would hurt on ROCm and tested rather than assumed: it was worth 10 percent of generation and 14 percent of prompt processing on a dense 7B model, and 89 percent of prompt processing on the mixture-of-experts model we actually serve. Turning it off after testing only the small model would have damaged the workload we care about most.',
  },
]

export default function Page() {
  return (
    <BlogPost title="My GPU Benchmark Was Measuring a Cold Model" description="We published a comparison of two GPUs running local language models. One of its findings was wrong, and the way it was wrong is more interesting than the finding." date="2026-09-08" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <p>
        We published a comparison of two GPUs running local language models. One of
        its findings was wrong, and the way it was wrong is more interesting than the
        finding.
      </p>
      <p>
        We said the AMD card lost at prompt processing: 2,665 tokens per second
        against the NVIDIA card&rsquo;s 3,381, despite far more paper compute, and
        concluded that this pointed at immature drivers rather than hardware. It was a
        plausible story and we believed it for a week.
      </p>
      <p>
        It was a cold model. The first request after a model loads into memory
        under-reports prompt processing by about 25 percent, and the server reports its
        load time as roughly one millisecond either way, so nothing tells you. We had
        measured a freshly loaded AMD card against a warmed-up NVIDIA one and read the
        difference as an architectural finding.
      </p>
      <p>
        Warm against warm, prompt processing is a dead heat: 3,443 against 3,409, a
        difference of one percent. The original article now carries a dated correction.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What the real difference is</h2>
      <p>
        Token generation is bound by memory bandwidth. The model&rsquo;s weights are
        read once per word produced, so the ceiling is memory speed divided by model
        size. The AMD RX 7900 XT moves data at 800 GB/s; the NVIDIA RTX 3070 at 448. On
        paper the AMD card should be 1.8 times faster.
      </p>
      <p>It is 1.2 times faster.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Card</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Bandwidth</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Ceiling</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Measured</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Efficiency</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['RX 7900 XT', '800 GB/s', '163 tok/s', '98', '60%'],
              ['RTX 3070', '448 GB/s', '91 tok/s', '81', '89%'],
            ].map(([card, bw, ceiling, measured, eff]) => (
              <tr key={card} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{card}</td>
                <td className="px-3 py-2 text-center">{bw}</td>
                <td className="px-3 py-2 text-center">{ceiling}</td>
                <td className="px-3 py-2 text-center">{measured}</td>
                <td className="px-3 py-2 text-center">{eff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The NVIDIA card converts nearly all of its bandwidth into tokens. The AMD card
        converts three fifths of it. That gap, not the imaginary prompt-processing one,
        is the real story.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Eliminating everything else</h2>
      <p>
        We spent a day removing explanations rather than adding them. The runtime was
        current: ROCm 7.2, targeting the exact GPU architecture. The right backend was
        selected, which mattered to check because the software also ships a Vulkan path
        that would have been much slower. The card was not throttling, running at its
        rated memory clock, 63 degrees, 107 watts. The PCIe link was full width. The
        host CPU was not the limit. The network between the machines could not affect
        the numbers, because they come from counters inside the server process rather
        than from timing the request.
      </p>
      <p>
        Two configuration settings turned out to matter, in opposite directions.
      </p>
      <p>
        A quantised key-value cache, enabled to save memory, was costing 5.4 percent of
        generation speed. It saves under one percent of memory traffic on a model this
        size and charges several times that in unpacking. It is a memory-saving option
        and we had no memory problem.
      </p>
      <p>
        Flash attention, which we suspected of hurting on AMD, was helping: 10 percent
        of generation speed and 14 percent of prompt processing. On the
        mixture-of-experts model we actually serve, it is worth 89 percent of prompt
        processing. Had we tested only the small model and turned it off, we would have
        damaged the thing we were trying to improve.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where the missing bandwidth goes</h2>
      <p>
        The model file is compressed, and each piece has to be unpacked as it is read.
        There are several compression formats. We changed only the format, holding
        everything else constant.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Card</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Format</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Size</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Ceiling</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Measured</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Efficiency</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['RX 7900 XT', 'Q4_K_M', '4.9 GB', '163', '98', '60%'],
              ['RX 7900 XT', 'Q8_0', '8.1 GB', '99', '76', '77%'],
              ['RTX 3070', 'Q4_K_M', '4.9 GB', '91', '81', '89%'],
            ].map(([card, fmt, size, ceiling, measured, eff]) => (
              <tr key={`${card}-${fmt}`} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{card}</td>
                <td className="px-3 py-2 text-center">{fmt}</td>
                <td className="px-3 py-2 text-center">{size}</td>
                <td className="px-3 py-2 text-center">{ceiling}</td>
                <td className="px-3 py-2 text-center">{measured}</td>
                <td className="px-3 py-2 text-center">{eff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Seventeen points of efficiency appear when the unpacking gets simpler. Q4_K
        unpacks a super-block structure with nested scales; Q8_0 is close to a multiply.
        The NVIDIA implementation absorbs that complexity and still reaches 89 percent.
        The AMD one does not.
      </p>
      <p>
        So the answer is not that the card is slow. It is that one routine, the one that
        unpacks the most popular compression format on AMD hardware, does not keep the
        memory controller busy. That is a narrow enough claim to report upstream, which
        is where it has gone.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The part we keep relearning</h2>
      <p>
        Every wrong conclusion here came from the same place: a number measured under
        conditions we had not recorded.
      </p>
      <p>
        The cold model. A configuration file with a typo that left a setting unset for
        weeks while appearing to set it. Two machines we believed were configured
        identically and were not. A measurement run we could not attribute afterwards,
        because the tool printed a label we had typed rather than the configuration it
        found.
      </p>
      <p>
        The tooling now prints the machine&rsquo;s real configuration beside every
        result. That single change would have prevented three of the four errors.
      </p>
      <p>
        Absolute speed, for what it is worth: the AMD card is 21 percent faster than the
        NVIDIA one at generation and level at prompt processing. It is a good card. It
        is not the card its specifications describe, and no amount of configuration
        closes the difference. That takes somebody rewriting a kernel.
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
        The original comparison, with its correction, is at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/benchmarking-our-benchmark">
          Benchmarking Our Benchmark
        </a>
        . A separate case of the same mistake, where a retrieval comparison measured a
        database index that was never used, is at{' '}
        <a className="text-zeever-primary hover:underline" href="/research/turbopuffer-vs-pgvector">
          Turbopuffer vs pgvector
        </a>
        .
      </p>
    </BlogPost>
  )
}

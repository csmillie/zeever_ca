import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/benchmarking-our-benchmark'

const TITLE = 'I Benchmarked 17 Models. The Problem Was My Benchmark.'
const DESCRIPTION =
  'Seventeen models scored within nine points of each other. Then I checked the benchmark itself and watched retrieval accuracy fall from 89 percent to 56.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
  },
}

const FAQS = [
  {
    question: 'Which model should a Canadian RAG system use?',
    answer:
      'On my 100 Toronto service questions, it barely matters. Seventeen models spanning Together, Cohere, Augure and two local Ollama boxes scored between 0.885 and 0.975 on judged relevance, and if you drop the single weakest model the range is five points across sixteen models. Groundedness sat between 0.905 and 0.995. When every model answers a question about equally well, the answer is being decided by retrieval and by the prompt, not by the model. I now run gpt-oss:20b locally on an AMD RX 7900 XT because it is free, private, and indistinguishable in quality from a paid model at roughly a dollar per hundred questions.',
  },
  {
    question: 'How does an AMD RX 7900 XT compare to an NVIDIA card for local inference?',
    answer:
      'The AMD card has 1.8 times the memory bandwidth and converts it into 1.21 times the tokens. Running the same model, same quantization and same prompt, warm on both, the RX 7900 XT reached 60 percent of its theoretical bandwidth under ROCm while an RTX 3070 reached 89 percent under CUDA. Prompt processing is a tie at roughly 3,420 tokens per second. An earlier version of this article reported the AMD card losing prompt processing; that measurement compared a cold model against a warm one and is corrected in the text. Further testing narrowed the decode gap to one place: llama.cpp’s HIP backend reaches 60 percent of theoretical memory bandwidth decoding a Q4_K_M model on gfx1100, where the same card reaches 77 percent on Q8_0 and the CUDA backend reaches 89 percent on Q4_K_M. The 7900 XT still earns its place because 20GB of VRAM is what lets it hold a 20 billion parameter model at all.',
  },
  {
    question: 'What is the difference between measuring relevance and measuring grounding?',
    answer:
      'Relevance asks whether the answer addressed the question. Grounding asks whether the retrieved sources actually support it. A model can score full marks on the first while inventing the answer, and my judge was doing exactly that. It rated a fabricated water account signup procedure at 1.00 relevance, and rated a model that correctly said the evidence did not cover the question at 0.50. Scoring relevance multiplied by groundedness, and counting how often a model answered confidently from sources that did not support it, changed the ranking and pointed at real defects.',
  },
  {
    question: 'Why did your retrieval accuracy drop from 89 percent to 56 percent?',
    answer:
      'Three different measurements, each more honest than the last. The 89 figure counted a retrieval as successful if any returned page URL contained an expected substring, and 81 of my 100 questions used a substring so broad it matched a whole section of the site. One question expected the word water, which matches 431 pages. Scoring only the 19 questions with a specific expectation gave 68 percent. Sampling 300 random pages from the corpus, generating the question each answers and checking whether that page came back gave 56 percent. Nothing got worse. I just stopped grading myself generously.',
  },
  {
    question: 'What was missing from your Toronto.ca crawl?',
    answer:
      'The 311 knowledge base, which is where the City publishes its how do I report this answers. Toronto.ca publishes a sitemap listing eight WordPress page sitemaps and nothing else, and robots.txt declares no other sitemap, so a sitemap driven crawler never sees the knowledge base at all. Three questions I had concluded Toronto simply does not answer are all answered there, including the street sweeping schedule: arterial roads twice a month, collector roads monthly, local roads every two months. I found it by searching Toronto.ca directly instead of trusting my own index.',
  },
]

export default function Page() {
  return (
    <BlogPost title={TITLE} description={DESCRIPTION} date="2026-08-30" url={PAGE_URL}>
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          I set out to pick a model. I ran seventeen of them against a hundred Toronto service questions, including
          Canadian provider Augure and two local Ollama servers, one of them a new AMD RX 7900 XT. The models finished
          within nine points of each other, which was the first sign that I was measuring the wrong thing. Following
          that thread cost a week and turned up a scorer that rewarded confident invention, a benchmark that graded
          itself on a section of the website rather than a page, a parser that stored every heading twice, a write path
          that duplicated a page on every crawl, and an entire content section of Toronto.ca I had never fetched. My
          retrieval accuracy did not change. My estimate of it fell from 89 percent to 56.
        </p>
      </div>

      <p>
        Zeever answers questions about City of Toronto services using Toronto.ca content. Every answer has to come from
        retrieved evidence, and the system is supposed to say so plainly when the evidence runs out. That second rule is
        the hard one, and it is the one this work turned out to be about.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Two GPUs, one lesson about bandwidth</h2>

      <p>
        The local side of the comparison runs on two machines. A Dell XPS with an NVIDIA RTX 3070, 8GB, and an HP Z640
        workstation with an AMD Radeon RX 7900 XT, 20GB, running ROCm. Both reachable over Tailscale from the VPS that
        serves the site.
      </p>

      <p>
        I expected the AMD card to win comfortably. It has 800 GB/s of memory bandwidth against the 3070&rsquo;s 448,
        and token generation is bandwidth bound: the model weights are read once per token, so throughput is bytes moved
        divided by bytes per token. On paper that is a 1.8x advantage. I measured 1.21x.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Card</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Bandwidth</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Prefill</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Decode</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Efficiency</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['RTX 3070 (CUDA)', '448 GB/s', '3,409 tok/s', '81 tok/s', '89%'],
              ['RX 7900 XT (ROCm)', '800 GB/s', '3,430 tok/s', '98 tok/s', '60%'],
            ].map(([card, bw, prefill, decode, eff]) => (
              <tr key={card} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{card}</td>
                <td className="px-3 py-2 text-center">{bw}</td>
                <td className="px-3 py-2 text-center">{prefill}</td>
                <td className="px-3 py-2 text-center">{decode}</td>
                <td className="px-3 py-2 text-center">{eff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        Same model, same quantization, same prompt, and a warm model on both with the first run discarded. Efficiency
        is measured throughput against the card&rsquo;s theoretical bandwidth ceiling. These figures replace the
        originals; see the correction below.
      </p>

      <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong>Correction, 1 September 2026.</strong> This section originally reported that the AMD card also loses
          on prompt processing, 2,665 tokens per second against 3,381, and reasoned from that to a conclusion about
          kernel maturity. That measurement was wrong. It compared a freshly loaded model on the AMD host against a
          warmed up one on the NVIDIA host. The first request after a model loads under reports prompt processing by
          about 25 percent, and the server reports its load time as roughly a millisecond either way, so nothing warns
          you. Warm against warm, prompt processing ties: 3,430 against 3,409, reproduced across four prompt sizes with
          run to run spread under one percent. The table above carries the corrected figures.
        </p>
      </div>

      <p>
        The decode gap is real, and further testing found where it goes. First I checked the card was not throttling by
        sampling its clocks during a generation, and it was not: memory pinned at 1,249 MHz, 250 watts, 63 degrees. Then
        I tested the two settings I had been guessing about, one at a time, with the live configuration printed before
        each run. A quantized KV cache was costing 5.4 percent of decode while saving under one percent of memory
        traffic, so it came out. Flash attention, which I had suspected of hurting on ROCm, was helping by 10 percent,
        so it stayed. Neither explained the shortfall.
      </p>

      <p>
        Changing the quantization format did. The model file is compressed and each piece is unpacked as it is read, and
        holding everything else constant while changing only that format moves the number a long way.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Card</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Format</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Size</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Ceiling</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Decode</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Efficiency</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['RX 7900 XT', 'Q4_K_M', '4.9 GB', '163 tok/s', '98 tok/s', '60%'],
              ['RX 7900 XT', 'Q8_0', '8.1 GB', '99 tok/s', '76 tok/s', '77%'],
              ['RTX 3070', 'Q4_K_M', '4.9 GB', '91 tok/s', '81 tok/s', '89%'],
            ].map(([card, fmt, size, ceil, decode, eff]) => (
              <tr key={card + fmt} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{card}</td>
                <td className="px-3 py-2 text-center">{fmt}</td>
                <td className="px-3 py-2 text-center">{size}</td>
                <td className="px-3 py-2 text-center">{ceil}</td>
                <td className="px-3 py-2 text-center">{decode}</td>
                <td className="px-3 py-2 text-center">{eff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        So the finding is narrower than kernel maturity in general, and narrow enough to report upstream:
        llama.cpp&rsquo;s HIP backend reaches 60 percent of theoretical memory bandwidth decoding a Q4_K_M model on
        gfx1100, where the same card reaches 77 percent on Q8_0 and the CUDA backend reaches 89 percent on Q4_K_M.
        Q4_K unpacks a super block structure with nested scales; Q8_0 is a multiply. The CUDA implementation absorbs
        that complexity and still saturates memory. The HIP one does not. That matters to more people than me, because
        Q4_K is what most people run locally.
      </p>

      <p>
        What did work was changing the model. An MoE model activates a fraction of its parameters per token, so it moves
        fewer bytes, so it decodes faster even when it is much larger.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model on the RX 7900 XT</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Type</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Decode</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Median query</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['qwen2.5:7b-instruct', 'dense', '95 tok/s', '3,224ms', false],
              ['qwen3:14b', 'dense', '53 tok/s', '4,767ms', false],
              ['gpt-oss:20b', 'MoE', '113 tok/s', '2,819ms', true],
            ].map(([model, type, decode, median, selected]) => (
              <tr
                key={model as string}
                className={`border-t border-zeever-accent/10 ${selected ? 'bg-zeever-primary/5' : ''}`}
              >
                <td className="px-3 py-2 font-medium">
                  {model as string}
                  {selected ? <span className="text-xs text-zeever-primary ml-1">(selected)</span> : null}
                </td>
                <td className="px-3 py-2 text-center">{type as string}</td>
                <td className="px-3 py-2 text-center">{decode as string}</td>
                <td className="px-3 py-2 text-center">{median as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        The 20 billion parameter model is the fastest of the three, and it beats a 7 billion parameter dense model on
        the same card. The 20GB of VRAM on the AMD workstation is what makes that possible. So the card earns its place,
        just not on the axis the specifications suggest. Its value is capacity, not speed.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Seventeen models, nine points apart</h2>

      <p>
        With the local side sorted I ran the full comparison: four Together models, four from Cohere, three from
        Canadian provider Augure, and six local models across the two Ollama boxes. One hundred questions each, 1,700
        generations, judged by Llama 3.3 70B. Total cost of the paid arms was $3.80.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Model</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Relevance</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Grounded</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Median</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Cost / 100</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['gpt-oss-20b (Together)', '0.975', '0.965', '2,217ms', '$0.02'],
              ['llama-3.3-70b (Together)', '0.970', '0.975', '2,722ms', '$0.30'],
              ['command-a (Cohere)', '0.965', '0.980', '2,842ms', '$0.91'],
              ['qwen3.5-9b (Together)', '0.960', '0.990', '2,722ms', '$0.05'],
              ['gpt-oss:20b (local, AMD)', '0.960', '0.970', '2,825ms', 'free'],
              ['tofino-3 (Augure)', '0.950', '0.985', '4,276ms', '$0.16'],
              ['rosedale-1 (Augure)', '0.945', '0.995', '6,225ms', '$0.67'],
              ['command-a-plus (Cohere)', '0.924', '0.960', '2,151ms', '$1.15'],
              ['ossington-5 (Augure)', '0.885', '0.905', '1,953ms', '$0.42'],
            ].map(([model, rel, grnd, median, cost]) => (
              <tr key={model} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{model}</td>
                <td className="px-3 py-2 text-center">{rel}</td>
                <td className="px-3 py-2 text-center">{grnd}</td>
                <td className="px-3 py-2 text-center">{median}</td>
                <td className="px-3 py-2 text-center">{cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        Selected rows from a seventeen model run. Augure prices are converted from CAD. Costs are per hundred questions.
      </p>

      <p>
        Nine points separate the best model from the worst. Drop the single weakest and it is five points across
        sixteen. Every model was reading identical retrieved chunks, because I precompute retrieval once and share it
        across the run, so this is a clean comparison of what each model did with the same evidence. They all did about
        the same thing.
      </p>

      <p>
        That is a useful result even though it is a boring one. If model choice moves the answer by five points and
        costs range from free to $1.15 per hundred questions, the interesting decisions are elsewhere. Cohere&rsquo;s
        command-a-plus is the clearest illustration: the most expensive model in the run, and the weakest of every paid
        model on judged relevance.
      </p>

      <p>
        The Canadian provider held up. Augure&rsquo;s tofino-3 landed at 0.950 relevance and 0.985 groundedness for
        sixteen cents per hundred questions, and rosedale-1 posted the highest groundedness of anything I tested at
        0.995. Both are slower than the hosted American options, and ossington-5 was the weakest model in the field, so
        the lineup is uneven. But sovereignty did not cost quality, which is the thing I wanted to know.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The judge was scoring honesty at zero</h2>

      <p>
        One question in the set asks how to set up a new water account in Toronto. Two models said the retrieved
        evidence did not cover it. A third produced a confident five step procedure. The judge scored the invention at
        1.00 relevance and the honest answers at 0.50.
      </p>

      <p>
        The rubric was doing what I told it to. It ended with the line{' '}
        <em>0.0 = does not answer the question or says it cannot help</em>, which on a question the corpus cannot answer
        scores fabrication at one and honesty at zero. For a product whose entire premise is that answers come from
        cited Toronto.ca content, that is the wrong way round.
      </p>

      <p>
        I fixed the ranking first, by scoring relevance multiplied by groundedness and counting a quadrant I started
        calling confident plus: answers given confidently from sources that do not support them. That reordered the
        table immediately. Together&rsquo;s gpt-oss-20b, top of the relevance ranking, had seven such answers, the most
        of any model, and fell to tenth. Augure&rsquo;s rosedale-1 had none.
      </p>

      <p>
        Reading those answers rather than counting them showed the pattern. The models were answering from what they
        knew about Toronto instead of from the retrieved text. One told me potholes are repaired within four days on
        busy roads and thirty days on side streets, which is a real City service standard, correctly recalled, and
        absent from every chunk it was given. Correct by luck is indistinguishable from wrong by luck until it is
        wrong.
      </p>

      <p>
        So I rewrote the system prompt to name that failure. The evidence rule moved from one bullet among twelve to
        its own section near the top, it now tells the model that recognising an answer from training does not make it
        evidence, and it lists what has to be checked: phone numbers, fees, deadlines, form names, numbered steps. It
        also says plainly that a well supported question should be answered in full, because the obvious way to lose is
        trading invention for hedging.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Across three models</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Old prompt</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">New prompt</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Confident but unsupported', '7', '2'],
              ['Honest declines', '13', '26'],
              ['No answer and no grounding', '7', '5'],
            ].map(([metric, before, after]) => (
              <tr key={metric} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{metric}</td>
                <td className="px-3 py-2 text-center">{before}</td>
                <td className="px-3 py-2 text-center">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        The bottom row is the one that mattered. Buying grounding with refusals would have shown up as more answers with
        neither usefulness nor support, and that number went down. Five of the seven answers that left the risky
        quadrant kept full relevance while their groundedness went from 0.50 to 1.00. The models did not start
        declining. They kept answering and started doing it from the evidence.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Then I checked the benchmark</h2>

      <p>
        Along the way I had been quoting a retrieval accuracy of 89 percent, meaning that for 89 of 100 questions the
        page I expected appeared in the five chunks the app reads. The check is a substring: does any returned URL
        contain the expected fragment.
      </p>

      <p>
        I finally counted how many pages each of those fragments actually matches. One question expected the word{' '}
        <em>water</em>, which matches 431 pages in my corpus. Another expected <em>community-people</em>, which matches
        1,645. Nineteen of my hundred questions were scored against something specific enough to mean anything. The
        other 81 were being graded on whether retrieval stayed in the right neighbourhood.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Measurement</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Result</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">What it counts</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Original', '89%', 'Any URL containing a substring, often a whole site section'],
              ['Precise questions only', '68%', 'The 19 questions naming a specific page'],
              ['Corpus wide sample', '56%', '300 random pages, question generated from each'],
            ].map(([name, result, means]) => (
              <tr key={name} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{name}</td>
                <td className="px-3 py-2 text-center font-medium">{result}</td>
                <td className="px-3 py-2">{means}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Retrieval did not get worse between those three rows. I stopped grading myself generously. And the loose
        version was not merely flattering, it was actively concealing. The question about reporting a water main break
        scored a retrieval hit on every single run, because its expected fragment was <em>water</em>, while the page
        that answers it has never been in my index at all.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The section of Toronto.ca I had never crawled</h2>

      <p>
        Three questions kept failing in a way that looked like the City simply does not publish an answer: opening a
        water account, reporting a water main break, and when street cleaning happens. I had gone as far as marking
        them in the benchmark as questions where declining is the correct response.
      </p>

      <p>
        That was wrong, and the way I found out is worth recording. Every diagnostic I had ran inside my own index,
        so it could only ever tell me what my index contained. Searching Toronto.ca directly found all three answers
        immediately, in the 311 knowledge base, including the street sweeping schedule I had concluded did not exist:
        arterial roads twice a month, collector roads once a month, local roads every two months.
      </p>

      <p>
        Toronto.ca publishes a sitemap. It lists eight WordPress page sitemaps and nothing else, and robots.txt declares
        no other. The 311 knowledge base is a separate application, so a sitemap driven crawler cannot see it. My URL
        filter was not excluding it. I was simply never told it was there. And it is precisely where the City puts its
        how do I report this content, which is the most common shape of question a service assistant gets.
      </p>

      <p>
        A benchmark too loose to fail let a missing content section read as healthy retrieval, and I then treated my
        own silence as evidence about the world. That is the mistake I would most like not to repeat.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What I changed, and why</h2>

      <p>
        The rule I settled on partway through, and which I would now apply from the start: a retrieval change ships
        when a mechanism explains it, not because a benchmark moved. Every row below has a mechanism.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Change</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">Because</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Verdict</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Grounded system prompt', 'Models answered from training; the rule was one bullet among twelve', 'Shipped'],
              ['One chunk per page, not two', 'A duplicated page took 40 percent of the context window', 'Shipped'],
              ['Retire the old parse on re-crawl', '590 URLs parsed up to five times, 2,529 redundant chunks', 'Shipped'],
              ['Fix duplicated headings', 'Every heading stored twice; the parser emitted it from two branches', 'Shipped'],
              ['Score refusal properly', 'The rubric scored honesty at 0.0 relevance', 'Shipped'],
              ['Hybrid search with BM25', 'Lost on three separate measurements and damaged utility questions', 'Rejected'],
              ['Retrieve 8 chunks instead of 5', 'Two points of recall for 60 percent more context', 'Not yet earned'],
              ['Switch to a larger local model', 'Slower by 1.8 seconds with no measurable quality gain', 'Rejected'],
            ].map(([change, because, verdict]) => (
              <tr key={change} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{change}</td>
                <td className="px-3 py-2">{because}</td>
                <td className="px-3 py-2 text-center">{verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Hybrid search is the instructive rejection. It was already written and had never been called, so wiring it up
        felt like free improvement. At five chunks it scored 86 against dense search&rsquo;s 89. At ten chunks it scored
        93, the highest raw recall of anything I tested, which was tempting. But it damaged the same category of
        questions in every single run, and no mechanism explained why it should help. I left it behind a flag, turned
        off, with the evidence attached.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What is still wrong</h2>

      <p>
        The corpus wide sample gave me something the curated questions never could. Recall by section:
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Section</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Recall</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Pages sampled</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['community-people', '86%', '35'],
              ['city-government', '79%', '43'],
              ['services-payments', '78%', '23'],
              ['explore-enjoy', '65%', '17'],
              ['wp-content (PDFs)', '38%', '165'],
            ].map(([section, recall, n]) => (
              <tr key={section} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{section}</td>
                <td className="px-3 py-2 text-center">{recall}</td>
                <td className="px-3 py-2 text-center">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        HTML retrieval is fine. The 56 percent headline is dragged down by PDFs, which are 55 percent of the sample and
        the majority of my corpus: 10,800 parsed PDFs against 7,700 HTML pages. Some of them are genuinely useful and
        retrieve badly, with titles like <em>8Ccb Monthlyutilitybillingapplication</em> derived from filenames. Others
        are engineering specifications, council background files and municipal code chapters that no resident would ever
        ask about, where the eval invents a question and then correctly fails to find it.
      </p>

      <p>
        My gap analysis has been listing 13,695 uncrawled PDFs as outstanding work. On this evidence, fetching them
        would roughly double the worst performing content class while the section people actually ask about stays
        missing. That decision now needs numbers behind it rather than a completeness instinct.
      </p>

      <p>
        Three things are queued. Crawling the 311 knowledge base, which needs link following the crawler does not have.
        Narrowing the 81 loose expectations so the benchmark can see improvement at all. And working out which PDFs
        belong in a resident facing corpus. I will keep the corpus wide sample running alongside the hundred questions,
        because a hundred precise targets is exactly the kind of thing a system can be tuned to hit while getting worse
        everywhere else.
      </p>

      <p>
        The models were never the problem. Seventeen of them, from three continents and two price brackets, agreed with
        each other to within a few points. What separated a good answer from a fabricated one was whether the right page
        was retrieved and whether the prompt told the model that remembering is not the same as knowing. I spent a week
        learning to measure those two things, and I am still not finished.
      </p>
    </BlogPost>
  )
}

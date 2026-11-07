import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/ai-isnt-the-next-2008'
// Originally published on colinsmillie.com. That copy is canonical; this one is a syndicated republish.
const CANONICAL_URL =
  'https://colinsmillie.com/2026/08/12/ai-isnt-the-next-2008-but-its-financial-system-is-starting-to-rhyme/'

const TITLE = 'AI Isn’t the Next 2008. Its Finances Are Starting to Rhyme.'
const DESCRIPTION =
  'Data-centre securitization went from $4 billion in 2020 to about $61 billion today. SEC staff say qualifying versions are not asset-backed. The risk is opacity.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL_URL,
  },
}

const FAQS = [
  {
    question: 'What did the SEC actually decide about data-centre securitizations?',
    answer:
      'On July 29, SEC staff agreed with a request from Latham & Watkins that certain securities used to finance data centres are not legally “asset-backed securities” under the definition Congress wrote after the 2008 crisis. That is a reading of a statutory definition, not a repeal of Dodd-Frank, and it applies to transactions with the characteristics Latham described. The practical effect is that a fast-growing corner of structured finance sits outside rules built specifically to make securitization safer.',
  },
  {
    question: 'How big is the data-centre securitization market?',
    answer:
      'Roughly $61 billion of outstanding data-centre ABS and CMBS today, up from about $4 billion in 2020. Barclays projects it could reach $180 billion by the end of 2028. On my reading of public transaction and rating information, something like $25 to $35 billion of the current market depends directly on Microsoft, Amazon, Meta, Google, and Oracle, and 60 to 70% depends on the same AI and cloud investment cycle once you include CoreWeave and similar providers.',
  },
  {
    question: 'Is this the same as subprime mortgages?',
    answer:
      'No. In 2008 the underlying borrowers were millions of financially vulnerable households. Here they are some of the most profitable companies in history. The funding is also different in a way that matters: pre-crisis institutions financed thirty-year mortgage assets with money that could be pulled overnight, which is how a price problem became a bank run. Data-centre bonds generally use multi-year financing against long-term leases, and there is none of the CDO-of-CDO engineering or synthetic credit-default-swap exposure that amplified the last crisis.',
  },
  {
    question: 'Can this debt go bad if Microsoft never misses a payment?',
    answer:
      'Yes, and that is the scenario worth thinking about. Take a $2 billion facility with a long-term lease that gets paid in full. If hardware efficiency improves, rack densities rise, new capacity floods the market, and hyperscalers slow expansion, the building is still useful but simply worth less. When the financing hits its refinancing date, a property once valued at $2 billion might only support $1.4 billion of debt, and somebody has to cover the gap. That is a commercial-real-estate refinancing problem layered on a technology investment bust, not a credit default.',
  },
  {
    question: 'What is the actual risk if it is not 2008?',
    answer:
      'Opacity. The securitization market is only the visible layer. Underneath it sits construction lending, private credit worth roughly $1.3 trillion by the new New York and Dallas Fed survey’s measure, bank facilities extended to those private-credit funds, pension and insurance money invested in all of it, and now Nvidia working with Apollo, BlackRock, Blackstone, Brookfield, Goldman Sachs, and KKR on platforms targeting more than $500 billion, with GPUs as collateral and Nvidia potentially backstopping up to 25% of collateral value. The Bank of England, the Federal Reserve, and the Financial Stability Board are all examining pieces of it. Nobody appears to have the whole map, and you cannot build one from public information.',
  },
]

export default function Page() {
  return (
    <BlogPost
      title={TITLE}
      description={DESCRIPTION}
      date="2026-08-12"
      url={PAGE_URL}
      canonicalUrl={CANONICAL_URL}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          Data-centre securitization has gone from $4 billion in 2020 to roughly $61 billion today, and on July 29 SEC staff agreed that qualifying versions aren&rsquo;t legally asset-backed securities, which puts them outside the safeguards Congress wrote after 2008. This isn&rsquo;t subprime. The tenants are among the richest companies ever created, the structures are simpler, and there&rsquo;s no sign of the runnable short-term funding that turned a housing problem into a bank run. The closer analogy is the dot-com fibre overbuild, where being right about demand still destroyed enormous amounts of capital. What actually worries me is underneath: private credit, bank facilities to those funds, pension and insurance money, and Nvidia&rsquo;s new $500 billion financing platforms where GPUs become collateral. I tried to map who ultimately takes the loss if AI infrastructure is worth 30% less than expected, and public information won&rsquo;t let you. That opacity is the most 2008-like thing I found.
        </p>
      </div>

      <p>Something strange happened at the SEC two weeks ago.</p>
      <p>It sounds obscure, but bear with me.</p>
      <p>
        On July 29, SEC staff agreed with a request from Latham &amp; Watkins that certain securities used to finance data centres are not legally &ldquo;asset-backed securities.&rdquo;
      </p>
      <p>
        That matters because after the 2008 financial crisis, Congress created rules specifically meant to make securitization safer: risk-retention requirements, conflict-of-interest restrictions, due-diligence disclosures, and other safeguards.
      </p>
      <p>Data-centre financing can look a lot like securitization.</p>
      <p>
        A developer builds a multi-billion-dollar data centre. Microsoft, Meta, Amazon, Google, Oracle, or another large customer signs a long-term lease. The developer puts the operating assets into a financing structure. Bonds are issued against the expected cash flows. Institutional investors buy them.
      </p>
      <p>Everyone in finance even calls these transactions data-centre securitizations.</p>
      <p>
        But according to the SEC staff&rsquo;s new interpretation, qualifying versions aren&rsquo;t actually asset-backed securities under the post-financial-crisis statutory definition.
      </p>
      <p>That&rsquo;s worth paying attention to. This tiny corner of finance isn&rsquo;t tiny anymore.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">From $4 billion to $61 billion</h2>
      <p>In 2020, there were about $4 billion of outstanding data-centre ABS and CMBS securities.</p>
      <p>Today there are approximately $61 billion.</p>
      <p>Barclays projects the market could reach $180 billion by the end of 2028.</p>
      <p>
        AI is turning data centres into{' '}
        <a href="/research/canadian-data-centres/infrastructure-race" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          one of the largest infrastructure construction booms in history
        </a>
        , and securitization is becoming an important part of financing it.
      </p>
      <p>
        The mechanism is efficient. A developer such as QTS, Compass, Switch, CyrusOne, or DataBank raises construction financing and builds a data centre. A hyperscaler signs a long-term contract. Once the building is operating and producing predictable revenue, the developer refinances it through ABS or CMBS. That returns capital to the developer, who uses the money to build another data centre. Then another.
      </p>
      <p>
        The Structured Finance Association describes securitization as a way of recycling capital into future development.
      </p>
      <p>That&rsquo;s not inherently bad. It&rsquo;s actually what modern capital markets are good at doing.</p>
      <p>
        But then I started wondering who ultimately bears all this risk. That&rsquo;s where things get more interesting.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The $61 billion isn&rsquo;t as diversified as it looks</h2>
      <p>
        Take a data-centre securitization backed by four facilities leased to four different investment-grade companies.
      </p>
      <p>That sounds reassuringly diversified.</p>
      <p>
        Except those four companies might effectively be Microsoft, Amazon, Meta, and Google. Or Oracle. Or CoreWeave. Or another company whose own economics ultimately depend on selling AI compute to OpenAI and other AI companies.
      </p>
      <p>
        I tried reconstructing the $61 billion market issuer by issuer. Exact numbers are impossible because major tenants are frequently described in financing documents simply as &ldquo;confidential investment-grade hyperscale tenants.&rdquo;
      </p>
      <p>
        But my estimate from publicly available transaction and rating information is that somewhere around $25 to $35 billion of the $61 billion market may be directly dependent on Microsoft, Amazon, Meta, Google, and Oracle. Call it roughly half.
      </p>
      <p>
        Expand the definition to include CoreWeave and other AI-oriented cloud providers, and perhaps 60 to 70% of the market ultimately depends on the same AI/cloud investment cycle.
      </p>
      <p>
        That&rsquo;s not necessarily dangerous. But it means apparent credit diversification may hide considerable economic concentration.
      </p>
      <p>
        A Microsoft lease and an Oracle lease are two different credits. But if both companies need those facilities because they expect extraordinary growth in AI compute consumption, they share an important underlying risk.
      </p>
      <p>That&rsquo;s our first uncomfortable echo of 2008.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">But this is absolutely not subprime mortgages</h2>
      <p>This distinction matters.</p>
      <p>
        In 2008, the underlying borrowers included millions of financially vulnerable households. Today&rsquo;s data-centre tenants frequently include some of the richest corporations ever created.
      </p>
      <p>Microsoft isn&rsquo;t a subprime homeowner. Neither is Amazon.</p>
      <p>
        The financing structures themselves are also considerably safer in another respect. Before 2008, financial institutions frequently owned long-term mortgage securities financed with extremely short-term money. Thirty-year assets could effectively be funded overnight. When lenders stopped rolling that financing over, institutions suddenly needed cash they didn&rsquo;t have. That&rsquo;s how an asset-price problem became a bank run.
      </p>
      <p>
        Today&rsquo;s data-centre bonds generally use multi-year financing against long-term contracts. I haven&rsquo;t found evidence of anything approaching the enormous runnable short-term funding system that existed around mortgages before 2008.
      </p>
      <p>
        Nor do we yet have the extraordinary financial engineering that turned mortgages into mortgage-backed securities, then pieces of those securities into CDOs, then pieces of those CDOs into more securities, while credit-default swaps let investors create synthetic exposures on top.
      </p>
      <p>Today&rsquo;s structure is mostly much simpler: data centre, lease revenue, bond.</p>
      <p>
        That difference matters. An AI infrastructure bust could be very expensive without becoming another Lehman Brothers.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The more interesting comparison may be the dot-com fibre boom</h2>
      <p>
        The late-1990s telecom boom started from a fundamentally correct observation: internet traffic was going to explode.
      </p>
      <p>It did.</p>
      <p>
        But investors made an enormous leap from that observation. They assumed building almost unlimited amounts of fibre infrastructure would produce attractive returns. That didn&rsquo;t follow.
      </p>
      <p>
        The resulting overbuild destroyed enormous amounts of capital even though the internet ultimately became far bigger than its most enthusiastic proponents imagined.
      </p>
      <p>
        AI could produce the same paradox. AI might transform the global economy. AI compute demand might grow enormously. And we might still build too many data centres at the wrong prices,{' '}
        <a href="/research/canadian-data-centres/power" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          in the wrong places
        </a>
        , using assumptions about utilization and future rents that turn out to be wildly optimistic.
      </p>
      <p>You don&rsquo;t need AI to fail for AI infrastructure investments to fail.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">And the debt doesn&rsquo;t require Microsoft to default</h2>
      <p>
        Imagine a $2 billion data centre with a long-term Microsoft lease. Microsoft keeps paying every dollar it owes.
      </p>
      <p>
        But five years from now AI hardware is dramatically more efficient. New facilities support much higher rack densities and better cooling. New data-centre capacity has flooded the market. Hyperscalers have slowed expansion.
      </p>
      <p>The building is still useful. It&rsquo;s simply worth less than investors expected.</p>
      <p>
        Then its financing reaches a refinancing date. A property previously valued at $2 billion might now support only $1.4 billion of debt. Someone has to supply the difference.
      </p>
      <p>
        That&rsquo;s a very different crisis from subprime mortgages. It&rsquo;s closer to a commercial-real-estate refinancing problem combined with a technology investment bust.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Then I followed the money another level down</h2>
      <p>The $61 billion securitization market isn&rsquo;t actually the most interesting part.</p>
      <p>
        Before a data centre can be securitized, somebody has to finance its construction. Increasingly{' '}
        <a href="/research/canadian-data-centres/capital" className="text-zeever-text underline hover:text-zeever-primary transition-colors">
          that money comes from a mix of banks and enormous private-capital firms
        </a>{' '}
        such as Blackstone, Apollo, KKR, Ares, Blue Owl, Brookfield, and BlackRock.
      </p>
      <p>
        Private credit has exploded since the financial crisis. One common misconception is that moving loans from banks to private-credit funds moves the risk outside the banking system. Not necessarily. Banks themselves provide credit facilities to private-credit funds.
      </p>
      <p>
        So the chain can look like this: bank to private-credit fund to data-centre developer to hyperscaler lease.
      </p>
      <p>
        Meanwhile, pension funds and insurers invest in those private-credit funds. They also buy the resulting data-centre bonds. An asset manager might own the developer, lend to the project, and manage funds that eventually purchase related credit.
      </p>
      <p>The individual transactions may be perfectly sensible. The network is harder to understand.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Nvidia just added another layer</h2>
      <p>
        This week Nvidia announced something that makes this question even more interesting. It is working with Apollo, BlackRock, Blackstone, Brookfield, Goldman Sachs, and KKR on financing platforms meant to mobilize more than $500 billion for AI computing infrastructure.
      </p>
      <p>
        Nvidia may potentially backstop as much as 25% of collateral value in some structures. And Nvidia hardware itself can become collateral.
      </p>
      <p>
        Think about that loop. Nvidia sells GPUs. AI companies need enormous amounts of money to buy them. Financial institutions create financing structures that let more companies afford GPUs. The GPUs secure the financing. Nvidia potentially supports part of their collateral value. More financing creates more customers capable of buying Nvidia GPUs.
      </p>
      <p>
        None of that is inherently improper. Vendor financing has existed forever. But circular financing systems deserve scrutiny precisely because they can make demand, credit creation, and asset values reinforce one another on the way up. And potentially on the way down too.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">This is where shadow banking enters the picture</h2>
      <p>
        Shadow banking sounds sinister, but it really means credit intermediation happening outside traditional deposit-taking banks.
      </p>
      <p>
        A genuine shadow-finance architecture is now developing around AI: corporate debt, hyperscaler leases, construction loans, private credit, infrastructure funds, ABS, CMBS, GPU financing, vendor guarantees, and institutional investors, all layered together.
      </p>
      <p>
        The ultimate money often comes from pension funds, insurers, sovereign investors, and asset managers. Banks haven&rsquo;t disappeared. They provide project financing, underwrite securities, and lend to the private-credit vehicles financing other parts of the system.
      </p>
      <p>That&rsquo;s an interconnected financial network. Regulators are starting to notice.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Regulators aren&rsquo;t asleep this time</h2>
      <p>This is another important difference from the simplistic 2008 analogy.</p>
      <p>
        The Bank of England is already explicitly warning that increasing complexity and opacity in AI-related debt structures could create financial-stability risks. The Federal Reserve is examining bank connections to private credit. The Financial Stability Board is studying leverage and interconnectedness across private-credit markets. And just last week, the New York and Dallas Federal Reserve Banks announced a new survey meant to help regulators understand the private-credit market better.
      </p>
      <p>
        That last point is simultaneously reassuring and a little alarming. Private credit is already a roughly $1.3 trillion market by the Fed survey&rsquo;s measure. And regulators are still building tools to understand it.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Which brings us back to the SEC</h2>
      <p>
        This is what makes the SEC decision so interesting. One group of regulators is effectively saying: AI finance is becoming large, interconnected, and hard to see. We need to understand the network better.
      </p>
      <p>
        Meanwhile SEC staff has looked at one rapidly growing piece of that network and concluded these aren&rsquo;t legally asset-backed securities under the statutory definition.
      </p>
      <p>
        That conclusion may be completely correct as a matter of securities law. The SEC isn&rsquo;t repealing Dodd-Frank. It&rsquo;s interpreting a definition Congress wrote after the financial crisis, and its position applies to transactions with the characteristics described by Latham &amp; Watkins.
      </p>
      <p>But there&rsquo;s a larger policy question hiding underneath the legal one.</p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The lesson from 2008 wasn&rsquo;t just &ldquo;regulate mortgage-backed securities&rdquo;</h2>
      <p>
        It was that regulators spent too much time examining financial institutions and financial products individually.
      </p>
      <p>
        A mortgage looked manageable. A mortgage-backed security looked manageable. A CDO looked manageable. A repo transaction looked manageable. An insurance contract written by AIG looked manageable.
      </p>
      <p>
        The catastrophe was in the connections between them. The system behaved differently from its individual components.
      </p>
      <p>
        That&rsquo;s the part of today&rsquo;s AI financing boom that worries me. Not because I think QTS bonds are secretly subprime mortgages. They&rsquo;re not. Not because I think Microsoft is about to stop paying its data-centre leases. It probably isn&rsquo;t. And not because $61 billion of data-centre securities could crash the financial system. It couldn&rsquo;t.
      </p>
      <p>
        My concern is the direction of travel. The securitization market went from $4 billion in 2020 to $61 billion today and could reach $180 billion by 2028. Private credit is simultaneously moving aggressively into AI infrastructure. The largest technology companies have made{' '}
        <a href="https://colinsmillie.com/2026/05/22/ai-capex-is-becoming-the-new-arms-race/" className="text-zeever-text underline hover:text-zeever-primary transition-colors" rel="noopener">
          extraordinary long-term infrastructure commitments
        </a>
        . And now Nvidia and some of the largest financial institutions in the world are discussing another potential $500 billion financing ecosystem for compute.
      </p>
      <p>
        Each piece can make perfect sense individually. The question is whether anybody has a complete picture of the system they&rsquo;re collectively creating.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">That&rsquo;s the question I wish regulators could answer</h2>
      <p>
        I&rsquo;d like to see a map that looks something like this: JPMorgan, Goldman, and Morgan Stanley, down to Apollo, Blackstone, KKR, and Brookfield, down to QTS, Compass, Vantage, Switch, and CyrusOne, down to Microsoft, Meta, Amazon, Google, Oracle, and CoreWeave, down to OpenAI, Anthropic, xAI, and enterprise AI demand.
      </p>
      <p>
        And then overlay who owns the bonds, who supplied the private credit, who guaranteed the loans, who owns the equity, who financed the funds, who holds the derivatives, and who ultimately takes the loss if AI infrastructure is worth 30% less than everyone expected.
      </p>
      <p>I tried to build that map from public information. You can&rsquo;t.</p>
      <p>And maybe that&rsquo;s the most 2008-like thing I&rsquo;ve found. Not bad mortgages. Not CDOs. Not overleveraged banks.</p>
      <p>Opacity.</p>
      <p>
        We&rsquo;re building an enormous new financial architecture around an enormous technological bet. Every individual piece may be perfectly rational. History suggests that&rsquo;s not quite the same thing as saying the system is safe.
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

      <p className="text-sm text-gray-500 pt-4 border-t border-zeever-accent/20">
        Originally published on{' '}
        <a href={CANONICAL_URL} className="text-zeever-text underline hover:text-zeever-primary transition-colors" rel="canonical noopener">
          colinsmillie.com
        </a>
        .
      </p>
    </BlogPost>
  )
}

import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'
import { FAQPageJsonLd } from '@/components/JsonLd'

const PAGE_URL = 'https://www.zeever.ca/research/other-peoples-websites'

const TITLE = 'My Toronto.ca Corpus Contained Other People’s Websites'
const DESCRIPTION =
  'Toronto.ca redirects some of its own pages to other organisations, and my crawler stored them anyway. Cleaning that up moved retrieval accuracy eight points.'

export const metadata: Metadata = {
  title: 'My Toronto.ca Corpus Contained Other People’s Websites',
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }],
    title: 'My Toronto.ca Corpus Contained Other People’s Websites',
    description: DESCRIPTION,
    url: PAGE_URL,
  },
}

const FAQS = [
  {
    question: 'Why would a crawler store another company’s website under a city URL?',
    answer:
      'Because the city redirects there and most HTTP clients follow redirects silently. Toronto.ca publishes partner pages under /services-payments/water-environment/net-zero-homes-buildings/better-buildings-partnership/green-will-initiative/members/, and each one 301s to that company. My fetcher followed the redirect, got a corporate homepage back, and filed it under the toronto.ca address it had asked for. Brookfield Properties, Oxford, Menkes, SickKids and the Toronto District School Board were all in my corpus as though the City had published them. One member had let their hosting lapse, so I had an Account Suspended page indexed as City of Toronto content.',
  },
  {
    question: 'How do you decide whether a redirect is off-site for a municipal government?',
    answer:
      'Comparing hostnames exactly is wrong, because the City runs jobs.toronto.ca, secure.toronto.ca and haveyoursay.toronto.ca. Comparing the registrable domain, the last two labels, gets those right. But it still refuses ombudsmantoronto.ca and torontoauditor.ca, which are official City accountability offices that are independent by design and on separate domains for exactly that reason. There is no rule that gets all three cases right, so I ended up with a rule plus a two-entry allowlist, and the allowlist is a judgement about whose words those are rather than a technical test.',
  },
  {
    question: 'What should a RAG system do with a page that is only a redirect?',
    answer:
      'Record the handoff instead of the content. Twelve Toronto immunization and clinic pages redirect to a third-party booking system, recreation booking goes to ActiveCommunities, job applications go to SuccessFactors. Storing what those services return would file their content as the City’s. Storing nothing meant the question how do I book a vaccine appointment had no source at all. So I store a short record saying what the service is and where the City sends you, naming the operator explicitly. Forty-two of those replaced what had been forty-two permanent crawl failures.',
  },
  {
    question: 'How did 13,188 vectors end up in the search index with nothing behind them?',
    answer:
      'The re-crawl path deleted superseded chunks with raw SQL, which removed the Postgres rows and left the Turbopuffer vectors. Every re-crawl added orphans that could still be returned as sources, citing a version of a page that no longer existed. Nothing reported it, because the admin dashboard counted Postgres embeddings and the two stores were never compared. I found it only because a page I had just restored still failed to appear in an answer. Postgres said 57,847 embedded chunks; Turbopuffer said 71,035 rows.',
  },
  {
    question: 'Does cleaning the corpus matter more than choosing a better model?',
    answer:
      'On my question set, yes, by a wide margin. Seventeen models spanning four providers and two local GPUs finished within nine points of each other on judged relevance, so the model is close to a free choice. Removing roughly half the PDF corpus, the council agendas and engineering specifications nobody asks a service assistant about, moved resident-facing retrieval recall from 73 percent to 81, and forms and applications from 70 percent to 93. Seven questions improved, none got worse, and 22 retrieval ranks moved up with none moving down. That is eight points from deleting content, against nine points spread across every model I could find.',
  },
  {
    question: 'Is the Toronto 311 knowledge base crawlable?',
    answer:
      'Not by any public index I could find. Toronto.ca publishes one sitemap listing eight WordPress page sitemaps and robots.txt declares no other. Following links with an HTTP client found thirteen articles. Rendering the pages in a real browser and expanding the category tree the way a visitor would found sixteen, because those categories expand to service request forms rather than knowledge base articles. It is a form picker, not a content index. Getting the knowledge base needs the City, which is why I have asked their Open Data programme rather than building a cleverer crawler.',
  },
]

export default function Page() {
  return (
    <BlogPost
      title={TITLE}
      description={DESCRIPTION}
      date="2026-08-31"
      url={PAGE_URL}
    >
      <FAQPageJsonLd faqs={FAQS} />

      <div className="rounded-lg border border-zeever-primary/20 bg-zeever-primary/5 px-4 py-3">
        <p className="text-sm italic text-gray-700">
          My last post ended with the conclusion that the model barely matters and retrieval decides everything. So I
          went and looked at what I was retrieving from. I found other organisations&rsquo; websites filed under
          toronto.ca addresses, 13,188 vectors in the search index with nothing behind them, and 657 pages that had been
          discovered and never made it into the corpus. Fixing the first of those deleted 57 real pages, including
          the Ombudsman and the Auditor General, which is its own lesson. Cleaning up the rest moved
          retrieval accuracy further than seventeen models moved it between them.
        </p>
      </div>

      <p>
        Zeever answers questions about City of Toronto services using Toronto.ca content, and every answer cites the
        page it came from. That citation is the whole product. If the page behind it is not really the City speaking,
        the answer is worse than useless, because it looks sourced.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The thing I found first</h2>

      <p>
        Toronto.ca has a Better Buildings Partnership, and it publishes a page for each member organisation at a
        toronto.ca address. Every one of those pages is a redirect to that organisation&rsquo;s own website. My fetcher
        followed the redirect, took what came back, and stored it under the toronto.ca URL it had asked for.
      </p>

      <p>
        So my corpus held the corporate homepages of Brookfield Properties, Oxford, Menkes, Concert Properties,
        Greenrock, Starlight, Triovest and Woodbourne, plus SickKids, the University Health Network, Toronto
        Metropolitan University, the Toronto District School Board and Toronto Community Housing. All of them
        retrievable. All of them citable to a toronto.ca URL as though the City had written them. One member had let
        their hosting lapse, so I also had a page reading Account Suspended indexed as City of Toronto content.
      </p>

      <p>
        Nothing about this was visible from the outside. The pages parsed cleanly, they had plausible titles, and they
        sat in the corpus for months. I found them by auditing what was in there rather than by anything going wrong.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The fix, and the 57 pages it cost me</h2>

      <p>
        The obvious rule is that a fetch which ends on a different host than it started on has not returned the page you
        asked for, whatever the status code says. I implemented that by comparing hostnames, ran a script to remove
        everything already stored that behaved this way, and deleted 57 documents and 96 chunks.
      </p>

      <p>
        Among them: Ombudsman Toronto. The Auditor General. Every page under the City&rsquo;s jobs section. The Toronto
        Youth Cabinet. Invite the Mayor to an Event. The public health appointment booking pages. All real, all City
        content, all gone.
      </p>

      <p>
        Comparing hostnames exactly was too strict, because the City runs jobs.toronto.ca, secure.toronto.ca and
        haveyoursay.toronto.ca, and a redirect from www.toronto.ca to any of those is the same organisation. Comparing
        the registrable domain, meaning the last two labels, fixes it. That is a two-line change and it should have been
        obvious.
      </p>

      <p>
        What made it worse was my own reporting. The script printed where each page had redirected to, and it built that
        string by splitting the error message on a space. The destinations were full URLs, so the output showed{' '}
        <code className="text-sm bg-gray-100 px-1 rounded-sm">https://www</code> for every single row. I read a list of 57
        pages heading somewhere called &ldquo;https://www&rdquo; and approved it. The information I needed was in the
        message and my own summary threw it away.
      </p>

      <div className="rounded-lg border border-zeever-accent/20 bg-zeever-accent/5 px-4 py-3">
        <p className="text-sm text-gray-700">
          The exception now carries both hostnames as structured fields rather than in a sentence a caller has to parse.
          Every destructive script prints the whole destination. If a summary can be wrong in a way that makes a
          destructive action look safe, it is not a summary, it is a trap.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What is a city website, anyway</h2>

      <p>
        Once the subdomain case was fixed, the remaining refusals split into three genuinely different kinds, and no
        single rule handles all three.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Destination</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Count</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700">What it is</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['reservation.frontdesksuite.ca', '12', 'Third-party appointment booking'],
              ['Green Will member sites', '14', 'Partner organisations'],
              ['torontoauditor.ca, ombudsmantoronto.ca', '4', 'City accountability officers, own domains'],
              ['activecommunities.com, sapsf.com, comm100.com', '4', 'Recreation booking, job applications, live chat'],
              ['thetyc.ca, mayoroliviachow.ca', '2', 'Youth Cabinet, the Mayor’s office'],
              ['torontozoo.com, centreisland.ca, mpac.ca and others', '6', 'Separate organisations'],
              ['secure.toronto.ca', '1', 'City subdomain that blocks crawlers with a 403'],
            ].map(([dest, count, what]) => (
              <tr key={dest} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{dest}</td>
                <td className="px-3 py-2 text-center">{count}</td>
                <td className="px-3 py-2">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        The 43 redirects remaining after the subdomain fix, by where they land.
      </p>

      <p>
        The Ombudsman and the Auditor General are the interesting case. They are officers of the City, and they are on
        their own domains precisely because they are meant to be independent of it. My rule was refusing them correctly
        and the result was still wrong: a resident asking how to file a complaint with the Ombudsman got an answer
        citing an insurance claims page, because that was the closest thing in the corpus.
      </p>

      <p>
        So those two domains are now fetched, and stored under their own URLs rather than the toronto.ca address that
        pointed at them. That distinction is the whole point. Filing the Ombudsman&rsquo;s words under a City URL would
        be the same misattribution I had just spent a week removing, only with a more sympathetic destination. The
        allowlist has two entries and a test that fails if it grows past five, because adding a domain to it is a claim
        about whose words those are, not a technical convenience.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Pages that are only a doorway</h2>

      <p>
        The third category was the largest and the least obvious. Twelve Toronto immunization and clinic pages are not
        pages. They redirect to a third-party booking system. Recreation booking goes to ActiveCommunities. Job
        applications go to SuccessFactors. The public health chat goes to Comm100.
      </p>

      <p>
        Refusing those was right, and refusing them left nothing at all. The question a resident actually asks is how do
        I book a vaccine appointment, and the honest answer is not silence, it is that the City sends you here.
      </p>

      <p>
        So I store the handoff rather than the content: what the service is, where the City sends you, and an explicit
        statement that the destination is operated by someone else. No content is fetched from the destination. Forty-two of these replaced forty-two permanent crawl failures, and they are written short on purpose so they lose to
        a real page whenever one exists.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The index disagreed with the database</h2>

      <p>
        Halfway through restoring the wrongly deleted pages I hit something that had nothing to do with redirects. I put
        the Ombudsman pages back, confirmed 355 chunks with embeddings in Postgres, asked the live site how to file a
        complaint, and got the insurance page again.
      </p>

      <p>
        Retrieval does not read Postgres. It reads Turbopuffer. And the two had been drifting apart for months.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Store</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Before</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">After</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Postgres, chunks with embeddings', '57,847', '57,909'],
              ['Turbopuffer, rows indexed', '71,035', '57,905'],
              ['Rows describing chunks that no longer exist', '13,188', '0'],
            ].map(([store, before, after]) => (
              <tr key={store} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{store}</td>
                <td className="px-3 py-2 text-center">{before}</td>
                <td className="px-3 py-2 text-center">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        The cause was a re-crawl path that deleted superseded chunks with raw SQL. It removed the Postgres rows and left
        the vectors, so every re-crawl added orphans that could still be returned as sources, citing a version of a page
        that had been replaced. The delete was mirrored to both stores in one code path and not in the other, and only
        one of those two paths runs on a schedule.
      </p>

      <p>
        Two things kept it invisible. The embedding step treated a failed write to Turbopuffer as a warning and reported
        the run as successful. And the admin dashboard&rsquo;s Searchable chunks figure counted Postgres embeddings, so
        it read healthy for the entire period the two stores were thirteen thousand rows apart. A dashboard that cannot
        show you a problem is worse than no dashboard, because you check it and stop looking.
      </p>

      <p>
        There is no way to ask Turbopuffer which ids it holds, so the orphans could not be found and deleted. The only
        route to a known-correct index was to rebuild it from Postgres, which is the authority for what the corpus
        contains. Doing that in place would mean deleting everything and refilling, leaving search empty for the length
        of the run. So the rebuild writes to a new namespace while the old one keeps serving, and switching is one line
        of configuration. Rolling back is the same line.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Where the corpus ended up</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Measure</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Start of the day</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">End</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Pages discovered but missing from the corpus', '657', '1'],
              ['Index rows with nothing behind them', '13,188', '0'],
              ['Off-site services with no answer at all', '42', '0'],
              ['Accountability offices in the corpus', '0', '2'],
            ].map(([measure, before, after]) => (
              <tr key={measure} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{measure}</td>
                <td className="px-3 py-2 text-center">{before}</td>
                <td className="px-3 py-2 text-center">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        The remaining page is a licensing tribunal listing on secure.toronto.ca, which returns 403 to the crawler. That
        is a City subdomain refusing a City-content crawler, and it is not something I can fix from this side.
      </p>

      <p>
        The Ombudsman question now answers from ombudsmantoronto.ca/how-to-make-a-complaint, which is the page a person
        would want. That is the entire measurable outcome of a week of work, and I think it is worth it, because the
        previous answer was confident, sourced, and pointed at the wrong department.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What it did to the benchmark</h2>

      <p>
        Seventeen models finished within nine points of each other on my hundred Toronto questions. That was the
        finding that sent me here: if swapping the model changes almost nothing, the only lever left is what the model
        is given to read. The corpus is the lever.
      </p>

      <p>
        The problem was that my benchmark could not see the corpus. Eighty-one of the hundred questions expected a
        substring so broad it matched a whole section of the website. One expected the word water, which matches 431
        pages, and it scored a retrieval hit on every run I ever did while the page that actually answers it had never
        been crawled. A benchmark like that cannot tell you the corpus is broken, because it grades you on being in the
        right neighbourhood.
      </p>

      <p>
        So the order had to be measurement first, corpus second, measurement again. Tightening the expectations dropped
        my reported retrieval accuracy from 89 percent to 68, and sampling random pages and asking whether the page
        that answers a question comes back put it at 56. Nothing had got worse. I had stopped grading myself
        generously, and only then could a corpus change show up as a real number.
      </p>

      <p>
        The clearest result came from the PDFs. Toronto.ca publishes far more PDFs than pages, and most of them are
        council agendas, committee decisions, engineering specifications and municipal code chapters. Nobody asks a
        service assistant what a committee decided on a Thursday in June, but those documents compete for the same
        retrieval slots as the forms and guides that people do ask for. Removing the reference and translated classes
        took out roughly half the PDF corpus, about 34,000 chunks.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-zeever-accent/20 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-zeever-accent/10">
              <th className="text-left px-3 py-2 font-medium text-gray-700">Measure</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">Before</th>
              <th className="text-center px-3 py-2 font-medium text-gray-700">After</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ['Resident-facing recall', '73%', '81%'],
              ['Forms and applications', '70%', '93%'],
              ['Questions that improved', '', '7'],
              ['Questions that got worse', '', '0'],
              ['Retrieval ranks that moved up', '', '22'],
              ['Retrieval ranks that moved down', '', '0'],
            ].map(([measure, before, after]) => (
              <tr key={measure} className="border-t border-zeever-accent/10">
                <td className="px-3 py-2 font-medium">{measure}</td>
                <td className="px-3 py-2 text-center">{before}</td>
                <td className="px-3 py-2 text-center">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        Paired comparison on the same questions before and after removing the reference PDFs. Seven gained and none
        lost, which is significant at p = 0.0156 by McNemar&rsquo;s exact test.
      </p>

      <p>
        Eight points of recall, from deleting content. No model changed, no prompt changed, no retriever changed. I had
        spent a week benchmarking seventeen models to move nine points across all of them, and half an hour of deciding
        what does not belong in the corpus moved eight points on its own.
      </p>

      <p>
        The duplicate pages told the same story in a smaller way. Every re-crawl had been adding a second copy of a
        page rather than replacing the first, 1,026 extra copies across 590 URLs, and each copy sat in a retrieval slot
        that a different page could have used. One benchmark question kept failing and I blamed the model, then a
        parser bug that stored headings twice, then the retrieval mode. It was a duplicate page holding a slot. Three
        wrong diagnoses, all of them plausible, none of them the corpus.
      </p>

      <p>
        The honest part of this section is what the benchmark still cannot see. None of my hundred questions asks how
        to file a complaint with the Ombudsman, or how to book a vaccine appointment, or how to apply for a City job.
        Those are exactly the questions this work fixed, and my score for them is unchanged because they were never in
        the set. The corpus got better in a way the measurement is blind to, which is the same failure as the loose
        expectations, arriving from the other end.
      </p>

      <p>
        So the next job is not another model comparison. It is a question set that covers what the corpus now answers,
        including the accountability offices and the services the City hands off to somebody else. Every time I have
        improved the measurement it has told me something worse and more useful than the measurement before it, and I
        have no reason to think this one will be different.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What is still missing</h2>

      <p>
        The 311 knowledge base. It is where the City publishes its how do I report this answers, which is the most
        common shape of question a service assistant gets, and I cannot reach it. Toronto.ca publishes one sitemap
        listing eight WordPress page sitemaps, and robots.txt declares no other. Following links with an HTTP client
        finds thirteen articles and stops.
      </p>

      <p>
        I tried rendering the pages in a real browser and expanding the category tree the way a visitor would. That
        found sixteen articles across twenty-one pages before the queue ran dry, because the categories on the create a
        service request page expand to service request forms rather than knowledge base articles. It is a form picker,
        not a content index. The articles appear only as popular items on one page and in search results, which is why
        following links finds the same handful either way.
      </p>

      <p>
        So the knowledge base is not reachable by any public index, rendered or not. Getting it needs the City, and I
        have asked their Open Data programme. I am keeping the browser script because it settled the question in five
        minutes and because it will notice if Toronto ever links those articles properly.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What I would tell someone building one of these</h2>

      <p>
        Audit what is in your corpus, not just how much of it there is. Every count I had was going up and every count
        was measuring the wrong thing. Thirty-two thousand URLs discovered tells you nothing about whether twenty of
        them are somebody else&rsquo;s company homepage.
      </p>

      <p>
        Check the store your retriever actually reads. Mine had been serving from Turbopuffer for weeks while every
        diagnostic I wrote, and the dashboard I built, reported on Postgres. I concluded a restore was complete on the
        strength of the wrong database and said so out loud before the live query proved otherwise.
      </p>

      <p>
        Treat a redirect as information rather than a failure. Forty two of my crawl errors were the City telling me
        where a service actually lives, repeated on every run, and I had been reading them as noise.
      </p>

      <p>
        And make destructive tooling report the whole truth before it acts. The subdomain bug was two lines. The reason
        it destroyed 57 pages instead of being caught in review is that my confirmation screen showed a truncated
        destination for every row, and I approved it anyway.
      </p>

      <p className="text-sm text-gray-500 pt-2">
        Related: <a href="/research/benchmarking-our-benchmark" className="text-zeever-primary hover:underline">I
        Benchmarked 17 Models. The Problem Was My Benchmark.</a>, which is how I came to be looking at the corpus in the
        first place, and{' '}
        <a href="/research/turbopuffer-vs-pgvector" className="text-zeever-primary hover:underline">Turbopuffer vs
        pgvector</a>, which is why there are two stores to disagree with each other.
      </p>
    </BlogPost>
  )
}

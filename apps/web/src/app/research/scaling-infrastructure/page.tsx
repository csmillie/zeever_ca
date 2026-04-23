import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/scaling-infrastructure'

export const metadata: Metadata = {
  title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents',
  description: 'Our database hit 25GB, the server crashed from OOM, and the web admin went dark during crawls. Here is how we fixed all three.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Scaling a RAG Pipeline from 174 Pages to 35,000 Documents', description: 'Our database hit 25GB, the server crashed, and we fixed all three problems.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Scaling a RAG Pipeline from 174 Pages to 35,000 Documents" description="Our database hit 25GB, the server crashed from OOM, and the monitoring interface went dark." date="2026-03-30" url={PAGE_URL}>
      <p>
        Going from a small building permits corpus to full city government coverage
        broke things in ways we didn&apos;t expect. Here is what happened and how we
        fixed it.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Storage: raw content in the database</h2>
      <p>
        We originally stored raw HTML and PDF content directly in PostgreSQL as BYTEA
        columns. That was fine for the initial 2,096 documents. When we expanded to city
        government coverage, adding 2,470 pages and all their linked PDFs, the
        raw_documents table ballooned to 25GB and nearly filled the disk. The actual
        useful content (parsed text, chunks, embeddings) totalled 216MB.
      </p>
      <p>
        We fixed this by having the pipeline automatically clear raw binary content
        after parsing and run VACUUM to reclaim the space. Raw content is only needed
        during the parse step. Once the text has been extracted and chunked, the
        original files serve no purpose.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Memory: loading everything at once</h2>
      <p>
        The original parse pipeline loaded all unparsed documents into memory with a
        single SQL query. With 18,000+ documents, each carrying multi-megabyte raw
        content, this consumed far more RAM than the server had available and triggered
        the Linux OOM killer. The server went down.
      </p>
      <p>
        We switched to batch processing: 50 documents at a time. Each batch is loaded,
        parsed, committed, and released before the next one starts. Failed documents
        are tracked and excluded from later batches so the pipeline doesn&apos;t get
        stuck retrying the same broken files.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Pipeline blocking the web server</h2>
      <p>
        The pipeline initially ran as a child process of the webhook server with shared
        stdio. During long crawls (30+ minutes), this blocked the Node.js event loop.
        The admin dashboard and deploy endpoints stopped responding entirely.
      </p>
      <p>
        We moved pipeline output to a separate log file and added a JSON status file
        that both the pipeline and webhook server read independently. The admin
        dashboard polls this file every 5 seconds for live progress, and the webhook
        server stays responsive throughout.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">The outcome</h2>
      <p>
        With all three fixes in place, the full crawl of Services and Payments and City
        Government ran to completion. It crawled 2,945 new pages, parsed 2,944 documents,
        and produced 11,979 new embedded chunks over about 6 hours. The database came in
        at 358MB after cleanup, down from a peak of 25GB. Disk usage dropped back to
        comfortable levels.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we learned</h2>
      <ul className="list-disc pl-6 space-y-2 text-sm">
        <li>Raw binary content should not live in the database long term. Parse it, keep what you need, throw the rest away.</li>
        <li>Never load an open-ended result set into memory. Batch everything.</li>
        <li>Background tasks that run for 30+ minutes need their own stdio.</li>
        <li>PDF links multiply fast. 3,770 HTML pages produced 22,000+ raw documents. Plan for 5 to 10 times the page count.</li>
      </ul>
    </BlogPost>
  )
}

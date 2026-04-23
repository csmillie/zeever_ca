import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/retrieval-improvements'

export const metadata: Metadata = {
  title: 'Fixing Vector Search: IVFFlat Probes, Heading-Aware Chunking, and Content Classification',
  description: 'Three retrieval fixes that improved citation accuracy by 35% and fixed queries that returned zero results.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Fixing Vector Search: Probes, Chunking, and Classification', description: 'Three retrieval fixes that improved citation accuracy by 35%.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Fixing Vector Search: IVFFlat Probes, Heading-Aware Chunking, and Content Classification" description="Three retrieval fixes that improved citation accuracy by 35%." date="2026-03-27" url={PAGE_URL}>
      <p>
        Almost every answer quality problem we found came down to retrieval, not
        generation. The model was doing a fine job with the chunks it received. The
        issue was that it kept getting the wrong chunks, or none at all.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Fix 1: IVFFlat probe count</h2>
      <p>
        Our pgvector index used 20 lists (clusters of similar vectors). By default,
        pgvector checks just 1 list per search. With thousands of vectors across 20
        lists, the best match could easily sit in a list we never looked at.
      </p>
      <p>
        The query &quot;What happens if I build without a permit?&quot; came back empty.
        The chunk was there, embedded and ready, but the index skipped right past it.
        Setting <code className="text-xs bg-gray-100 px-1 rounded">ivfflat.probes = 10</code> fixed
        it on the spot. That chunk showed up as the top result at 0.83 similarity.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Fix 2: Heading-aware chunking</h2>
      <p>
        The HTML parser extracted text with single newlines between elements. The
        chunker split on double newlines. Since there were none, whole pages ended up
        as single chunks. The &quot;When Do I Need a Building Permit&quot; page (1,052
        words) was one chunk. Its embedding was a fuzzy average of decks, fences,
        basements, and renovations all at once.
      </p>
      <p>
        We rewrote the parser to insert section breaks at h2/h3 headings and taught
        the chunker to split there first. 174 HTML pages turned into 584 focused
        chunks. Citation accuracy went from 0.46 to 0.62, a 35% improvement.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Fix 3: Content classifier</h2>
      <p>
        A rule-based classifier sorted pages into fee_schedule, guide, regulation,
        or page. It scanned the title and body for keywords, checking &quot;fee&quot; first.
        The &quot;Building Permit Review Streams&quot; page (which has the actual review
        timelines) mentioned &quot;All fees have been paid&quot; in passing as a
        completeness requirement. The classifier filed it under fee_schedule. When
        people asked about timelines, it never came up.
      </p>
      <p>
        We fixed this by giving the title priority. &quot;Review Streams&quot; in the title
        maps to guide because &quot;review&quot; is a guide keyword. The text scan only
        runs when the title is ambiguous.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Takeaway</h2>
      <p>
        Better chunking had more impact than any prompt engineering. In a RAG system,
        the retriever is the bottleneck, not the LLM.
      </p>
    </BlogPost>
  )
}

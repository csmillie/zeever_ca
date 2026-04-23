import type { Metadata } from 'next'
import BlogPost from '@/components/BlogPost'

const PAGE_URL = 'https://www.zeever.ca/research/vector-vs-graph'

export const metadata: Metadata = {
  title: 'Vector RAG vs GraphRAG on Toronto City Data',
  description: 'We compared plain vector retrieval against graph-enhanced retrieval on Toronto.ca content. Graph mode helped on some queries and hurt on others.',
  alternates: { canonical: PAGE_URL },
  openGraph: { images: [{ url: 'https://www.zeever.ca/og-image.png', width: 1200, height: 630, alt: 'Zeever.ca' }], title: 'Vector RAG vs GraphRAG on Toronto City Data', description: 'Graph mode helped on some queries and hurt on others.', url: PAGE_URL },
}

export default function Page() {
  return (
    <BlogPost title="Vector RAG vs GraphRAG on Toronto City Data" description="We compared plain vector retrieval against graph-enhanced retrieval on Toronto.ca content." date="2026-03-27" url={PAGE_URL}>
      <p>
        Once the baseline vector RAG system was working, we layered a knowledge graph
        on top. The graph pulls entities (permit types, documents, requirements,
        inspections) and relationships (requires, followed_by, costs) out of the
        content using LLM extraction. The question: does graph context actually
        improve answers?
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">How graph mode works</h2>
      <p>
        In graph mode, after retrieving chunks by vector similarity, we also query the
        knowledge graph for entities connected to those chunks. If a chunk mentions a
        permit type, we pull in all related requirements, steps, fees, and inspections
        from the graph. That structured context goes into the LLM prompt alongside the
        raw chunk text.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Results</h2>
      <p>
        We ran the same benchmark in both modes. Graph mode helped with some structured
        questions about requirements and processes (bp-02 documents went from 0.33 to
        0.67 relevance, bp-06 inspections from 0.67 to 1.00). But it made others worse
        (bp-08 apply online dropped from 1.00 to 0.33) where the extra context
        distracted the model from a straightforward answer.
      </p>
      <p>
        On average, the scores were nearly the same. The wins and losses cancelled out.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">What we concluded</h2>
      <p>
        GraphRAG works best for certain query types (process workflows, requirement
        chains) but not as a blanket improvement. The cost of graph extraction (LLM
        calls per chunk) and the added latency from graph queries make it hard to
        justify as the default. We kept vector retrieval as the default and left graph
        mode available via the <code className="text-xs bg-gray-100 px-1 rounded">?mode=graph</code> parameter.
      </p>

      <h2 className="text-xl font-semibold text-zeever-text pt-4">Graph stats</h2>
      <p>
        The knowledge graph contains 2,716 nodes and 2,860 edges extracted from guide
        and inspection content. Node types include permit_type, document, step,
        requirement, fee, inspection, review_stream, and department. Edge types include
        requires, followed_by, costs, inspected_by, and applies_to.
      </p>
    </BlogPost>
  )
}

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class CrawlRun(Base):
    __tablename__ = "crawl_runs"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pages_found: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pages_crawled: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pdfs_downloaded: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    raw_documents: Mapped[list["RawDocument"]] = relationship(back_populates="crawl_run")


class RawDocument(Base):
    __tablename__ = "raw_documents"
    __table_args__ = (
        UniqueConstraint("url", "content_hash"),
        {"schema": "canadian_ai"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crawl_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.crawl_runs.id"), nullable=True
    )
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_content: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fetched_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    headers: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    sitemap_lastmod: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    last_crawled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    crawl_run: Mapped[Optional["CrawlRun"]] = relationship(back_populates="raw_documents")
    parsed_documents: Mapped[list["ParsedDocument"]] = relationship(back_populates="raw_document")


class ParsedDocument(Base):
    __tablename__ = "parsed_documents"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.raw_documents.id"), nullable=True
    )
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_format: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parsed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    extra_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, nullable=True)

    raw_document: Mapped[Optional["RawDocument"]] = relationship(back_populates="parsed_documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="parsed_document")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parsed_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.parsed_documents.id"), nullable=True
    )
    chunk_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding: Mapped[Optional[Any]] = mapped_column(Vector(768), nullable=True)
    extra_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=lambda: datetime.now(timezone.utc))

    parsed_document: Mapped[Optional["ParsedDocument"]] = relationship(back_populates="chunks")
    graph_nodes: Mapped[list["GraphNode"]] = relationship(back_populates="source_chunk")
    graph_edges: Mapped[list["GraphEdge"]] = relationship(back_populates="source_chunk")


class GraphNode(Base):
    __tablename__ = "graph_nodes"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    node_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_chunk_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.document_chunks.id"), nullable=True
    )
    properties: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=lambda: datetime.now(timezone.utc))

    source_chunk: Mapped[Optional["DocumentChunk"]] = relationship(back_populates="graph_nodes")
    outgoing_edges: Mapped[list["GraphEdge"]] = relationship(
        foreign_keys="GraphEdge.source_node_id", back_populates="source_node"
    )
    incoming_edges: Mapped[list["GraphEdge"]] = relationship(
        foreign_keys="GraphEdge.target_node_id", back_populates="target_node"
    )


class GraphEdge(Base):
    __tablename__ = "graph_edges"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.graph_nodes.id"), nullable=True
    )
    target_node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.graph_nodes.id"), nullable=True
    )
    edge_relationship: Mapped[Optional[str]] = mapped_column("relationship", String, nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    properties: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    source_chunk_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.document_chunks.id"), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=lambda: datetime.now(timezone.utc))

    source_node: Mapped[Optional["GraphNode"]] = relationship(
        foreign_keys=[source_node_id], back_populates="outgoing_edges"
    )
    target_node: Mapped[Optional["GraphNode"]] = relationship(
        foreign_keys=[target_node_id], back_populates="incoming_edges"
    )
    source_chunk: Mapped[Optional["DocumentChunk"]] = relationship(back_populates="graph_edges")


class Workflow(Base):
    __tablename__ = "workflows"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permit_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    steps: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    source_urls: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=lambda: datetime.now(timezone.utc))


class EvalPrompt(Base):
    __tablename__ = "eval_prompts"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expected_signals: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True)
    expected_sources: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True)

    eval_results: Mapped[list["EvalResult"]] = relationship(back_populates="eval_prompt")


class EvalResult(Base):
    __tablename__ = "eval_results"
    __table_args__ = {"schema": "canadian_ai"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eval_prompt_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("canadian_ai.eval_prompts.id"), nullable=True
    )
    run_label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model_used: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    answer_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sources_cited: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True)
    relevance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    groundedness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    citation_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    scored_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    extra_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, nullable=True)

    eval_prompt: Mapped[Optional["EvalPrompt"]] = relationship(back_populates="eval_results")

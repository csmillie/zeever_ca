# Architecture

**Status:** Draft

This document describes the overall system architecture for the Toronto building permits assistant, including the crawl pipeline that extracts permit information from Toronto.ca, the document parser that structures raw content, the vector RAG and GraphRAG subsystems that retrieve and reason over the corpus, the query engine that routes between retrieval strategies, the model router that selects appropriate Claude or Qwen models, and the web frontend that serves users. It covers the complete tech stack spanning Python/FastAPI backend, Next.js frontend, PostgreSQL with pgvector for embeddings, and AI models from Anthropic and Alibaba.

## Crawl Pipeline

## Document Parser

## Vector RAG

## GraphRAG

## Query Engine

## Model Router

## Web Frontend

## Tech Stack

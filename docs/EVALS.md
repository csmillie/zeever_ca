# Evals

**Status:** Draft

This document outlines the evaluation framework for assessing the Toronto building permits assistant, including 12 benchmark prompts that represent typical user queries across different permit scenarios. It defines the scoring dimensions used to evaluate responses including relevance (whether results match the user's intent), groundedness (whether answers are supported by the source documents), and citation accuracy (whether references correctly point to original sources). The framework supports comparison methodology between vector-only retrieval and graph-enhanced retrieval approaches to measure the impact of structured knowledge representation.

## Benchmark Prompts

## Scoring Dimensions

## Comparison Methodology

## Related

`docs/OLLAMA_BENCHMARK.md` records the local-inference benchmark: the throughput profile for
both GPUs, the six local models scored against the same 100 questions, and why the tuning
flags moved nothing.

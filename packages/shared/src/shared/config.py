from shared.benchmark_config import BenchmarkSettings


class Settings(BenchmarkSettings):
    """Everything the application reads.

    Inherits the benchmark keys rather than redeclaring them, so a .env carrying
    PGVECTORSCALE_DATABASE_URL still validates against extra=forbid below, and the
    two files cannot drift to different defaults.
    """

    database_url: str  # Required — no default, must be set in .env
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    fireworks_api_key: str = ""
    fireworks_base_url: str = "https://api.fireworks.ai/inference/v1"
    fireworks_model: str = "accounts/fireworks/models/qwen2p5-7b-instruct"

    # Embeddings. Tried in order, first working endpoint wins, Fireworks last.
    #
    # Every query embeds before it can retrieve or even consult the cache, so a
    # single embedding endpoint is a single point of failure for the whole site,
    # not just for crawling. Hence a chain rather than a setting.
    #
    # All three serve nomic-embed-text-v1.5. Measured agreement between the
    # self-hosted cards and Fireworks is cosine 0.99999, so a vector written by
    # one is interchangeable with a vector written by another and failing over
    # mid-corpus does not corrupt the index.
    embedding_base_url: str = ""      # preferred, e.g. the NVIDIA host
    embedding_base_url_2: str = ""    # second, e.g. the AMD host
    embedding_model: str = "nomic-embed-text"
    embedding_api_key: str = "ollama"  # Ollama ignores it; the SDK requires one

    # Read through os.getenv by api.py rather than from here, but declared so
    # that putting it in .env cannot crash the service. extra="forbid" rejects
    # any key this class does not know about, which crash-looped the API for
    # hours on 2026-09-14 after three keys were added to .env in good faith.
    log_level: str = "INFO"
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"
    together_model: str = "Qwen/Qwen3.5-9B"
    ovh_api_key: str = "none"
    ovh_base_url: str = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"
    ovh_model: str = "Qwen3-32B"
    cohere_api_key: str = ""
    cohere_base_url: str = "https://api.cohere.ai/compatibility/v1"
    cohere_model: str = "command-a-03-2025"
    # Augure (sovereign Canadian provider, OpenAI-compatible). Gated API access;
    # rates are published in CAD, unlike the other providers here.
    augure_api_key: str = ""
    augure_base_url: str = "https://api.augureai.ca/v1"
    augure_model: str = "ossington-5"
    turbopuffer_api_key: str = ""
    turbopuffer_region: str = "gcp-northamerica-northeast2"
    turbopuffer_namespace: str = "toronto-chunks"
    retrieval_backend: str = "pgvector"  # "pgvector" | "turbopuffer"
    # "vector" (dense only) | "hybrid" (dense + BM25, fused with RRF).
    # Hybrid needs a lexical index and so is Turbopuffer-only; with pgvector it
    # falls back to dense and says so. Dense alone has no way to insist a term in
    # the question actually appears: "How do I set up a new water account" is
    # dominated by "set up a new account", which is how a parks-recreation
    # registration page outranked every water chunk and took two of five slots.
    retrieval_mode: str = "vector"
    # How many chunks one page may contribute to a single answer. Swept over the
    # 100 benchmark prompts: 89 hits at 1, 88 at 2, 87 at 3, with no prompt lost by
    # tightening. At 2 a page indexed twice takes 40% of the context — bp-08 gave
    # four of five slots to two pages, with the page that answered it at rank 78.
    max_chunks_per_url: int = 1
    ollama_base_url: str = ""
    ollama_model: str = "qwen2.5:7b-instruct"
    # Ollama ignores the key, but the OpenAI SDK refuses to construct without one.
    ollama_api_key: str = "ollama"
    # Sent as `reasoning_effort` on the OpenAI-compatible route, and only for models
    # that reason (gpt-oss). "low" keeps the visible answer first; "medium"/"high"
    # buy accuracy on harder questions at a real latency cost.
    ollama_reasoning_effort: str = "low"
    # Second Ollama host (e.g. a different GPU box). Tried after the first.
    ollama_base_url_2: str = ""
    ollama_model_2: str = ""

    # Which system prompt the generator uses: "v1" | "grounded".
    #
    # A/B over three models on the 100-prompt benchmark, same retrieval both arms:
    # confident+ fell 7 to 2, and both-low fell 7 to 5 rather than rising, so the
    # grounding was not bought with refusals. Five of the seven answers that left
    # the risky quadrant held relevance at 1.00 while groundedness went 0.50 to
    # 1.00 — the models kept answering and started doing it from the evidence.
    #
    # judge_relevance falls under this prompt, and that is expected rather than a
    # regression: it scores "the evidence does not cover this" at 0.0, so a model
    # becoming honest looks worse on it. See REFUSAL_RUBRIC in evals/llm_judge.py.
    system_prompt_variant: str = "grounded"

    # Output ceiling, not the context window. This caps how much the model may
    # generate; the context window is a server-side property of the loaded model.
    # Answers here are meant to be two to four short paragraphs, and an unbounded
    # run costs real time: one 79-token request produced 3,512 output tokens, about
    # 31 seconds at 112 tok/s. Callers may raise it per request.
    llm_max_output_tokens: int = 800
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    qwen_api_url: str = ""
    qwen_api_key: str = ""
    crawl_rate_limit_ms: int = 1000
    # Skip PDFs that are reference or archive material rather than resident
    # answers: council agendas and decisions, engineering specifications,
    # municipal code, infrastructure project appendices. Measured over a 295-page
    # sample they retrieve at 39 percent against 73 for resident-facing PDFs, and
    # council papers alone at 15. Off by default: turning it on changes what the
    # corpus contains, and that should follow a before-and-after rather than an
    # argument. See scripts/eval_retrieval_breadth.py --urls --questions.
    exclude_reference_pdfs: bool = False
    # Skip PDFs that are the same document republished in another language. They
    # measure 0 percent recall, and not because they are poor: an English query
    # cannot match a Punjabi article, so they are unreachable by construction while
    # still costing embedding, storage and a slot in the index beside the English
    # original. Off by default because this is a product decision. Supporting the
    # languages properly, by detecting the query language and answering in it,
    # would be a better answer than dropping them, and is a real feature rather
    # than a corpus setting.
    exclude_translated_pdfs: bool = False
    crawl_user_agent: str = "CanadianAI/0.1 (toronto-services-research)"

    # Deploy webhook
    deploy_webhook_secret: str = ""

    # Admin
    admin_password: str = ""
    webhook_url: str = "http://127.0.0.1:9033"

    # Langfuse (optional, for tracing)
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_base_url: str = "https://us.cloud.langfuse.com"

    # Read by the Node and Next.js halves, never by Python.
    #
    # They are declared anyway because .env is one file shared by all three, and
    # extra="forbid" below means a key this class does not know is a startup
    # crash for the API. That is not hypothetical: adding DEPLOY_GITHUB_TOKEN,
    # A2A_API_KEY and MCP_API_KEY to .env took the API down on 2026-09-14 with
    # "Extra inputs are not permitted", and it crash-looped until they were
    # removed. deploy_webhook_secret above was already here for this reason.
    #
    # Typed as str, including the numeric ones, precisely because Python never
    # reads them: an operator who blanks DEPLOY_FETCH_TIMEOUT should not be able
    # to stop the API from starting over a value it does not use.
    api_url: str = "http://127.0.0.1:3034"
    a2a_api_key: str = ""
    mcp_api_key: str = ""
    deploy_github_token: str = ""
    deploy_github_repo: str = "csmillie/zeever_ca"
    deploy_fetch_timeout: str = "900"
    deploy_allow_local_build: str = ""
    deploy_build_heap_mb: str = "768"
    deploy_alert_email: str = ""
    deploy_alert_from: str = "deploy@zeever.ca"
    deploy_sendmail: str = "/usr/sbin/sendmail"

    # extra stays forbidden here, overriding the parent, so a typo'd key in .env is
    # a startup error rather than a setting that silently never applies. The cost
    # of that strictness is the block above: every key any part of the system puts
    # in .env has to be declared. test_env_example_validates keeps the two in step.
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "forbid"}


settings = Settings()

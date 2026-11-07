# Ollama Benchmark: Two Local GPUs

**Run:** late August 2026
**Question:** should local inference serve production, and which of the two boxes should do it?

Two separate measurements, which answer different things and are easy to confuse:

1. **Throughput**, per host, with `scripts/check_ollama.py --profile`. How fast does this
   card produce tokens, and where does the wall clock actually go?
2. **Answer quality**, per model, with `scripts/compare_models.py`. Do the answers hold up
   against the hosted providers on the 100-question Toronto set?

A card can win the first and lose the second, and the models here were within nine points of
each other on the second, so the first is what decided the deployment.

---

## The two hosts

| | Host 1 | Host 2 |
|---|---|---|
| Machine | HP Z640 workstation | Dell XPS 8940 |
| GPU | AMD Radeon RX 7900 XT | NVIDIA RTX 3070 |
| VRAM | 20 GB | 8 GB |
| Runtime | ROCm | CUDA |
| Memory bandwidth | 800 GB/s | 448 GB/s |
| Config variable | `OLLAMA_BASE_URL` | `OLLAMA_BASE_URL_2` |
| Provider name in the harness | `ollama` | `ollama2` |

Both are reached from the VPS over Tailscale. That matters to the measurement: the app's
request crosses a VPN, so some of the wall clock is network rather than model, and the
profiler separates the two deliberately.

VRAM is the reason the two hosts run different models. A 20 GB card holds a 20 billion
parameter model; an 8 GB card does not.

---

## How the tests are run

```
  VPS        ──Tailscale──▶  Host 1  HP Z640      RX 7900 XT  HOST_1_TAILNET_IP:11434
             └─Tailscale──▶  Host 2  Dell XPS 8940  RTX 3070  HOST_2_TAILNET_IP:11434
```

Everything is driven from the VPS, which is where the app runs. Profiling from the GPU box
would measure a path production never takes.

### The machines

| | Host 1 | Host 2 |
|---|---|---|
| Machine | HP Z640 workstation | Dell XPS 8940 |
| CPU | Xeon E5-1650 v4, 6c/12t, 3.6 to 4.0 GHz | Core i5-11400, 6c/12t, 2.6 to 4.4 GHz |
| RAM | 31 GB | 38 GB |
| GPU | RX 7900 XT, 20 GB, ROCm | RTX 3070, 8 GB, CUDA |
| GPU link | PCIe x16, negotiated OK | PCIe Gen3 x16 under load, verified |
| Ollama | 0.33.1 | 0.33.1 |

Same core count on both, and the i5-11400 has the better single-thread performance of the two
by a wide margin. That matters for reading the results: if prefill were bound by host CPU, the
XPS should win clearly. It leads by 3 percent at the two larger prompt sizes and ties at the
smaller ones, which is the wrong shape for a CPU ceiling. Launch overhead is a fixed cost per
call, so it would bite hardest on the *shortest* prompts, where there is least work to hide it.

### The network cannot affect the throughput numbers

This is worth stating plainly because it is the first objection anyone raises.

`prefill` and `decode` are not timed by the client. They are read from Ollama's own
`prompt_eval_duration` and `eval_duration` counters, measured inside the model process on the
GPU host. A slow tunnel cannot inflate them.

The profiler computes `other = wall_clock − load − prefill − decode` for exactly this reason,
and that bucket is where the tunnel, the HTTP round trip and scheduling land. Measured at 45 ms
to the XPS and 61 to 69 ms to the Z640.

So the tunnel is irrelevant to which card is faster, and highly relevant to how the site feels.
A relayed Tailscale connection adds tens of milliseconds to every query while leaving every
number in this document unchanged, which is the kind of fault that presents as a slow model:

```bash
tailscale status   # want "direct", not "relay"
tailscale ping --c 5 HOST_1_TAILNET_IP
```

### Ollama binds only to OLLAMA_HOST, so localhost does not work here

`OLLAMA_HOST` is set to the Tailscale address on both boxes, not `0.0.0.0`. That is deliberate,
and it means a request to `http://localhost:11434` on the machine itself is refused.

Worth knowing because the failure is silent under `curl -s ... >/dev/null`, which is how a
load-generating loop ran for a full minute against nothing while the GPU sat idle and the
reading taken from it looked like a hardware fault. Use the tailnet address even when you are
sitting at the console:

```bash
curl -s http://HOST_2_TAILNET_IP:11434/api/generate -d '{...}'   # works
curl -s http://localhost:11434/api/generate      -d '{...}'   # connection refused
```

### Two things that look like bottlenecks and are not

Both were investigated properly and both turned out to be irrelevant, for the same reason: the
profiler separates transfer from computation, so anything affecting the path lands in `load` or
`other` rather than in the rates being compared.

**PCIe link speed.** The RTX 3070 reports `2.5GT/s (downgraded)` from a Gen3 capability when
read at idle, which is a four-fold deficit and looks alarming. Sampled while the GPU was
actually working it reads Gen3 x16 with 97 to 98 percent utilisation at 1,845 to 1,860 MHz.
Ampere parks the link at Gen1 to save power. Even a genuine downgrade would only slow loading
the model into VRAM, which happens once because `OLLAMA_KEEP_ALIVE=-1` keeps it resident, and
which the profiler reports separately as `load`. Weights never cross the bus during prefill or
decode.

That 97 to 98 percent utilisation is also independent support for the analysis above: the 3070
is saturated during generation, which is what a card running near its practical tensor ceiling
should look like.

**The Tailscale link.** Measured from the VPS, both hosts answer through the Toronto DERP relay
in 4 to 7 ms, and the Z640 upgrades to a direct path at 15 ms. The relay is faster than the
direct route here, since the direct path goes out through a residential ISP. Against a
multi-second generation neither figure is worth attacking, and both land in `other`.

One thing worth recording rather than assuming: `DERP(tor)` is Toronto, so relayed query
content stays in Canada, which matters to this project specifically.

### The three rules that make a comparison

Learned by getting each of them wrong first.

1. **Warm the model.** The first run after a load under-reports prefill by about 25 percent.
2. **Repeat, and report the median with its range.** One sample cannot separate a 3 percent
   difference from noise.
3. **Vary the prompt size.** Prefill is a batched matrix multiply; one size is one point on a
   curve.

`scripts/profile_ollama_sweep.py` does all three. `check_ollama.py --profile` does none of
them and is a health check, not a comparison.

---

## Host configuration

Applied on each Ollama box as a systemd override, not in the app's `.env`. Copied from
Host 1 on 2026-09-01 with `systemctl cat ollama`:

```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=HOST_1_TAILNET_IP:11434"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
```

`OLLAMA_HOST` is the host's Tailscale address rather than `0.0.0.0`, so the service is
reachable from the VPS over the tailnet and not from the local network at large.

**Host 2 is not configured the same way.** Confirmed 2026-09-01:

| Variable | Host 1 (RX 7900 XT) | Host 2 (RTX 3070) |
|---|---|---|
| `OLLAMA_HOST` | `HOST_1_TAILNET_IP:11434` | `HOST_2_TAILNET_IP` |
| `OLLAMA_KEEP_ALIVE` | `-1` | `-1` |
| `OLLAMA_NUM_PARALLEL` | `1` | `1` |
| `OLLAMA_CONTEXT_LENGTH` | `8192` (see below) | `8192` |
| `OLLAMA_FLASH_ATTENTION` | `1` | **unset** |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | **unset** |

The head-to-head in [Results](#results) therefore compared a card running flash attention and
a quantised KV cache against one running neither. Decode is bandwidth-bound and those flags
measurably moved nothing on Host 1, so the effect is likely small, but "same model, same
quantisation, same prompt" was true of the model and not of the host. Set both on Host 2, or
unset both on Host 1, before repeating the comparison.

> ### The context length was never actually set (and it turned out not to matter)
>
> The line in the file read `Ennvironment=`, with two Ns, **on Host 1 only**. systemd ignores
> an unknown assignment in a `[Service]` section, so `OLLAMA_CONTEXT_LENGTH` was never in the
> environment and Ollama ran at its built-in default for the whole period covered by this
> document. Host 2 had the variable set correctly throughout, so the two boxes were running
> different context windows as well as different flags.
>
> Corrected on both hosts 2026-09-01 and confirmed present in
> `systemctl show ollama -p Environment`.
>
> That is not cosmetic. The prompt this app sends is a system instruction plus five retrieved
> sources, which lands in the low thousands of tokens. Against a 2048-token default the tail
> of the evidence is dropped before the model sees it, and the failure is silent: it looks
> like a model ignoring its sources, or one that keeps saying the evidence does not cover the
> question. Ollama is first in the provider chain, so it reaches production answers.
>
> Verify the environment rather than the file, because the file is what lied:
>
> ```bash
> systemctl show ollama -p Environment
> sudo tr '\0' '\n' < /proc/$(pgrep -f 'ollama serve')/environ | grep OLLAMA
> ```
>
> **Resolved: it cost nothing.** The pre-restart logs show `n_ctx_slot = 4096` on both hosts,
> 3,129 times on Host 1 and 645 on Host 2, so the built-in default was 4096 rather than 2048.
>
> | | Approx. tokens | Fits in 4096 |
> |---|---|---|
> | Profile prompt | ~1,600 | yes |
> | Production prompt, 5 chunks at up to 500 tokens | ~2,700 | yes |
> | Production prompt plus `LLM_MAX_OUTPUT_TOKENS=800` | ~3,500 | yes, ~600 spare |
>
> Nothing was truncated, no evidence was dropped, and no scores need revisiting. The
> throughput numbers and the quality scores both stand.
>
> The fix still earns its place. Roughly 600 tokens of headroom is thinner than it looks, and
> three ordinary changes would have breached it without any warning: raising the retrieval
> limit above five, raising `LLM_MAX_OUTPUT_TOKENS`, or increasing the chunker's 500-token
> cap. At 8192 none of those is a silent failure waiting to happen.
>
> To check this on any host, the log is the authority rather than the unit file:
>
> ```bash
> journalctl -u ollama --no-pager | grep -oiE 'n_ctx[^0-9]*[0-9]+' | sort | uniq -c | tail
> ```

`OLLAMA_KEEP_ALIVE=-1` is the one that mattered of the ones that took effect, and it is not a tuning flag, it is a
correctness flag for a low-traffic site. Ollama unloads a model after five minutes by
default, so most real queries would otherwise hit a cold model. Loading `gpt-oss:20b` cost
**21.9 seconds** in one benchmark run. The trade is VRAM: a resident model holds its memory,
and two large models will not both fit on a 20 GB card.

The rest moved nothing measurable. See [Tuning that did not work](#tuning-that-did-not-work).

---

## Part 1: throughput profile

```bash
uv run python scripts/check_ollama.py --profile
uv run python scripts/check_ollama.py --profile --model gpt-oss:20b
uv run python scripts/check_ollama.py --profile --url http://<host>:11434
```

Run this **from the VPS**, not from the Ollama box. The thing worth testing is the path the
API actually takes, VPN included.

### What it sends

Not a toy prompt. Timing a two-token `OK` tells you nothing about the workload the app runs,
so the profile prompt is shaped like a real RAG request: a system instruction, five retrieved
sources of a few hundred tokens each, one question, and `num_predict: 200` at
`temperature: 0`.

```
[run <nonce>]
You answer questions about City of Toronto services using only the context.

[Source: https://www.toronto.ca/doc-0]
Toronto utility bills cover water, wastewater and solid waste charges... (x6)

... five sources ...

Question: How do I pay my water bill?
```

### The nonce is not decoration

Ollama caches the KV for a prompt prefix. Sending the same text twice makes the second
prefill look almost free: **888 ms became 21 ms** between two identical runs, reported as
**68,912 tok/s**. That is a cache hit being read as a compute rate.

The nonce goes **first** because caching matches on the prefix. Appending it would leave the
shared head cached and measure only the tail. Any local-inference benchmark that does not do
this is probably reporting its own cache.

### What it separates

`/api/generate` returns `prompt_eval_duration` and `eval_duration` in nanoseconds, so the
wall clock splits four ways:

| Segment | Meaning | Bound by |
|---|---|---|
| `load` | model being read into VRAM | disk, and ~0 if resident |
| `prefill` | processing the prompt | compute |
| `decode` | generating the answer | memory bandwidth |
| `other` | wall clock minus the above | network, HTTP, scheduling |

`other` is the one people forget. Across a VPN it is often the part worth attacking, and no
amount of quantisation touches it. If it exceeds a quarter of the wall clock, check
`tailscale status` says `direct` and not `relay` before touching the model.

### Results

Measured 2026-09-01 from the VPS, both hosts on `qwen2.5:7b-instruct` (4.9 GB, fully on GPU),
`OLLAMA_CONTEXT_LENGTH=8192`, Ollama 0.33.1, warm model on both.

| Card | Bandwidth | Prefill | Decode | Ceiling | Bandwidth efficiency |
|---|---|---|---|---|---|
| RTX 3070 (CUDA) | 448 GB/s | 3,409 tok/s | 82 tok/s | 91.4 tok/s | **90%** |
| RX 7900 XT (ROCm) | 800 GB/s | 3,443 tok/s | 97 tok/s | 163.3 tok/s | **59%** |

Ceiling is bandwidth divided by model size, which is what decode can reach if it saturates
memory. Prefill is a dead heat, 1.01x. Decode favours the AMD card by 1.18x against a 1.79x
bandwidth advantage, so it converts about a third of its extra bandwidth into tokens.

**The decode gap is real and the prefill gap was not.** An earlier run of this benchmark
recorded the AMD card losing prompt processing, 2,665 tok/s against 3,381, and concluded that
a card losing the compute-bound half pointed at immature HIP kernels rather than hardware.
That was measurement error. See below.

### Where the AMD card's advantage goes

The 7900 XT has more of everything on paper and converts almost none of it:

| | AMD advantage on paper | Realised |
|---|---|---|
| Memory bandwidth | 1.79x | **1.19x** (decode) |
| FP16 compute | 1.27x vs the 3070's dense tensor path | **1.00x** (prefill) |

Working back from the measurement: 3,400 tok/s of prefill on a 7.62B model is roughly
`2 x params x tokens` = **51.8 TFLOPS** of useful work.

| Path | Peak | Utilisation |
|---|---|---|
| RTX 3070 shader FP16 | 40.6 TFLOPS | 128%, so impossible: the tensor cores are in use |
| RTX 3070 tensor FP16, dense | 81.3 TFLOPS | **64%**, near a realistic GEMM ceiling |
| RX 7900 XT FP16 | 102.96 TFLOPS | **50%**, real headroom unused |

So the tie is not two cards hitting a shared external limit. It is one card being used well and
the other not. The 3070 is close to what its silicon can do; the 7900 XT is leaving about half
of its paper compute on the floor, and about two thirds of its bandwidth advantage.

That is a single consistent story about the ROCm and HIP path rather than two separate
mysteries, and it is a stricter claim than the one this document made first. The AMD card does
not lose prefill. It fails to win a race it should win by 1.27x.

The figures are theoretical peaks from vendor specifications, and a Q4 quantised model does not
spend all its time in dense FP16 GEMM, so treat the utilisation column as an order of magnitude
rather than a measurement. The ranking it produces is robust; the exact percentages are not.

### The model has to be warm, and the tool tells you whether it was

Both figures below are the same host, same model, same command, minutes apart:

| Run | Warmup generation | Prefill | Decode |
|---|---|---|---|
| First, straight after the model loaded | 6,787 ms | 2,756 tok/s | 97 tok/s |
| Second | 127 ms | **3,443 tok/s** | 97 tok/s |

Prefill moved 25 percent between them. Decode did not move at all, which is the clue: decode
streams weights that are already resident, while prefill on a freshly loaded model pays for
work that has nothing to do with the card.

`load` reported 1 ms in both runs, so the usual check for a cold model does not catch this.
The tell is the line above the profile:

```
  [ok]   generated in 6787ms: 'OK'     <- cold, discard the prefill number
  [ok]   generated in 127ms: 'OK'      <- warm, trust it
```

**Always profile twice and keep the second run.** The original comparison put a cold AMD host
against a warm NVIDIA one and read the difference as an architectural finding, which held up
for a week because it was a plausible story about ROCm kernels and nobody re-ran it.

### Which model this was, derived rather than recorded

The tag was not written down at the time. It is recoverable from the numbers, because decode
is bandwidth-bound and the ceiling is bandwidth divided by bytes read per token:

| Card | Implied ceiling | Implied model size |
|---|---|---|
| RTX 3070 | 85 / 0.89 = 95.5 tok/s | 448 / 95.5 = **4.69 GB** |
| RX 7900 XT | 95 / 0.55 = 172.7 tok/s | 800 / 172.7 = **4.63 GB** |

Two independent measurements agreeing within 1.3 percent on a 4.7 GB model, which is a 7B at
Q4_K_M. On the 8 GB host that is `qwen2.5:7b-instruct`, or possibly `llama3:latest`, the only
other model of that size installed there.

Use **`qwen2.5:7b-instruct`** for any future head-to-head:

- it is already on the 8 GB host, so there is no second pull and no quantisation mismatch
- it is **dense**, so bytes-read-per-token really is the model size and the efficiency
  arithmetic above holds. `gpt-oss:20b` is mixture-of-experts and reads far fewer bytes per
  token than its size implies, which would make the same calculation meaningless
- it does not reason, so no hidden thinking tokens inflate `eval_count` and distort decode
- it is the configured `OLLAMA_MODEL` default, so the measurement is of what would be served

`gpt-oss:20b` cannot be compared head-to-head, because it does not fit in 8 GB. That absence
is the deployment answer rather than a gap in the test.

---

## Tuning that did not work

Flash attention, a quantised KV cache, and pinning models resident moved decode from
**56 to 53 tok/s** on one model. That is noise, and in the wrong direction.

This is the expected result once you accept that decode is bandwidth-bound. The whole model
is read per token; flags do not change how many bytes that is. What does change it is a model
with fewer **active** parameters, which is why a mixture-of-experts model beats a larger dense
one on the same card.

### Ruling out throttling

Before blaming software, confirm the card is not quietly limiting itself. `rocm-smi` was not
installed and installing it needed permissions we did not have, so the clocks came from sysfs
instead, sampled 20 times during a live generation. The paths are stable across AMD cards; the
exact loop below is written from memory rather than copied, so treat it as the shape of the
check and not as a transcript:

```bash
cat /sys/class/drm/card*/device/power_dpm_force_performance_level   # should be 'auto'
for i in $(seq 20); do
  cat /sys/class/drm/card*/device/pp_dpm_mclk | grep '\*'          # memory clock, live
  sleep 0.5
done
```

Memory pinned at **1,249 MHz**, drawing **250 W** at **63 °C**, for the whole generation. The
card was running flat out. The gap is the kernels.

---

## What the tuning flags are actually worth

Measured 2026-09-01 with the host configuration printed and verified immediately before each
sweep, after an earlier attempt produced numbers that could not be attributed to a
configuration with confidence.

### qwen2.5:7b-instruct, dense, 4.9 GB

| Arm | Configuration | Prefill | Decode | Bandwidth efficiency |
|---|---|---|---|---|
| A | `FLASH_ATTENTION=1`, `KV_CACHE_TYPE=q8_0` | 3,414 | 93 | 57% |
| B | `FLASH_ATTENTION=1`, default f16 cache | 3,430 | **98** | **60%** |
| C | `FLASH_ATTENTION=0`, default f16 cache | 3,009 | 89 | 55% |

B against A isolates the quantised KV cache. B against C isolates flash attention.

**The q8_0 KV cache costs 5.4 percent of decode.** It is a VRAM-saving option, and at these
context lengths it saves under one percent of memory traffic while charging several times that
in dequantisation. On a 20 GB card holding a 4.9 GB model there was no VRAM problem for it to
solve. Removed.

**Flash attention earns its place**, worth 10 percent of decode and 14 percent of prefill. This
was the leading suspect for the efficiency gap, on the theory that ROCm needs a rocWMMA build
and can otherwise lose to not using it. That theory is now dead: whatever Ollama's bundled
build does, its flash attention is a clear gain here.

### gpt-oss:20b, mixture-of-experts, 13.8 GB, the production model

| Configuration | Prefill | Decode |
|---|---|---|
| `FLASH_ATTENTION=0` | 2,008 | 109 |
| `FLASH_ATTENTION=1` | **3,790** | **118** |

**Flash attention is worth 89 percent of prefill on the production model**, against 14 percent
on the 7B test model. Had the experiment been run only on the test model, turning flash
attention off would have looked like a modest loss rather than the serious one it is. Benchmark
the model you serve.

This model reads about 6.8 GB per token of a 13.8 GB file, which is mixture-of-experts
behaviour, and it decodes 20 percent faster than the 4.9 GB dense model despite being nearly
three times its size. That is why a 20 GB card is worth having: not for speed, but because it
can hold a model whose active parameters are small.

### Where the missing bandwidth goes: the Q4_K dequantisation path

The card was converting 60 percent of its memory bandwidth into tokens while the RTX 3070
converted 89 percent, and nothing in the configuration explained it. Changing only the
quantisation format does.

| Card | Quantisation | Size | Ceiling | Decode | Efficiency |
|---|---|---|---|---|---|
| RX 7900 XT | Q4_K_M | 4.9 GB | 163 tok/s | 98 | **60%** |
| RX 7900 XT | Q8_0 | 8.1 GB | 99 tok/s | 76 | **77%** |
| RTX 3070 | Q4_K_M | 4.9 GB | 91 tok/s | 81 | **89%** |

Same card, same prompt, same configuration, same model. Only the format differs, and 17 points
of bandwidth efficiency appear.

Q4_K unpacks a super-block structure with nested scales; Q8_0 is a scale multiply. The CUDA
implementation absorbs that complexity and still reaches 89 percent. The HIP port does not.

So the finding is narrower than "the AMD card is slow", and narrow enough to be actionable:
**llama.cpp's HIP Q4_K dequantisation leaves roughly 17 points of memory bandwidth unused on
gfx1100, where Q8_0 and the CUDA Q4_K path do not.**

Two things this does not establish. The obvious control, Q8_0 on the RTX 3070, is impossible
because an 8.1 GB model does not fit in 8 GB of VRAM. What stands in for it is that the 3070's
Q4_K already reaches 89 percent, leaving almost no room for a Q8_0 improvement, which suggests
the CUDA Q4_K kernel is healthy rather than that Q8_0 is universally easier. That is suggestive
and not conclusive.

And this is not a reason to switch formats. Q8_0 is more efficient and 22 percent slower in
absolute terms, 76 tok/s against 98, because the model is 65 percent larger. Q4_K remains the
right choice. It simply is not reaching what the hardware allows.

### What is left

Bandwidth efficiency moves from 57 to 60 percent for free. The remaining gap has no
configuration lever behind it. The runtime is current, the target is correct, the right backend
is selected over Vulkan, flash attention is helping, and the only setting that was hurting has
been removed. What remains is llama.cpp's HIP kernel throughput, which needs a custom build to
move and is not worth the maintenance on a machine serving production.

---

## Part 2: answer quality

```bash
uv run python scripts/compare_models.py
uv run python scripts/compare_models.py --models ollama1-gpt-oss-20b ollama2-qwen2.5-7b
uv run python scripts/compare_models.py --prompt-variant grounded
```

Six local models across the two hosts, scored on the same 100 Toronto service questions as
the hosted providers, with the same LLM judge.

| Short name | Host | Model |
|---|---|---|
| `ollama1-gpt-oss-20b` | RX 7900 XT | `gpt-oss:20b` |
| `ollama1-qwen3-14b` | RX 7900 XT | `qwen3:14b` |
| `ollama1-qwen2.5-14b` | RX 7900 XT | `qwen2.5:14b` |
| `ollama1-gemma3-12b` | RX 7900 XT | `gemma3:12b` |
| `ollama2-qwen2.5-7b` | RTX 3070 | `qwen2.5:7b-instruct` |
| `ollama2-llama3` | RTX 3070 | `llama3:latest` |

### Result

Across all 17 models in the wider comparison, hosted and local together, judged relevance
ranged **0.885 to 0.975** and groundedness **0.905 to 0.995**. Drop the single weakest model
and the relevance range is five points across sixteen.

The local models are inside that band. Nothing here separates a 20 billion parameter model on
a workstation from a hosted endpoint on the questions this product actually gets, which is the
finding that redirected the work toward retrieval and the corpus.

### Reading the scores honestly

Two cautions that apply to every number above.

`judge_relevance` scores "the evidence does not cover this" at zero, so a model that correctly
refuses is punished by that metric alone. Under `SYSTEM_PROMPT_VARIANT=grounded`, expect
relevance to read lower while the answers get better. The A/B across three models moved
**confident-but-unsupported answers from 7 to 2**, and both-low fell too, so it was not bought
with refusals.

And the retrieval accuracy these answers depend on was itself mismeasured for most of this
period. See [the benchmark post](https://www.zeever.ca/research/benchmarking-our-benchmark).

---

## What was decided

Local inference serves production. `gpt-oss:20b` runs on the RX 7900 XT because it is free,
private, and indistinguishable in quality from a paid model that costs roughly a dollar per
hundred questions.

The 7900 XT earns its place on **VRAM, not speed**. Twenty gigabytes is what lets it hold a 20
billion parameter model at all. On tokens per second the two cards are close enough that the
comparison does not decide anything.

---

## Reproducing this

```bash
# 1. Both hosts reachable, GPU-backed, and models resident
uv run python scripts/check_ollama.py

# 2. Throughput, from the VPS, same model on both.
#    Run each TWICE and keep the second. The first run after a model loads
#    under-reports prefill by about 25 percent, and `load` still says ~1ms so
#    nothing warns you. The tell is the "generated in Xms" line above the profile.
uv run python scripts/check_ollama.py --profile --url http://HOST_1_TAILNET_IP:11434 --model qwen2.5:7b-instruct
uv run python scripts/check_ollama.py --profile --url http://HOST_2_TAILNET_IP:11434 --model qwen2.5:7b-instruct

# 3. Answer quality on the 100-question set
uv run python scripts/compare_models.py --models ollama1-gpt-oss-20b ollama2-qwen2.5-7b
```

Both hosts must carry the same flags or step 2 is not a comparison. See
[Host configuration](#host-configuration): they did not, for the whole of the first run of
this benchmark.

Step 1 is not optional. Ollama runs happily on CPU when the GPU runtime is missing, so a host
passes every other check and is still far too slow to use. On AMD that usually means ROCm is
not seeing the card, and it is the failure most likely to waste an afternoon.

## Related

- `scripts/check_ollama.py` — reachability, GPU backing, and the throughput profile
- `scripts/compare_models.py` — the model matrix and the judged comparison
- `docs/EVALS.md` — scoring dimensions
- `.env.example` — the `OLLAMA_*` settings and why each exists

# Q4_K decode leaves ~17 points of memory bandwidth unused on RDNA3 (gfx1100)

**Status:** ready to send. Not yet filed upstream.
**Suggested destination:** ggml-org/llama.cpp discussions, or ollama/ollama if they prefer to triage first.
**Date measured:** 2026-09-01

---

## Summary for a non-specialist

Large language models run by repeatedly reading their own weights out of graphics memory.
Because the whole model is read once per word produced, the speed you get is mostly decided by
how fast the card can move data, not by how clever the card is. So there is a simple ceiling:
memory speed divided by model size.

An AMD Radeon RX 7900 XT should therefore be substantially faster than an NVIDIA RTX 3070,
because it can move data about 1.8 times as fast. It is only 1.2 times faster in practice.

The interesting part is where the difference goes. Model files are compressed, and the card has
to decompress each piece as it reads it. There are several compression formats. **With one
common format the AMD card reaches only 60 percent of its theoretical speed. With a simpler
format it reaches 77 percent. The NVIDIA card reaches 89 percent on the same format where AMD
manages 60.**

That points at one specific piece of software: the routine that decompresses that particular
format on AMD hardware. Everything else was checked and eliminated.

**Why it matters:** the affected format, Q4_K, is the default for most people running models
locally, because it gives the best size-to-quality trade. Anyone running it on an RDNA3 card is
getting roughly two thirds of the speed their hardware allows.

---

## The finding in one line

`llama.cpp`'s HIP backend reaches 60 percent of theoretical memory bandwidth decoding a Q4_K_M
model on gfx1100, where the same card reaches 77 percent on Q8_0 and the CUDA backend reaches
89 percent on Q4_K_M.

## The numbers

| GPU | Backend | Quantisation | Model size | Theoretical ceiling | Measured decode | Efficiency |
|---|---|---|---|---|---|---|
| RX 7900 XT | ROCm/HIP | Q4_K_M | 4.9 GB | 163 tok/s | 98 tok/s | **60%** |
| RX 7900 XT | ROCm/HIP | Q8_0 | 8.1 GB | 99 tok/s | 76 tok/s | **77%** |
| RTX 3070 | CUDA | Q4_K_M | 4.9 GB | 91 tok/s | 81 tok/s | **89%** |

Ceiling is the card's rated memory bandwidth divided by the model file size, which is the rate
at which the weights could be read if memory were perfectly saturated. RX 7900 XT is 800 GB/s;
RTX 3070 is 448 GB/s.

Both AMD rows are the same physical card, the same prompt, the same server configuration and
the same base model. **Only the quantisation format differs.**

Prefill, which is compute-bound rather than bandwidth-bound, is level between the two cards at
roughly 3,420 tokens per second. The gap is specific to decode.

---

## Hardware and software

### Host A, AMD

| | |
|---|---|
| Machine | HP Z640 workstation |
| CPU | Intel Xeon E5-1650 v4, 6 cores / 12 threads |
| Memory | 31 GB |
| GPU | AMD Radeon RX 7900 XT, 20 GB (20,464 MiB), PCI `1002:744c`, target `gfx1100` |
| PCIe | x16, negotiated |
| OS | Ubuntu 22.04.5 LTS, kernel 6.8.0-138-generic |

### Host B, NVIDIA

| | |
|---|---|
| Machine | Dell XPS 8940 |
| CPU | Intel Core i5-11400, 6 cores / 12 threads |
| Memory | 38 GB |
| GPU | NVIDIA GeForce RTX 3070, 8 GB, compute capability 8.6 |
| Driver | 580.173.02, supporting CUDA 13.0 |
| PCIe | Gen3 x16 confirmed under load |
| OS | Ubuntu 22.04.5 LTS, kernel 6.8.0-138-generic |

### Software

| | |
|---|---|
| Ollama | 0.33.1 |
| llama.cpp | as bundled by Ollama: `libllama.so.0.3.0`, `libggml.so.0.22.0` |
| AMD runtime | ROCm 7.2, bundled by Ollama at `/usr/local/lib/ollama/rocm_v7_2`. No system ROCm installed. |
| NVIDIA runtime | CUDA, bundled by Ollama at `/usr/local/lib/ollama/cuda_v12` and `cuda_v13` |
| Models | `qwen2.5:7b-instruct` (Q4_K_M, 4.9 GB), `qwen2.5:7b-instruct-q8_0` (Q8_0, 8.1 GB) |

Ollama confirmed selecting ROCm rather than its bundled Vulkan backend:

```
msg="inference compute" library=ROCm compute=gfx1100 libdirs=ollama,rocm_v7_2
     description="AMD Radeon Graphics" type=discrete total="20.0 GiB"
```

### Server configuration

Identical on both hosts:

```ini
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
```

---

## What was ruled out

Each of these was measured, not assumed.

| Possible cause | How it was eliminated |
|---|---|
| Old or mismatched ROCm | ROCm 7.2, current generation, targeting `gfx1100` correctly |
| Vulkan backend selected instead of ROCm | Journal shows `library=ROCm` |
| Model running on CPU | 98 tok/s is six times the host CPU's theoretical maximum of 15.7 tok/s |
| Thermal or power throttling | Memory clock pinned at 1,249 MHz during generation, 63 °C, 107 W |
| PCIe link downgraded | x16 negotiated; the idle Gen1 reading on the NVIDIA host is Ampere power saving, Gen3 under load |
| Host CPU bottleneck | The faster CPU leads by only 3 percent, and only on long prompts, which is the wrong shape for launch overhead |
| Network path | Rates come from Ollama's own `prompt_eval_duration` and `eval_duration` counters, measured inside the server process |
| Flash attention misbehaving on ROCm | Tested directly: enabling it *gains* 10 percent decode and 14 percent prefill |
| Quantised KV cache | Tested directly: `OLLAMA_KV_CACHE_TYPE=q8_0` costs 5.4 percent and was removed before these measurements |
| Cold model skewing results | One warm-up run discarded per measurement; a cold model under-reports prefill by about 25 percent |
| Prompt-cache reuse | Each request carries a unique nonce at the front of the prompt |

---

## How to reproduce

### 1. Install

Install Ollama on a machine with an RDNA3 card, and on a machine with an NVIDIA card if you
want the comparison. No system ROCm or CUDA toolkit is needed; Ollama bundles both.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b-instruct
ollama pull qwen2.5:7b-instruct-q8_0     # 8.1 GB, needs a card with 10 GB or more
```

### 2. Confirm which backend is in use

```bash
journalctl -u ollama --no-pager | grep -o 'library=[A-Za-z]*' | sort | uniq -c
```

Expect `library=ROCm` on AMD. If it says Vulkan, the measurement is of something else.

### 3. Measure

Save as `measure.sh`:

```bash
#!/usr/bin/env bash
# usage: ./measure.sh http://localhost:11434 qwen2.5:7b-instruct
HOST=${1:?host url}; MODEL=${2:?model tag}
run() {
  # A unique prefix per request. Without it the server returns a cached prefill
  # and the numbers describe the cache rather than the hardware.
  NONCE=$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')
  curl -s "$HOST/api/generate" -d "{
      \"model\": \"$MODEL\",
      \"prompt\": \"[$NONCE] Explain how GPU memory bandwidth limits language model inference. At least 200 words.\",
      \"stream\": false,
      \"options\": {\"temperature\": 0, \"num_predict\": 200}
    }" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if "error" in d:
    print("  error:", d["error"]); raise SystemExit(1)
pe, ev = d["prompt_eval_duration"], d["eval_duration"]
print("  prefill %6.0f tok/s   decode %5.0f tok/s" % (
    d["prompt_eval_count"] / (pe / 1e9), d["eval_count"] / (ev / 1e9)))'
}
echo "warm-up (discarded)"; run >/dev/null
for i in 1 2 3; do echo "run $i"; run; done
```

```bash
chmod +x measure.sh
./measure.sh http://localhost:11434 qwen2.5:7b-instruct
./measure.sh http://localhost:11434 qwen2.5:7b-instruct-q8_0
```

The warm-up matters. The first request after a model loads under-reports prefill by roughly
25 percent, and the server reports a load time near zero either way, so nothing warns you.

### 4. Compute efficiency

```
efficiency = measured_decode / (card_bandwidth_GBps / model_size_GB)
```

`ollama list` gives the model size. Card bandwidth is a published specification: 800 GB/s for
the RX 7900 XT, 448 GB/s for the RTX 3070.

---

## Limits of this evidence

**The obvious control could not be run.** Q8_0 on the RTX 3070 would show whether NVIDIA has
the same Q4_K-versus-Q8_0 gap. The 8.1 GB model does not fit in 8 GB of VRAM. What stands in
for it is that the NVIDIA card's Q4_K already reaches 89 percent, leaving little room for a
Q8_0 improvement, which suggests the CUDA Q4_K path is healthy. That is suggestive, not
conclusive.

**One card, one model family, one host each.** Three data points, each reproduced across three
timed runs with under 1 percent spread, but a single physical card of each type.

**Theoretical bandwidth is a specification, not a measurement.** No independent memory-bandwidth
benchmark was run on either card, so the ceilings are vendor figures.

**We did not read the kernel source.** The conclusion that Q4_K dequantisation is responsible is
inferred from the format being the only variable that changed, not from profiling the kernel.
A maintainer with `rocprof` would settle in minutes what took us a day of elimination.

---

## What would help

If this is a known characteristic of the HIP Q4_K path, saying so would be useful; several
public benchmarks of this card report figures consistent with 60 percent without commenting on
it, so users may be assuming their hardware is the limit.

If it is not known, the reproduction above is small and needs no application code.

#!/usr/bin/env bash
# Dump everything needed to reproduce or debug an Ollama host, in one paste.
#
#   bash scripts/capture_ollama_host.sh            # to stdout
#   bash scripts/capture_ollama_host.sh > host.txt
#
# Written because the benchmark documentation kept being reconstructed from
# memory and was wrong three times: the systemd override values, the sysfs
# sampling loop, and the model tag used for a head-to-head. Everything here is
# read from the machine.
#
# Safe to paste anywhere. It prints no keys, no tokens and no file contents
# beyond the Ollama unit configuration, which holds only addresses and tuning.
set -uo pipefail

hdr() { printf '\n=== %s ===\n' "$1"; }

hdr "host"
hostname
. /etc/os-release 2>/dev/null && echo "os: ${PRETTY_NAME:-unknown}"
echo "kernel: $(uname -r)"

hdr "cpu and memory"
lscpu | grep -E 'Model name|^CPU\(s\)|CPU max MHz|Socket' | sed 's/  */ /g'
free -g | awk 'NR<=2'

hdr "gpu"
if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi --query-gpu=name,memory.total,driver_version,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current \
               --format=csv
    echo "note: link gen reads 1 at idle on Ampere; sample under load"
elif command -v rocm-smi >/dev/null 2>&1; then
    rocm-smi --showproductname --showdriverversion --showmeminfo vram 2>/dev/null | grep -vE '^$|====='
else
    echo "neither nvidia-smi nor rocm-smi present; reading sysfs instead"
    # rocm-smi is not installed on the AMD host, and Ollama ships its own ROCm
    # runtime rather than using a system one, so there may never be a reason to
    # install it. sysfs still has everything worth recording.
    for dev in /sys/class/drm/card*/device; do
        [ -e "$dev/mem_info_vram_total" ] || continue
        _vram=$(cat "$dev/mem_info_vram_total" 2>/dev/null || echo 0)
        echo "  $(basename "$(dirname "$dev")"): VRAM $(( _vram / 1024 / 1024 )) MiB"
        # The starred line is the level currently in use.
        for clk in sclk mclk; do
            [ -e "$dev/pp_dpm_$clk" ] && \
                echo "    $clk now: $(grep '\*' "$dev/pp_dpm_$clk" 2>/dev/null | tr -s ' ')"
        done
        for hw in "$dev"/hwmon/hwmon*; do
            [ -e "$hw/temp1_input" ] && \
                echo "    temp: $(( $(cat "$hw/temp1_input") / 1000 )) C"
            [ -e "$hw/power1_average" ] && \
                echo "    power: $(( $(cat "$hw/power1_average") / 1000000 )) W"
        done
    done
    # The card is still identifiable, and on AMD the kernel module version is
    # what actually matters for ROCm support.
    # Match the class description, not the hex ids. "3d" matched inside
    # [8086:8d3d] and reported a serial controller as a graphics card.
    lspci -nn | grep -iE 'VGA compatible controller|3D controller|Display controller'
fi

hdr "nvidia / cuda stack"
# Mirrors the AMD section below. The same question applies to both hosts:
# Ollama bundles its own runtime, so what the system has installed is context
# rather than what is being used, and "upgrade the driver" is a different
# proposition from "upgrade what Ollama ships".
if command -v nvidia-smi >/dev/null 2>&1; then
    # The CUDA version here is what the DRIVER supports, not a toolkit that is
    # installed. They are routinely different and the distinction matters when
    # deciding whether anything needs upgrading.
    _smi=$(nvidia-smi 2>/dev/null | head -4)
    _cuda=$(printf '%s\n' "$_smi" | sed -n 's/.*CUDA Version: *\([0-9.]*\).*/\1/p' | head -1)
    [ -n "$_cuda" ] && echo "driver supports CUDA: $_cuda" \
                    || echo "could not read a CUDA version from nvidia-smi"
    # Queried one field at a time. Combined, an unsupported field fails the whole
    # query and takes the supported ones down with it; driver_version is known to
    # work on this host and should not be lost to compute_cap not being
    # recognised on some other driver.
    for _f in driver_version compute_cap; do
        _v=$(nvidia-smi --query-gpu="$_f" --format=csv,noheader 2>/dev/null)
        [ -n "$_v" ] && echo "$_f: $_v" || echo "$_f: not reported by this nvidia-smi"
    done
    # The kernel module, which is what actually talks to the card and can differ
    # from the userspace tools after a partial upgrade.
    if _nvmod=$(modinfo nvidia 2>/dev/null); then
        printf '%s\n' "$_nvmod" | grep -E '^version' | head -1 \
            || echo "  nvidia module present, no version field"
    else
        echo "  nvidia kernel module not found by modinfo"
    fi
    # A system CUDA toolkit is not needed for Ollama and is worth knowing about
    # only so nobody upgrades it expecting an effect.
    if ls -d /usr/local/cuda* >/dev/null 2>&1; then
        echo "system CUDA toolkit: $(ls -d /usr/local/cuda* | tr '\n' ' ')"
    else
        echo "no system CUDA toolkit (not required; Ollama ships its own runtime)"
    fi
else
    echo "no nvidia-smi on this host"
fi

hdr "ollama bundled backends"
# Its own section because it describes both stacks. It previously sat under the
# AMD heading and printed cuda_v12 and cuda_v13 there on the NVIDIA host, which
# read as nonsense.
#
# Only the backend directories are listed. The forty-odd libggml-cpu-* variants
# are shipped for every host and say nothing about this one, so they are counted
# rather than printed.
_found=""
for _d in /usr/local/lib/ollama /usr/lib/ollama /opt/ollama/lib; do
    [ -d "$_d" ] || continue
    _found=1
    echo "$_d"
    _backends=$(ls "$_d" 2>/dev/null | grep -iE '^(cuda_v|rocm_v|vulkan|hip)' | tr '\n' ' ')
    echo "  backends: ${_backends:-none found}"
    echo "  other files: $(ls "$_d" 2>/dev/null | grep -icvE '^(cuda_v|rocm_v|vulkan|hip)') (cpu variants and shared libraries)"
done
[ -n "$_found" ] || echo "  no bundled library directory found in the usual locations"
# The installer fetches only what the hardware needs, so the two hosts differ:
# the AMD box carries rocm_v7_2 and the NVIDIA box does not.
_gfx=$(journalctl -u ollama --no-pager 2>/dev/null \
       | grep -oiE 'gfx[0-9]+[a-z]*' | sort | uniq -c | sort -rn | head -3)
if [ -n "$_gfx" ]; then
    echo "  GPU targets seen in the journal:"
    printf '%s\n' "$_gfx" | sed 's/^/    /'
fi
# The backend Ollama actually selected, which is the thing that matters and is
# not visible from the directory listing.
_lib=$(journalctl -u ollama --no-pager 2>/dev/null \
       | grep -o 'library=[A-Za-z]*' | sort | uniq -c | sort -rn | head -2)
if [ -n "$_lib" ]; then
    echo "  backend selected at load time:"
    printf '%s\n' "$_lib" | sed 's/^/    /'
else
    echo "  no library= line in the journal (nothing loaded yet, or no journal access)"
fi

hdr "amd / rocm stack"
# A system ROCm install is not required and its absence says nothing about
# whether the GPU is in use. Ollama bundles its own ROCm runtime and uses that.
# Printing a bare "no /opt/rocm" under a heading called "rocm stack" read as
# "ROCm is missing", which is alarming and wrong.
if [ -d /opt/rocm ]; then
    echo "system ROCm: $(cat /opt/rocm/.info/version 2>/dev/null || readlink -f /opt/rocm)"
    echo "  (Ollama still uses its own bundled runtime, not this one)"
    ls -d /opt/rocm-* 2>/dev/null
else
    echo "system ROCm: not installed, which is expected and not a problem"
    echo "  Ollama ships its own ROCm runtime; the system copy is not used."
fi
# Ask sysfs whether an AMD card is present, rather than asking about the module.
#
# modinfo was wrong because it reads the module file, which ships with every
# Ubuntu kernel and so succeeds on a machine with no AMD hardware. lsmod was
# wrong too, in the other direction: it reported no amdgpu on the host that was
# visibly driving a 20GB Radeon at 2,922MHz two lines earlier. Whatever the
# reason for that, the DRM vendor id is the thing actually being asked about,
# and the sysfs walk above has already proven it readable on this host.
_amd_card=""
for _dev in /sys/class/drm/card*/device; do
    [ -r "$_dev/vendor" ] || continue
    [ "$(cat "$_dev/vendor" 2>/dev/null)" = "0x1002" ] && { _amd_card="$_dev"; break; }
done
if [ -n "$_amd_card" ]; then
    echo "AMD GPU present at $_amd_card (vendor 0x1002)"
    modinfo amdgpu 2>/dev/null | grep -E '^version|^srcversion' | head -2 \
        || echo "  modinfo reports no version field for amdgpu"
else
    echo "no AMD GPU on this host"
fi
for f in /sys/class/drm/card*/device/power_dpm_force_performance_level; do
    [ -e "$f" ] && echo "perf level ($f): $(cat "$f")"
done

hdr "ollama"
ollama --version 2>/dev/null || echo "ollama binary not on PATH for this user"
echo "--- unit configuration ---"
systemctl cat ollama 2>/dev/null | grep -vE '^\s*#' | grep -E '\[|Environment|ExecStart|User|Group'
echo "--- effective environment ---"
# --value, because `systemctl show -p Environment` prints the property name glued
# to the first variable: "Environment=OLLAMA_HOST=x OLLAMA_FOO=y". Splitting that
# on spaces leaves "Environment=OLLAMA_HOST=x", which matches no ^OLLAMA pattern.
# It happened to work on these two hosts only because PATH is first and absorbed
# the prefix. Supported since systemd 230.
# `systemctl show -p Environment` glues the property name onto the first
# variable: "Environment=OLLAMA_HOST=x OLLAMA_FOO=y". Split on spaces and the
# first entry is "Environment=OLLAMA_HOST=x", matching no ^OLLAMA pattern, so
# OLLAMA_HOST reads empty and the model list is fetched from the wrong endpoint.
#
# --value strips the prefix, but only on systemd 230 and later. Older versions
# reject the option, exit non-zero and print nothing at all, so a bare sed after
# it has no input to strip and is inert in exactly the case it was added for.
# Hence a real fallback: run the plain form when the --value form fails, and let
# the sed handle the prefix that version leaves behind.
ollama_env() {
    { systemctl show ollama -p Environment --value --no-pager 2>/dev/null \
      || systemctl show ollama -p Environment --no-pager 2>/dev/null ; } \
        | sed 's/^Environment=//' | tr ' ' '\n'
}
_env=$(ollama_env)
if [ -z "$_env" ]; then
    echo "  could not read the unit environment (systemctl unavailable, or no such unit)"
else
    printf '%s\n' "$_env" | grep -E '^OLLAMA' || echo "  no OLLAMA_* variables set"
fi
echo "--- installed models ---"
OLLAMA_HOST_URL=$(ollama_env | grep '^OLLAMA_HOST=' | cut -d= -f2-)
if [ -z "$OLLAMA_HOST_URL" ]; then
    # Say so rather than quietly asking a different endpoint. Ollama binds to
    # OLLAMA_HOST alone, so on these hosts localhost is refused and a silent
    # fallback would report an empty model list as though it were the truth.
    echo "  OLLAMA_HOST not found in the unit environment; trying localhost:11434"
    OLLAMA_HOST_URL=localhost:11434
fi

# The JSON goes to a file and the Python comes from a quoted heredoc, rather than
# python3 -c inside a bash string. A single-quoted bash string cannot contain a
# single quote, which is what forced backslash-escaped quotes into an f-string
# expression, which is a SyntaxError before Python 3.12. A heredoc has no such
# rule, so the Python below is ordinary Python and runs on 3.6 upwards.
_tags=$(mktemp)
if curl -s --max-time 10 "http://${OLLAMA_HOST_URL}/api/tags" -o "$_tags"; then
    # stderr is deliberately not discarded here. Hiding it is what let a
    # SyntaxError present as an empty model list on hosts with older Python.
    python3 - "$_tags" <<'PYEOF'
import json
import sys

try:
    with open(sys.argv[1]) as fh:
        models = json.load(fh)["models"]
except Exception as exc:
    print("  could not read the model list: {}: {}".format(type(exc).__name__, exc))
    sys.exit(0)

if not models:
    print("  none installed")
for m in sorted(models, key=lambda m: -m.get("size", 0)):
    size_gb = m.get("size", 0) / 1e9
    print("  {:6.1f} GB  {}".format(size_gb, m.get("name", "?")))
PYEOF
else
    echo "  could not reach ${OLLAMA_HOST_URL}"
fi
rm -f "$_tags"

hdr "what ollama loaded last"
# n_ctx_slot is the context actually in use, which is not always what
# OLLAMA_CONTEXT_LENGTH says: a typo in the unit file left it unset for weeks.
# journalctl's exit status is tested separately from grep's. Under pipefail a
# grep that matches nothing fails the whole pipeline, so a single || message
# would report "no journal access" on a host where access worked and the log
# simply had nothing yet. That is the normal state right after a restart, before
# any model has been loaded.
if _journal=$(journalctl -u ollama --no-pager 2>/dev/null); then
    _hits=$(printf '%s\n' "$_journal" \
        | grep -oiE 'n_ctx_slot *=? *[0-9]+|flash_attn *=? *[01]|type_k *=? *[a-z0-9_]+' \
        | sort | uniq -c | sort -rn | head -8)
    if [ -n "$_hits" ]; then
        printf '%s\n' "$_hits"
    else
        echo "  journal readable, but no n_ctx_slot, flash_attn or type_k lines in it"
        echo "  (expected right after a restart, before a model has been loaded)"
    fi
else
    echo "  no journal access for this user"
fi

hdr "tailscale"
if _ts=$(tailscale status 2>/dev/null); then
    printf '%s\n' "$_ts" | head -5
else
    echo "  not installed or not permitted"
fi

"""Shared helpers for AI-driven PR reviews.

Used by scripts/compare-review.py (multi-model benchmark harness).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx


TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
DEFAULT_MODEL = "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8"

SYSTEM_PROMPT = """\
You are a senior code reviewer. Review the pull request diff below and identify \
only issues that matter.

## Rules
- Only flag real bugs, security issues, or logic errors.
- Do NOT flag style, formatting, or naming nitpicks.
- Do NOT flag issues a linter or type checker would catch.
- Do NOT flag pre-existing issues — only review changed lines (lines starting with +).
- Do NOT flag pedantic nitpicks or general code quality concerns unless they cause bugs.
- Do NOT flag issues silenced by lint ignore comments.
- Lead with questions. Use "we" not "you".
- If the PR is clean, say so — an empty issues list is a valid response.

## Do NOT flag (false positive list)
- Pre-existing issues (code that was not changed in this diff)
- Code style or formatting
- Issues a linter would catch (unused imports, missing types, etc.)
- Pedantic nitpicks
- General code quality concerns unless they cause actual bugs
- Issues silenced by lint ignore comments

## Response format
Respond with ONLY a JSON object (no markdown fences, no extra text):
{
  "verdict": "approve" or "request_changes",
  "summary": "Brief overall assessment",
  "issues": [
    {
      "file": "path/to/file",
      "line": 42,
      "severity": "bug" or "security" or "logic",
      "message": "Description of the issue",
      "suggestion": "Optional fix suggestion or null"
    }
  ]
}

If the PR is clean, return verdict "approve" with an empty issues list.\
"""


def load_env() -> None:
    """Load .env file from project root if it exists."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


def run_gh(*args: str, check: bool = True) -> str:
    """Run a gh CLI command and return stdout."""
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        print(f"Error running: gh {' '.join(args)}", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def detect_pr_number() -> int:
    """Detect PR number from current branch."""
    output = run_gh("pr", "view", "--json", "number", "--jq", ".number")
    try:
        return int(output)
    except ValueError:
        print("Could not detect PR from current branch.", file=sys.stderr)
        sys.exit(1)


def get_repo_slug() -> str:
    return run_gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner")


def gather_pr_context(pr_number: int) -> dict:
    """Gather all context needed for review."""
    repo = get_repo_slug()

    pr_json = run_gh(
        "pr", "view", str(pr_number),
        "--json", "title,body,headRefOid,baseRefName",
    )
    pr_data = json.loads(pr_json)

    diff = run_gh("pr", "diff", str(pr_number))

    comments = run_gh(
        "api", f"repos/{repo}/pulls/{pr_number}/comments",
        "--jq", ".[].body",
        check=False,
    )

    pr_comments = run_gh(
        "api", f"repos/{repo}/issues/{pr_number}/comments",
        "--jq", ".[].body",
        check=False,
    )

    return {
        "repo": repo,
        "number": pr_number,
        "title": pr_data.get("title", ""),
        "body": pr_data.get("body", "") or "",
        "head_sha": pr_data.get("headRefOid", ""),
        "base_ref": pr_data.get("baseRefName", "main"),
        "diff": diff,
        "existing_comments": (comments + "\n" + pr_comments).strip(),
    }


def gather_claude_md_files(diff: str) -> str:
    """Extract CLAUDE.md content from directories affected by the diff."""
    paths = set()
    for line in diff.splitlines():
        match = re.match(r"^(?:\+\+\+ b/|--- a/)(.+)$", line)
        if match and match.group(1) != "/dev/null":
            paths.add(match.group(1))

    claude_md_dirs = set()
    for path in paths:
        parts = path.split("/")
        for i in range(len(parts)):
            dir_path = "/".join(parts[:i]) if i > 0 else "."
            claude_md_dirs.add(dir_path)

    contents = []
    seen = set()
    for dir_path in sorted(claude_md_dirs):
        candidate = os.path.join(dir_path, "CLAUDE.md")
        full_path = os.path.join(os.getcwd(), candidate)
        if full_path not in seen and os.path.isfile(full_path):
            seen.add(full_path)
            with open(full_path) as f:
                text = f.read().strip()
            if text:
                contents.append(f"### {candidate}\n{text}")

    return "\n\n".join(contents) if contents else ""


def build_prompt(context: dict, request: str | None = None) -> str:
    """Build the user prompt from PR context."""
    parts = [
        f"# PR #{context['number']}: {context['title']}",
        "",
    ]

    if context["body"]:
        parts.append(f"## Description\n{context['body']}")
        parts.append("")

    if request:
        parts.append(f"## Reviewer Request\n{request}")
        parts.append("")

    if context["existing_comments"]:
        parts.append(f"## Existing Comments\n{context['existing_comments']}")
        parts.append("")

    claude_md = gather_claude_md_files(context["diff"])
    if claude_md:
        parts.append(f"## Project Context (CLAUDE.md files)\n{claude_md}")
        parts.append("")

    parts.append(f"## Diff\n```diff\n{context['diff']}\n```")

    return "\n".join(parts)


@dataclass
class ReviewCallResult:
    review: dict
    raw_content: str
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str


class ReviewCallError(RuntimeError):
    """Raised when the model call fails or returns unparseable output."""


def call_together(prompt: str, model: str = DEFAULT_MODEL,
                  temperature: float = 0.2, max_tokens: int = 16384,
                  timeout: float = 300.0) -> ReviewCallResult:
    """Call Together.ai chat completions and return parsed review + metadata.

    Raises ReviewCallError on HTTP / parse failures so callers can recover.
    """
    api_key = os.environ.get("TOGETHER_API_KEY")
    if not api_key:
        raise ReviewCallError("TOGETHER_API_KEY environment variable not set.")

    started = time.monotonic()
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                TOGETHER_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise ReviewCallError(
            f"Together.ai API error {e.response.status_code}: {e.response.text[:500]}"
        ) from e
    except httpx.RequestError as e:
        raise ReviewCallError(f"Together.ai request failed: {e}") from e

    elapsed_ms = int((time.monotonic() - started) * 1000)

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise ReviewCallError(f"No choices in response: {json.dumps(data)[:500]}")

    content = choices[0]["message"]["content"]

    # Strip thinking tags if present (Qwen3, MiniMax-M2.7, etc. may include them)
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        review = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ReviewCallError(
            f"Failed to parse JSON: {e}\n"
            f"--- raw (first 2000) ---\n{content[:2000]}\n"
            f"--- cleaned (first 2000) ---\n{cleaned[:2000]}"
        ) from e

    usage = data.get("usage") or {}
    return ReviewCallResult(
        review=review,
        raw_content=content,
        latency_ms=elapsed_ms,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
        total_tokens=int(usage.get("total_tokens") or 0),
        model=model,
    )


def format_review(review: dict) -> str:
    """Format review for terminal output."""
    lines = []

    verdict = review.get("verdict", "approve").upper()
    color = "\033[32m" if verdict == "APPROVE" else "\033[31m"
    reset = "\033[0m"

    lines.append(f"\n{color}{'=' * 60}{reset}")
    lines.append(f"{color}  Verdict: {verdict}{reset}")
    lines.append(f"{color}{'=' * 60}{reset}")
    lines.append("")
    lines.append(review.get("summary", ""))

    issues = review.get("issues", [])
    if issues:
        lines.append(f"\n--- Issues ({len(issues)}) ---\n")
        for issue in issues:
            severity = issue.get("severity", "bug").upper()
            file = issue.get("file", "?")
            line_num = issue.get("line", "?")
            message = issue.get("message", "")
            suggestion = issue.get("suggestion")

            lines.append(f"  [{severity}] {file}:{line_num}")
            lines.append(f"    {message}")
            if suggestion:
                lines.append(f"    Suggestion: {suggestion}")
            lines.append("")
    else:
        lines.append("\nNo issues found.")

    lines.append("")
    return "\n".join(lines)

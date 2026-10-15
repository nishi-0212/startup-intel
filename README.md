# Multi-Agent Startup Intelligence Orchestrator

Enter a startup name, watch four research agents run in parallel, then get a verified report with source links.

## Architecture

```
            ┌──────── plan (supervisor) ────────┐
            ▼            ▼           ▼          ▼
        research      market    competitor   funding      (parallel LangGraph fan-out)
            └────────────┴─────┬─────┴──────────┘
                             gate ── no agent succeeded ──► END (status: failed)
                               │
                            verify  (deterministic checks)
                               │
                            synth   (report) ──► END
```

- **Supervisor**: a LangGraph `StateGraph`. `plan` fans out to 4 agents; `gate` is the conditional router.
- **State**: LangGraph state carries the job id; the full job (agent status, outputs, tools called, events, budget) lives in a dict persisted to SQLite after every event.
- **Resume / inspect**: `GET /api/jobs/{id}` returns everything; `POST /api/jobs/{id}/resume` reruns only agents that are not `done`.
- **Agents** share one pipeline: Tavily search → (optional Wikipedia / HN Algolia) → sanitize → Groq extracts JSON citing source numbers → numbers are mapped back to real URLs. The LLM cannot invent a URL; invalid ids are dropped and the claim is flagged unsupported.
- **Verification agent** (no LLM): unsupported claims, undated market claims, conflicting funding amounts for the same round, duplicate sources, injection flags.

## Real APIs
| API | Used for | Required |
|---|---|---|
| Tavily Search | web search for all agents | yes (`TAVILY_API_KEY`) |
| Groq chat completions | structured extraction + synthesis | yes (`GROQ_API_KEY`) |
| Wikipedia REST | company summary (optional) | no key |
| Hacker News Algolia | market signals (optional) | no key |

Every call goes through one HTTP helper: timeout, 3 attempts with exponential backoff on timeouts/429/5xx, 1-hour cache, clear error messages. A failed call is never replaced with made-up data; the agent is marked `failed` and the report lists it under missing data. Optional sources failing just get logged.

## Budgets
`MAX_API_CALLS` (counts every HTTP attempt) and `MAX_TOKENS` (from Groq usage). When exhausted, remaining agents are marked `skipped` and the job ends `partial`.

## Prompt-injection defence
Retrieved text is stripped of instruction-like sentences (and flagged in the UI), wrapped in `<untrusted>` tags, and the system prompt says to treat it as data. The LLM has no tools, so it cannot act on injected text. This is a heuristic filter, not a guarantee.

## Run locally
```bash
cp .env.example backend/.env      # add TAVILY_API_KEY and GROQ_API_KEY
cd backend && pip install -r requirements.txt
uvicorn app:app --reload          # http://localhost:8000
# new terminal
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Tests
```bash
cd backend && pytest -q
```
Mocks cover: success, partial result, total failure, resume, timeout recovery, rate-limit exhaustion, caching, both budgets, injection removal (and that it never reaches the LLM), conflicting funding, unsupported claims, missing funding, persistence, and parallelism (≥3 agents overlapping).

## Demo of failure recovery
Set `SIMULATE_FAILURE=1`: the first Tavily call times out, the retry log shows in the UI, and the job still completes. Run it for two real startups (e.g. "Zepto", "Razorpay") and export each report with the button in the dashboard.

## Trade-offs and known limitations
- Single-process asyncio tasks + SQLite instead of Celery/Redis/MongoDB, to keep setup to two commands. A job running when the server dies is not auto-resumed; click Resume.
- Funding data comes from web snippets, not a dedicated database like Crunchbase, so coverage of private rounds is limited and often reports "not found".
- Extraction quality depends on search snippets (700 chars each); conflict detection only compares amounts for identical round names.
- Injection filter is regex-based.
- Polling (1.5s) for progress rather than websockets.
- Tests have not been run in the build environment (no PyPI access there); run `pytest` once after installing.

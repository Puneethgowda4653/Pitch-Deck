# iPreneur — Project Log

---

## Session: 2026-05-20

### 1. Diagnosed blank workspace page (critical crash)

**Problem:** `WorkspacePage.tsx` crashed immediately on load with:
```
ReferenceError: Cannot access 'projectQuery' before initialization
```
The `refetchInterval` callback referenced `projectQuery` — the same variable being declared by that `useQuery` call — before it was assigned (temporal dead zone).

**Fix:** Replaced the self-referencing closure with React Query v5's query-callback form:
```ts
// Before (crashes)
refetchInterval: () => ACTIVE_STATUSES.has(projectQuery.data?.status ?? "") ? ...

// After (safe)
refetchInterval: (query) => ACTIVE_STATUSES.has((query.state.data as Project)?.status ?? "") ? ...
```
`File: ipreneur/frontend/src/pages/workspace/WorkspacePage.tsx`

---

### 2. Fixed pitch deck generation (Celery not running)

**Problem:** Clicking "Generate Deck" triggered `run_analysis_pipeline.delay()` — a Celery task dispatch. The Celery worker container (`ipreneur_worker`) was not running outside Docker, so all jobs silently sat in the Redis queue indefinitely.

**Fix:** Added `_run_analysis_inline()` — an async function that runs the full pipeline directly inside the FastAPI process using `asyncio.create_task`. Both `POST /projects` (with `start_analysis=true`) and `POST /projects/{id}/analyze` now use this approach.

`File: ipreneur/backend/app/api/v1/endpoints/projects.py`

---

### 3. Fixed CORS blocking frontend on port 3002

**Problem:** Vite dev server landed on port 3002 (3000 and 3001 already in use), but `.env` only listed 3000, 3001, 5173 in `CORS_ORIGINS`.

**Fix:** Added `http://localhost:3002` to `CORS_ORIGINS` in `ipreneur/backend/.env`.

---

### 4. Fixed progress bar showing `undefined%`

**Problem:** `AnalysisProgress.tsx` read `progress.total_progress` directly, but the API client camelizes all responses (`total_progress` → `totalProgress`), so the value was always `undefined`.

**Fix:** Changed to `progress.totalProgress ?? progress.total_progress ?? 0`.

`File: ipreneur/frontend/src/components/workspace/AnalysisProgress.tsx`

---

### 5. Fixed pipeline step names mismatch

**Problem:** Frontend `JOB_STEP_ORDER` had `["analyzing", "formatting"]` but the backend pipeline emits `["rendering", "uploading"]`. The progress stepper highlighted the wrong steps.

**Fix:** Updated frontend constants to match actual backend step names:
```ts
// Before
["crawling", "extracting", "researching", "analyzing", "generating", "formatting"]

// After
["crawling", "extracting", "researching", "generating", "rendering", "uploading"]
```
`File: ipreneur/frontend/src/constants/index.ts`

---

### 6. Added spinner for "analysis starting" state

**Problem:** After creating a project (or clicking Generate Deck), the workspace content area was completely blank until the first status poll resolved (~3 seconds), making users think nothing was happening.

**Fix:** Added a `Loader2` spinner state rendered when `isActive && !jobStatus`.

**Also improved:** Draft empty-state text bumped from near-invisible `text-text-muted` to `text-text-secondary`.

`File: ipreneur/frontend/src/pages/workspace/WorkspacePage.tsx`

---

### 7. Rebuilt Research Agent with live web search

**Problem:** The research agent had no external data sources — it asked Gemini to generate market data from memory, resulting in hallucinated or "Unavailable" values for TAM, competitors, and trends.

**Rebuild:** `research_agent.py` now:
- Runs **5 parallel DuckDuckGo searches** before calling Gemini:
  - Company revenue / funding / valuation
  - Industry market size (TAM) from reports
  - Named competitor analysis
  - Industry trends 2024-2025
  - Customer pain points
- Feeds all real search results into a structured Gemini synthesis prompt
- Returns enriched `ResearchData` with new fields: `pain_points`, `tam_sam_som`, `funding_info`, `recent_news`

`File: ipreneur/backend/app/agents/research/research_agent.py`

---

### 8. Rebuilt Content Agent — 14-slide industry-deep deck

**Problem:** Generic 12-slide prompt produced vague, data-free content disconnected from the actual research.

**Rebuild:** `content_agent.py` now:
- Generates **14 slides** (added Executive Summary, Go-to-Market)
- Each slide has an explicit **layout type**: `full_bleed`, `big_number`, `cards`, `two_column`, `timeline`, `title_bullets`
- All research data (TAM/SAM/SOM, named competitors, pain points, trends) is embedded in the prompt
- Bullets use bold lead-ins (`**Speed:** 10x faster than legacy tools`)
- Cards have `title`, `body`, and optional `metric` field
- `model_dump()` emits both new fields (`slide_type`, `layout`, `cards`, `columns`, `data_points`) and legacy fields (`type`, `content`, `id`) for frontend compatibility

`File: ipreneur/backend/app/agents/content/content_agent.py`

---

### 9. Rebuilt PPT Renderer — Gamma-style visual design

**Problem:** All slides rendered as flat text on a dark background with no visual hierarchy.

**Rebuild:** `renderer.py` now implements 6 layout types:

| Layout | Used for | Key visual |
|---|---|---|
| `full_bleed` | Cover, closing | Centered title, gradient bar top/bottom |
| `big_number` | Market, traction, financials | 3-4 bordered metric cards with large values |
| `cards` | Problem, solution, business model | Cards with colored top-accent bar per card |
| `two_column` | Competitive landscape, features | Two bordered panels with heading + bullets |
| `timeline` | Traction milestones, roadmap | Horizontal dots-on-line flow |
| `title_bullets` | Strategy, team, product | Two-column bullets with colored dot markers |

All slides: left accent bar, slide-type tag, title hierarchy, speaker notes preserved.
Bold text syntax (`**text**`) renders as styled runs in PPTX.

`File: ipreneur/backend/app/ppt/engine/renderer.py`

---

### 10. Rebuilt DeckPreview — rich interactive web preview

**Problem:** The preview showed a basic list of slide titles with truncated body text — no visual structure or layout context.

**Rebuild:** `DeckPreview.tsx` now:
- Renders each slide matching its `layout` type (cover, big-number cards, card grid, two-column, bullets)
- **Single slide view** with prev/next navigation and dot indicators
- **Grid view** toggle to browse all slides at once
- Bold text rendering (`**bold**` → `<strong>`)
- Speaker notes panel below active slide
- Metric cards with colored borders matching slide accent colors

`File: ipreneur/frontend/src/components/workspace/DeckPreview.tsx`

---

### Infrastructure note

The full stack runs via Docker Compose (`ipreneur/docker-compose.yml`):
- `ipreneur_backend` — FastAPI on port 8000 (volume-mounted, hot-reload)
- `ipreneur_worker` — Celery worker (Redis broker)
- `ipreneur_postgres` — PostgreSQL
- `ipreneur_redis` — Redis
- `ipreneur_minio` — MinIO object storage
- `ipreneur_frontend` — Vite dev server on port 3000 (also accessible 3001/3002)

Backend code changes take effect immediately via the volume mount + uvicorn `--reload`.
`.env` changes require `docker restart ipreneur_backend`.

---

## Session: 2026-05-21

### 11. Implemented full 6-layer AI architecture

**Objective:** Upgrade from a 3-step research→content pipeline to a proper investment-grade architecture matching the spec:
1. Website Intelligence Layer
2. External Research Layer (already done in session 1)
3. AI Analysis Layer (new)
4. Pitch Deck Generation Layer (enhanced)
5. Output Rules (confidence scores, no hallucinations)
6. System Optimization (modular agents)

---

### 12. New: AI Analysis Agent (Layer 3)

**File:** `ipreneur/backend/app/agents/analysis/analysis_agent.py`

New agent that synthesizes research into investor-grade analysis. Sits between research and content generation — the pitch writer draws from pre-synthesized investor logic rather than raw data.

**Outputs:**
- `positioning` — One sharp statement: "X is the [category] for [ICP] that [differentiator], unlike [incumbent]"
- `icp` — Full ICP profile: company size, vertical, job titles, primary pain, budget range, buying trigger
- `competitive_moat` — Defensible advantages analysis
- `market_opportunity` — TAM/SAM + "why now" argument
- `revenue_scenarios` — Conservative/Base/Optimistic Y1-Y3 ARR
- `scalability` — Unit economics and expansion vectors
- `gtm_strategy` — 4 specific channel tactics
- `swot` — Full SWOT matrix with evidence
- `investor_score` — 1-10 with summary, highlights, concerns
- `risk_factors` — Risk list with severity (high/medium/low) + mitigation
- `confidence` — Per-field confidence scores (0-100)

**Confidence scoring:**
- 85-100: Verified from website / multiple sources
- 65-84: Reasonably inferred
- 40-64: Estimated from industry norms
- 0-39: Speculative — flagged with "(estimated)"

**Prompt framing:** "You are a General Partner at Sequoia/a16z conducting due diligence."

---

### 13. Enhanced BrandingExtractor — Website Intelligence Layer

**File:** `ipreneur/backend/app/services/branding/extractor.py`

Added 5 new fields to `BrandingData`:
- `tech_stack: list[str]` — technologies detected from page (logos, "built with", job listings)
- `competitors_mentioned: list[str]` — companies mentioned in "vs", "alternative to", comparison pages
- `testimonials: list[dict]` — up to 3 real customer quotes with author + metric
- `pricing_model: dict` — model type, tiers, notes (annual discount, trial period)
- `business_model: str` — how they make money (SaaS, marketplace, transaction fee, freemium)

Updated Gemini extraction prompt with explicit rules for each new field:
- tech_stack: look for logos, "built with", "powered by", footer links
- competitors_mentioned: look for "vs", "alternative to", "unlike", "switch from"
- pricing_model.tiers: extract any price numbers or tier names
- testimonials: extract up to 3 with metrics if present
- Rule: "If no evidence on page, return [] or {} — do NOT invent data"

---

### 14. Pipeline updated — new analyzing step

**File:** `ipreneur/backend/app/api/v1/endpoints/projects.py`

Added `AnalysisAgent` as step 4 in the 7-step pipeline:

| Step | Progress | Status |
|---|---|---|
| crawling | 0→15% | unchanged |
| extracting | 15→30% | unchanged |
| researching | 30→50% | was 30→55% |
| **analyzing** | **50→65%** | **NEW** |
| generating | 65→80% | was 55→80% |
| rendering | 80→95% | unchanged |
| uploading | 95→100% | unchanged |

Analysis result is passed to `ContentGenerationAgent.generate(analysis=analysis_data)`.
Analysis is persisted embedded in `research_data["analysis"]` (no new DB column needed).

---

### 15. ContentGenerationAgent — analysis-enriched prompt

**File:** `ipreneur/backend/app/agents/content/content_agent.py`

`generate()` now accepts `analysis: Optional[AnalysisData] = None`.

When analysis is present, a full "INVESTOR ANALYSIS" block is injected into the Gemini prompt containing:
- Positioning statement
- Investor score + highlights + concerns
- Full ICP (who, company size, buyers, pain, budget, trigger)
- Competitive moat
- SWOT matrix
- GTM strategy (4 channels)
- Revenue scenarios (Y1-Y3)
- Top 3 risk factors with severity + mitigation

The model is instructed to use this for specific slides:
- ICP → slide 3 (problem/pain points)
- Positioning + moat → slide 10 (competitive landscape)
- Revenue scenarios → slide 12 (financials)
- GTM → slide 9 (go-to-market)
- SWOT strengths → slide 4 (solution)

Business model, tech stack, and pricing signals from the enhanced `BrandingData` are also injected.

---

### 16. Frontend — analyzing step added

**File:** `ipreneur/frontend/src/constants/index.ts`

Added `"analyzing"` between `"researching"` and `"generating"` in `JOB_STEP_ORDER`.
Added label: `"analyzing": "Analyzing investor potential"`.
Progress bar now shows 7 steps correctly aligned with backend pipeline.

---

## Session: 2026-05-21 (continued — end-to-end test & bug fixes)

### 17. New Gemini API key + full integration test

**Fix:** Replaced exhausted Gemini API key in `ipreneur/backend/.env`.
**Restart required:** `docker restart ipreneur_backend` (`.env` changes are not hot-reloaded).

**Test target:** `https://www.notion.so`  
**Result:** Full 7-step pipeline passing with real data:

| Step | Result |
|---|---|
| crawling | ✅ 3 pages, 20 images |
| extracting | ✅ Notion (SaaS) — business model, pricing model, tech stack |
| researching | ✅ $600B+ enterprise software market, 4 competitors, 4 trends |
| analyzing | ✅ score=7/10, 4 strengths, 4 risks |
| generating | ✅ 14 slides |
| rendering | ✅ 54,657 bytes PPTX |
| uploading | ✅ Pipeline complete |

---

### 18. Bug fix — JSON trailing commas in all agents

**Problem:** Gemini occasionally outputs trailing commas before `}` or `]` (e.g. `["item1", "item2",]`), which is valid JavaScript but invalid JSON. `json.loads()` raised `Expecting ',' delimiter` parse errors in the research, analysis, and content agents.

**Fix:** Added `re.sub(r",\s*([}\]])", r"\1", json_str)` before every `json.loads()` call in all three agents:
- `ipreneur/backend/app/agents/research/research_agent.py`
- `ipreneur/backend/app/agents/analysis/analysis_agent.py`
- `ipreneur/backend/app/agents/content/content_agent.py`

**Analysis agent extra:** Added `_repair_json()` method to also handle truncated output (closes unclosed braces/brackets if Gemini hits max token limit mid-response).

---

### 19. Bug fix — bullet_points returned as dicts by Gemini

**Problem:** Content agent prompt asks for `bullet_points: ["string", ...]` but Gemini occasionally returns objects: `[{"text": "**Bold:** description"}, ...]`. The PPTX renderer called `re.sub()` on the dict, crashing with `TypeError: expected string or bytes-like object, got 'dict'`.

**Traceback location:** `renderer.py:_bullet_row → _txt → re.sub` called with a `dict`.

**Fix:** Added module-level `_str()` normalizer in `content_agent.py`:
```python
def _str(v) -> str:
    if isinstance(v, dict):
        return v.get("text") or v.get("content") or v.get("value") or str(v)
    return str(v) if v is not None else ""
```

Applied to all string fields during slide parsing: `title`, `subtitle`, `body`, `speaker_notes`, and every item in `bullet_points`. This makes the content agent resilient to Gemini returning objects where plain strings are expected.

**File:** `ipreneur/backend/app/agents/content/content_agent.py`

---

## Session: 2026-05-25

### 20. Verified local auth + deck generation flow

**Objective:** Confirm the end-to-end local UI auth flow and pitch deck generation using the running frontend and backend.

**Results:**
- Local auth `/api/v1/auth/register` and `/api/v1/auth/login` were validated.
- Frontend login using persisted local credentials succeeded.
- Created a new project from `/projects/new` for `https://www.zomato.com`.
- The generated project reached `Ready` status in-browser at `/projects/43c80248-9f67-4fde-9635-bd54152cb576`.
- UI showed the deck preview, `Edit Deck`, and `Export PPTX` controls.

**Notes:**
- This confirms the local stack is functional for protected user flows and project generation.
- Next step is exporting the PPTX and validating the final presentation artifact.

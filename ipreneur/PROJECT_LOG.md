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

---

## Session: 2026-08-19

**Architecture note:** the pipeline described in Sessions 1–2 above (Celery worker,
MinIO, a separate Research/Analysis/Content agent chain, DuckDuckGo search) has
since been superseded. The live pipeline as of this session is: a single
`MasterDeckAgent` (two-pass Gemini call — research then generation, using
Gemini's own Google Search grounding instead of DuckDuckGo), running inline in
a background thread with its own event loop (no Celery), against **Supabase**
for both Postgres and file storage (no local Docker Postgres/MinIO required
for dev). `docker-compose.yml` still exists but is no longer the dev path.

---

### 21. Fixed "Future attached to a different loop" crash on every analysis run

**Problem:** `_run_analysis_inline` runs in a dedicated background thread with
its own asyncio event loop (not Celery). `WebCrawler.crawl()` was looking up
the project's URL via `get_db_context()`, which binds to the **main** uvicorn
event loop's DB engine — awaiting that connection from a different loop threw
`RuntimeError: Future ... attached to a different loop` on essentially every
generation attempt.

**Fix:** Changed `WebCrawler.crawl()` to use `get_background_db_context()`
(creates a loop-scoped engine) instead. `File: ipreneur/backend/app/services/crawler/web_crawler.py`

---

### 22. Fixed "Parsed deck JSON has no slides" — Gemini thinking-budget misconfiguration

**Problem:** `.env` had `GEMINI_THINKING_BUDGET=8192` equal to
`GEMINI_MAX_TOKENS=8192`. For `gemini-2.5-flash`, thinking tokens count
against `maxOutputTokens` — with the budgets equal, the model spent the
entire token budget "thinking" and returned an empty/truncated response, so
the deck JSON had no `slides` key.

**Fix:** `GEMINI_MAX_TOKENS` → 32768, `GEMINI_THINKING_BUDGET` → 2048 (both in
`.env` and the stale `.env.example`, which had the same landmine for any
fresh setup). Also bumped the Python-level default in `config.py` from 8192
→ 16384 as a safety net.

---

### 23. No-website intake flow — decks for idea-stage companies

**Objective:** Let a founder with no live website yet generate a deck from a
structured questionnaire instead of a crawled URL.

**Built:**
- `NewProjectPage.tsx`: new "I don't have a website yet" toggle reveals
  required fields (problem statement, solution description, target customer,
  a repeatable founders list) plus optional traction/competitor notes.
- Backend: `company_url` made nullable end-to-end (`ProjectCreate`, `Project`
  model + one-time `ALTER TABLE` against Supabase); `_run_analysis_inline`
  skips crawling when no URL is present (previously silently crawled
  `https://example.com` as a fallback — removed).
- `master_agent.py`: fixed a live `NameError` in `_research_pass`'s call to
  `_team_search` (`company_name` was never defined in scope) — was firing on
  every company web search couldn't find, silently degrading research to
  `{}`. Manually-entered founders now take priority over web-search results
  for the Team slide (search on a generic company name easily returns an
  unrelated company's founders — self-reported data is more trustworthy here).
- Prompt: added a "founder-provided company description" block that replaces
  the crawled-website section when there's no URL.

`Files: frontend/src/pages/workspace/NewProjectPage.tsx, backend/app/schemas/project.py, backend/app/models/models.py, backend/app/api/v1/endpoints/projects.py, backend/app/agents/master/master_agent.py`

---

### 24. Fixed silent textarea validation failure (Input.tsx)

**Problem:** The shared `Input` component's `multiline` (textarea) mode never
forwarded React Hook Form's `ref` — only the plain `<input>` branch did.
Typed text updated the DOM but never reached RHF's tracked form values, so
required-textarea validation (problem/solution statement above) always
reported empty, blocking submission no matter what was typed. `multiline` had
never been exercised anywhere in the codebase before this session.

**Fix:** Forward `ref` to both the `<input>` and `<textarea>` branches.
`File: frontend/src/components/ui/Input.tsx`

---

### 25. Wired real file storage to Supabase Storage

**Problem:** Generated `.pptx` files were always landing on local disk
regardless of any S3/MinIO config — root cause was `boto3` never being
installed (not even listed in `requirements.txt`), so every upload attempt
hit `ModuleNotFoundError`, caught by a broad `except`, silently falling back
to local save.

**Fix:** Installed `boto3` (added to `requirements.txt`), pointed `.env`'s S3
config at Supabase Storage's S3-compatible endpoint, and flipped the `decks`
bucket's `public` flag directly in `storage.buckets` (the S3 protocol can't
set that itself). Also fixed the `/presentations/{id}/download` fallback
path, which parsed the storage object key out of `file_url` by splitting on
`/storage/` — worked for old local paths, broke on real Supabase URLs (which
contain `/storage/` earlier in the path for an unrelated reason); now derives
the key directly from the known `{project_id}/presentation.pptx` convention.

Verified end-to-end with a real generation run — confirmed public download,
correct byte size, correct content-type.

---

### 26. Migrated pre-Supabase local data

**Found:** A leftover `ipreneur.db` SQLite file from before the Supabase
migration, holding 1 orphaned user account and 1 incomplete project ("nvest",
movate.com — had hit the exact bug from #22). Migrated the project into the
current Supabase account (status set to `error` with an explanatory message,
so "Retry Analysis" regenerates it cleanly now that the underlying bug is
fixed).

---

### 27. Pitch deck quality upgrade — Phase 1 (renderer + prompt)

**Objective:** The AI already generates a rich `template_data` payload (KPI
highlights, real market/traction numbers, a competitor matrix, founder bios)
for the 10-theme web preview — but the actual downloadable `.pptx`
(`PPTRenderer`, python-pptx) only ever read the flatter `slides[]` payload,
silently discarding all of that.

**Built:**
- `template_data` now flows into `PPTRenderer.render()` (new
  `template_schema.py`: pydantic validation per-section, so one malformed
  section degrades one slide instead of breaking the deck).
- Real native charts replace decorative fakes: TAM/SAM/SOM was 3 overlapping
  ovals with **hardcoded** ring sizes that didn't scale with the real
  numbers — now a real, correctly-scaled bar chart. Added a traction column
  chart and an ask-allocation doughnut chart (both previously absent), and a
  real competitor comparison table (previously generic cards).
- Brand colors now actually apply (the `branding` param was accepted by
  `render()` but never read before).
- Per-theme title fonts (body text stays on the proven Calibri baseline).
- Fixed logo distortion (now aspect-correct) and a silent SVG-logo failure
  (python-pptx can't embed SVG; now decodes via Pillow or logs why it's
  skipped, instead of failing silently).
- Deleted `theme_engine.py`/`slide_factory.py` — an abandoned earlier
  renderer attempt, unused, still had literal `# TODO` stubs in it.
- Added a "specificity rule" to the generation prompt targeting generic,
  swappable-company AI-deck language, reinforced on the Product/Business-
  Model/Market slides specifically.

Verified with real Gemini generations + direct XML inspection of the output
files (chart types, table structure, brand-color contrast, font names).

`Primary file: backend/app/ppt/engine/renderer.py` (+ `themes.py`, `template_schema.py` new, `master_agent.py`)

---

### 28. Inline deck text editing — `/projects/:id/editor` is no longer a stub

**Objective:** Let a founder click into any slide's title/bullets/KPI
numbers and fix them directly, then save — no layout/image/theme changes.
(`EditorPage.tsx` had been a stub since the very first commit to this repo —
confirmed via git log — and was explicitly listed as a TODO in this log's
own Session 2026-05-20 entry, never revisited until now.)

**Built:**
- `TemplatedDeck.tsx`'s ~13 slide-builder functions now accept an `EditCtx`
  (default no-op, so every existing caller — theme thumbnails, PPTX export —
  is unaffected). Editable text renders as a clickable marker; a portaled
  floating `<input>`/`<textarea>` (new `FloatingTextEditor.tsx`) positions
  itself over the real on-screen glyph and edits at a legible fixed size
  regardless of the (often heavily scaled-down) preview zoom.
- The traction chart's on-chart numbers (SVG `<text>`, not plain DOM text)
  get the same treatment via `<tspan>` + `getScreenCTM()`/`getBBox()`
  coordinate math — no separate interaction pattern needed for the one
  trickier slide.
- New `setByPath.ts` — immutable path-based updates to the local edit draft.
- Backend: `ProjectUpdate.template_data` + a two-level merge in
  `update_project` (preserves `deck_content.slides`; a section that fails
  re-validation on save keeps its last-known-good value instead of
  vanishing, since the frontend renderer mostly doesn't guard against a
  missing section). The existing `/download` endpoint already re-renders
  from `deck_content` on every call — saved edits show up in PPTX downloads
  with no further changes needed there.

`Files (new): frontend/src/components/workspace/deckTemplates/editing/{editableText,FloatingTextEditor,setByPath}, frontend/src/pages/editor/EditorPage.tsx`
`Files (changed): TemplatedDeck.tsx, TemplatedDeckSection.tsx, services/api/projects.ts, backend/app/schemas/project.py, backend/app/api/v1/endpoints/projects.py`

**Not yet verified in a live browser** (no browser automation tool available
this session) — TypeScript compiles clean, backend merge logic tested
directly against real DB rows, but the interactive click → edit → save flow
itself still needs a hands-on pass.

---

### 29. Fixed multiline paragraph fields breaking in the inline editor

**Problem:** `FloatingTextEditor` (built in #28) had full `<textarea>` support,
but no `editableText()` call site anywhere in `TemplatedDeck.tsx` ever passed
`{ multiline: true }` — so every field, including 3-line paragraphs like the
executive summary lead, rendered as a single-line `<input>`. Combined with an
auto `.select()` on focus, clicking into a paragraph showed a broken,
horizontally-scrolled fragment of the text instead of the full wrapped block.

**Fix:**
- `FloatingTextEditor.tsx` now auto-detects multiline from the marker's own
  measured height (`rect.height > fontSize × 1.6` ⇒ wrapped text), so any
  field that visually wraps gets a `<textarea>` automatically, independent of
  whether a call site remembered to flag it.
- Multiline sizing now matches the source render instead of guessing: width
  hugs the original wrapped column (no growth-room padding, which would
  re-wrap text at different points than the real deck), and line-height is
  copied from the field's own computed style rather than a constant.
- Select-all-on-focus is now skipped for multiline fields (still used for
  short ones) — clicking into a paragraph no longer risks wiping it on the
  next keystroke.
- Explicitly flagged the 16 known-paragraph fields (summary lead,
  problem/solution body + footer text, subtitles across
  product/probsol/roadmap/gallery/ask/closing, model stream/tier
  descriptions, market note, team bios/advisors, roadmap item descriptions)
  with `multiline: true` directly, so they get a textarea from the first
  click even while their current generated content is still short.
- Follow-up: removed the native `resize: vertical` drag-handle from
  multiline fields — it showed up as a small, unexplained grip icon inside
  the text (e.g. after a wrapped headline), which read as a UI glitch and
  broke the "no visible chrome" editing feel from #28. `minHeight` is already
  sized from the real measured block, so manual resize wasn't needed; native
  textarea scrolling still handles typed text that grows past it.

`File: frontend/src/components/workspace/deckTemplates/editing/FloatingTextEditor.tsx`
(+ 16 call-site flags in `TemplatedDeck.tsx`)

# iPreneur · AI Pitch Deck Studio

> Transform any company URL into an investor-grade pitch deck in minutes.

## What It Does

iPreneur is an AI-powered SaaS platform that:
1. **Crawls** your company website (Playwright BFS crawler, up to 50 pages)
2. **Researches** your market, competitors, and positioning via parallel AI agents
3. **Analyzes** your business with a full SWOT, investor score, and revenue scenarios
4. **Generates** a complete investor-grade pitch deck narrative
5. **Renders** a professionally designed PPTX presentation

## Monorepo Structure

```
ipreneur/
├── frontend/          # React + TypeScript + Vite SPA
├── backend/           # Python FastAPI + Celery workers
│   ├── app/agents/    # BrandingExtractor, ResearchAgent, AnalysisAgent
│   ├── app/services/  # Playwright BFS crawler, PPT renderer
│   ├── app/api/       # REST endpoints
│   └── app/workers/   # Celery task queue
├── infrastructure/    # Docker, Nginx configs
├── docs/              # Architecture, API, deployment docs
└── scripts/           # Setup, DB, and deploy automation
```

## Quick Start (Docker)

```powershell
# 1. Copy and fill in environment variables
cp backend/.env.example backend/.env

# 2. Build and start all services
docker-compose up -d

# 3. Check logs
docker-compose logs -f worker
```

App runs at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Rebuilding after dependency changes

If you update `requirements.txt` (especially `playwright`), always force a clean rebuild:

```powershell
docker-compose build --no-cache backend worker beat
docker-compose up -d
```

> **Important:** Playwright browser binaries are tied to the installed package version.
> An unpinned upgrade without `--no-cache` will cause a `BrowserType.launch` error at runtime.

## Local Development (without Docker)

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
playwright install chromium

uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Query |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| AI | Google Gemini 2.5 Flash (dual-key architecture) |
| Queue | Celery + Redis |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Storage | S3-compatible (MinIO for dev / AWS S3 for prod) |
| PPT Engine | python-pptx |
| Crawler | Playwright (async BFS) + BeautifulSoup4 |

## AI Pipeline

```
POST /api/v1/pipeline/generate  (company URL + optional metrics)
  ↓
Step 1: WebCrawler — Playwright BFS, up to crawl_max_pages
  ↓
Step 2: BrandingExtractor [Gemini Key 1]  +  ResearchAgent [Gemini Key 2]  ← parallel
  ↓
Step 3: AnalysisAgent [Gemini Key 1 + thinking_budget=8192]
  ↓
Returns: branding, research, analysis, crawl_summary  (~2.5 min end-to-end)
```

Two separate Gemini API keys are used to avoid rate limits during parallel agent execution.

## Design System

- **Background**: `#0A0716` (Obsidian)
- **Primary**: `#2540B5` → `#7B2CBF` (Electric Blue → Violet)
- **Font**: Inter (UI), JetBrains Mono (code)
- **Style**: Premium dark AI-native SaaS

## Development Phases

1. ✅ Project scaffolding & architecture
2. ✅ Frontend foundation & design system
3. ✅ Backend API + auth
4. ✅ Website analysis engine (Playwright BFS crawler)
5. ✅ AI agent orchestration (Branding + Research + Analysis pipeline)
6. 🔄 PPT generation system (python-pptx wiring in progress)
7. ⬜ Presentation editor
8. ⬜ Export pipeline
9. ⬜ Billing & settings
10. ⬜ Production deployment

## License

Proprietary — iPreneur Inc.

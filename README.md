# iPreneur · AI Pitch Deck Generator

> Transform any company URL into an investor-grade pitch deck in minutes.

iPreneur is an AI-powered SaaS platform that crawls a company's website, researches its
market and competitors, runs a full business analysis, and generates a professionally
designed PPTX pitch deck — end to end.

## How It Works

1. **Crawl** — a Playwright BFS crawler reads up to 50 pages of the company site
2. **Research** — parallel AI agents study the market, competitors, and positioning
3. **Analyze** — a full SWOT, investor score, and revenue scenarios are produced
4. **Generate** — a complete investor-grade pitch narrative is written
5. **Render** — a polished PPTX presentation is exported

## Repository Layout

```
pitch DEck/
├── ipreneur/          # The full application (see ipreneur/README.md for details)
│   ├── frontend/      # React + TypeScript + Vite SPA
│   ├── backend/       # Python FastAPI + Celery workers & AI agents
│   ├── infrastructure/# Docker, Nginx, k8s, Terraform configs
│   ├── docs/          # Architecture, API, and deployment docs
│   └── scripts/       # Setup, DB, and deploy automation
├── iPreneur-standalone.html   # Single-file standalone demo
└── docs & design assets       # Blueprint, project log, design handoff
```

## Getting Started

The application lives in [`ipreneur/`](ipreneur/). See
[`ipreneur/README.md`](ipreneur/README.md) for full setup instructions.

Quick start with Docker:

```powershell
cd ipreneur
cp backend/.env.example backend/.env   # fill in your API keys
docker-compose up -d
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI, Celery
- **AI:** Google Gemini (`gemini-2.5-flash`)
- **Infrastructure:** Docker, Nginx, Redis, PostgreSQL

## License

Proprietary — © Infopace Management Pvt. Ltd. All rights reserved.

# iPreneur Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                   │
│  React SPA (Vite + TS + Tailwind)                                    │
│  ├── Landing Page                                                    │
│  ├── Auth (Login/Register)                                           │
│  ├── Dashboard (Projects grid)                                       │
│  ├── Workspace (Analysis progress + Deck preview)                    │
│  ├── Editor (Slide-by-slide editing)                                 │
│  └── Settings / Billing                                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                        API LAYER                                      │
│  FastAPI (Python 3.11)                                               │
│  ├── /api/v1/auth        JWT auth endpoints                          │
│  ├── /api/v1/projects    CRUD + analysis trigger                     │
│  ├── /api/v1/decks       Slide content management                    │
│  ├── /api/v1/presentations  PPT download + status                   │
│  ├── /api/v1/billing     Stripe integration                          │
│  └── /api/v1/webhooks    Stripe webhooks                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼──────────┐               ┌──────────▼────────────┐
│   PostgreSQL 15  │               │      Redis 7           │
│   ─────────────  │               │      ─────────────     │
│   users          │               │      Cache (TTL)       │
│   projects       │               │      Celery broker     │
│   presentations  │               │      Task results      │
│   jobs           │               └───────────────────────┘
│   subscriptions  │
└──────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       WORKER LAYER (Celery)                          │
│                                                                      │
│  run_analysis_pipeline                                               │
│    │                                                                 │
│    ├── 1. WebCrawler (Playwright)                                    │
│    │       └── Crawls 5 pages, extracts text/images/colors          │
│    │                                                                 │
│    ├── 2. BrandingExtractor                                          │
│    │       └── Colors, logo, industry classification (Claude)        │
│    │                                                                 │
│    ├── 3. ResearchAgent (Claude)                                     │
│    │       └── Market size, competitors, trends                      │
│    │                                                                 │
│    ├── 4. ContentGenerationAgent (Claude)                           │
│    │       └── 12 slides generated in parallel                       │
│    │                                                                 │
│    ├── 5. PPTRenderer (python-pptx)                                 │
│    │       └── ThemeEngine + SlideFactory → .pptx bytes             │
│    │                                                                 │
│    └── 6. StorageClient (S3/MinIO)                                  │
│              └── Upload PPTX, return download URL                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                                  │
│   S3 / MinIO (file storage)                                          │
│   ├── presentations/{project_id}/presentation.pptx                  │
│   ├── presentations/{project_id}/thumbnail.png                      │
│   └── assets/{project_id}/logo.png                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## AI Workflow Detail

```
URL Input
   │
   ▼
WebCrawler
   ├── Playwright (headless Chromium)
   ├── 5 priority pages: /, /about, /product, /pricing, /features
   └── Output: CrawlResult {pages, text_summary, colors, images}
   │
   ▼
BrandingExtractor
   ├── Color dominance analysis from CSS
   ├── Company name from OG tags / title
   ├── Claude API → industry + tone classification
   └── Output: BrandingData {name, colors, industry, tone, tagline}
   │
   ▼
ResearchAgent (Claude)
   ├── System prompt: expert VC analyst
   ├── Input: company name, URL, industry, description
   ├── Output: ResearchOutput {market_size, competitors, trends, ...}
   └── Retry: 3 attempts with exponential backoff
   │
   ▼
ContentGenerationAgent (Claude)
   ├── Generates 12 slides in parallel (asyncio.gather)
   ├── Each slide: dedicated prompt + structured JSON response
   ├── Slides: cover, problem, solution, market, product, traction,
   │          business_model, go_to_market, competition, team,
   │          financials, ask
   └── Output: GeneratedDeckContent {slides, theme, metadata}
   │
   ▼
PPTRenderer (python-pptx)
   ├── ThemeEngine: brand colors, fonts, style
   ├── SlideFactory: 8 layout types
   ├── 16:9 widescreen (13.33" × 7.5")
   └── Output: bytes (.pptx)
   │
   ▼
StorageClient (S3)
   └── Public HTTPS URL for download
```

## Frontend State Management

```
Zustand stores:
  authStore     → user, token, login/logout
  projectStore  → project list, current project
  editorStore   → slide selection, edit state, undo/redo

React Query:
  ["projects"]               → list
  ["project", id]            → single with polling
  ["project-status", id]     → job progress polling
  ["deck", id]               → deck content
```

## Database Schema (key relationships)

```
User (1) ──────────────── (N) Project
Project (1) ────────────── (N) Job
Project (1) ────────────── (N) Presentation
User (1) ──────────────── (1) Subscription
```

## Security Model

- JWT access tokens (30 min expiry) + refresh tokens (30 days)
- All project endpoints scoped to current user (no cross-user access)
- Soft deletes on projects (recoverable)
- Row-level security via WHERE user_id = current_user.id
- S3 presigned URLs for file downloads (1 hour expiry in prod)

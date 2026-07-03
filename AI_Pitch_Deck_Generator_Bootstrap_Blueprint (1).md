# AI-Powered Pitch Deck Generator: Bootstrap Edition (Zero-API, Open-Source First)
## Complete Technical + Business Blueprint for Founders Building for Free

---

## EXECUTIVE SUMMARY

**The Reality**: You cannot compete with Gamma on scale. You *can* build a specialized pitch-deck generator in 6-8 weeks with *zero* API spend by:

1. **Using open-source LLMs locally** (Llama 2 7B, Mistral, DeepSeek locally via Ollama)
2. **DIY web scraping** (Playwright + Beautiful Soup, no third-party brand extraction)
3. **Native Python PPTX** generation with custom investor templates
4. **Single-player, self-hosted MVP** (no databases, no queues initially)
5. **Bootstrapped to $5k–10k MRR in 6 months**, then add APIs tactically

**The wedge**: Generate a **founder's first working pitch deck in 10 minutes** from a URL or company description. Ship imperfect-but-working before competitors ship perfect-but-slow.

---

## PART 1: COMPETITIVE LANDSCAPE (What You Can Learn Without APIs)

### Why This Wedge Exists
- **Gamma** ($100M ARR, 50 people): Great for 90-second generic decks; weak on brand accuracy and investor-grade structure
- **Beautiful.ai, Canva, Pitch.com**: $12–25/mo subscription models assume users will spend 2+ hours customizing. Your jam: generate in 90 seconds, let them customize if needed
- **The gap**: No tool today combines (1) free tier, (2) one-click generation from a URL, (3) editable PPTX output, (4) actual investor deck structure (10/20/30 rule)

### Your Unfair Advantage (First 6 Months)
- **You iterate faster** — no enterprise sales overhead
- **You can afford to fail on 80% of inputs** — Gamma cannot; you can ship imperfect
- **You own distribution** — Product Hunt, Twitter, founder Slack groups, HackerNews = free marketing
- **You stay lean** — $0 API spend = unit economics that work at 100 users or 100k users

---

## PART 2: THE FULL TECH STACK (100% Open-Source Core)

### Layer 1: Backend (Run Locally First, Then Docker)

```
Framework: FastAPI (Python 3.11+)
  - Async-first, auto-docs, Pydantic validation
  - Deploy: single VPS ($5/mo Hetzner / $7/mo DigitalOcean)
  
Why NOT Celery/Redis initially:
  - MVP: single threaded + queue jobs to SQLite
  - Worker: async/await inside FastAPI is free and good enough
  - Scaling: Add Celery+Redis only when you hit 100+ concurrent jobs/day
  
Initial DB: SQLite with WAL mode
  - Tables: users, decks, brand_kits, slide_contents
  - Migration: SQLAlchemy ORM + Alembic
  - Backup: Git-tracked JSON dumps nightly to GitHub (free!)
  
File storage: Local filesystem (cheaper than S3 until 10k decks)
  - /generated_decks/{user_id}/{deck_id}.pptx
  - Serve via CDN: Cloudflare (free tier, 100GB/mo)
```

### Layer 2: Web Scraping (100% DIY, No APIs)

```python
# Core scraping stack:
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import asyncio

# Key tools:
- Playwright: JS rendering (handles React, SPA, dynamic loading)
- Beautiful Soup 4: HTML parsing
- Requests-HTML: fallback for lightweight sites
- PyQuery: jQuery-like syntax for CSS extraction

# What we extract (no ML, pure regex + heuristics):
1. Page title → company name fallback
2. All <a href> + og:image → detect logo (largest image in header)
3. CSS color values (color:, background-color:) → dominant 3 colors
4. <h1>, <h2>, <p> text → company positioning/tagline
5. "About" page crawl → team size, founding year, mission statement
6. "Products" / "Pricing" pages → feature list
7. Footer emails, social links → contact info
8. robots.txt → respect and cache
```

### Layer 3: Brand Color Extraction (100% Local)

```python
# No ColorThief API calls — use Pillow directly
from PIL import Image
from collections import Counter

def extract_dominant_colors(image_path, num_colors=5):
    """
    Extract dominant colors from image using k-means clustering.
    Pure local implementation.
    """
    img = Image.open(image_path).convert('RGB')
    img.thumbnail((150, 150))  # Small for speed
    pixels = list(img.getdata())
    
    # Simple clustering: sort by frequency, deduplicate similar colors
    color_freq = Counter(pixels)
    
    # K-means clustering (simplified: just use PIL's quantize)
    quantized = img.quantize(colors=num_colors)
    palette = quantized.getpalette()
    
    colors = []
    for i in range(0, num_colors * 3, 3):
        r, g, b = palette[i], palette[i+1], palette[i+2]
        colors.append(f"#{r:02x}{g:02x}{b:02x}")
    
    return colors

# Use PIL's quantize() — built-in, zero dependencies beyond Pillow
```

### Layer 4: Local LLM (Llama 2 / Mistral, Zero API Spend)

```bash
# Install Ollama (free, open-source):
# Mac/Linux: curl https://ollama.ai/install.sh | sh
# Windows: Download from ollama.ai

# Pull models (one-time, ~10GB each):
ollama pull mistral           # 7B, fast, good quality
ollama pull llama2            # 7B, decent
ollama pull neural-chat       # Mistral-based, optimized for chat

# Start server (listens on localhost:11434):
ollama serve
```

```python
# Python client — use ollama package (pip install ollama)
import ollama
import json

def generate_slide_content(slide_type: str, company_data: dict) -> str:
    """
    Generate slide content using local Mistral 7B.
    Runs on CPU (slow) or GPU (fast if you have NVIDIA).
    """
    prompt = f"""
    Generate a professional pitch deck slide for a {slide_type}.
    
    Company: {company_data['name']}
    Industry: {company_data['industry']}
    Problem: {company_data['problem']}
    Solution: {company_data['solution']}
    
    Write ONLY the slide content (title + 3-4 bullet points).
    Output as JSON: {{"title": "...", "bullets": [...]}}
    """
    
    response = ollama.generate(
        model="mistral",
        prompt=prompt,
        stream=False
    )
    
    # Parse JSON from response
    return response["response"]

# Cost: $0
# Limitations: Slower than Claude (5-30 sec per slide vs 1-2 sec)
# Advantage: Runs on your laptop, no rate limits, no API keys
```

### Layer 5: PPTX Generation (python-pptx, 100% Local)

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

def create_investor_deck(company_data, brand_colors, output_path):
    """
    Generate a full investor pitch deck using python-pptx.
    No external rendering needed — pure python.
    """
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)
    
    # Define brand theme
    primary_color = RGBColor(*hex_to_rgb(brand_colors[0]))
    accent_color = RGBColor(*hex_to_rgb(brand_colors[1]))
    
    slides_config = [
        {"type": "title", "title": company_data["name"], "subtitle": company_data["tagline"]},
        {"type": "problem", "title": "Problem", "content": company_data["problem"]},
        {"type": "solution", "title": "Solution", "content": company_data["solution"]},
        {"type": "market", "title": "Market Size", "content": company_data["tam"]},
        {"type": "traction", "title": "Traction", "content": company_data["metrics"]},
        {"type": "team", "title": "Team", "content": company_data["team_bio"]},
        {"type": "ask", "title": "The Ask", "subtitle": company_data["fundraising_goal"]},
    ]
    
    for slide_config in slides_config:
        slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout
        
        # Add background color
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = RGBColor(250, 250, 250)
        
        # Add title
        title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(9), Inches(1))
        title_frame = title_box.text_frame
        title_frame.text = slide_config["title"]
        title_frame.paragraphs[0].font.size = Pt(54)
        title_frame.paragraphs[0].font.bold = True
        title_frame.paragraphs[0].font.color.rgb = primary_color
        
        # Add content
        content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(9), Inches(5))
        content_frame = content_box.text_frame
        content_frame.word_wrap = True
        
        if isinstance(slide_config["content"], list):
            for bullet in slide_config["content"]:
                p = content_frame.add_paragraph()
                p.text = bullet
                p.level = 0
                p.font.size = Pt(24)
        else:
            content_frame.text = slide_config["content"]
            content_frame.paragraphs[0].font.size = Pt(24)
        
        # Add footer with branding
        footer_box = slide.shapes.add_textbox(Inches(0.5), Inches(7), Inches(9), Inches(0.5))
        footer_frame = footer_box.text_frame
        footer_frame.text = company_data["name"]
        footer_frame.paragraphs[0].font.size = Pt(12)
        footer_frame.paragraphs[0].font.color.rgb = accent_color
    
    prs.save(output_path)
    print(f"Deck saved to {output_path}")

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
```

### Layer 6: Data Input Strategy (No Databases for MVP)

```python
# Option 1: JSON file per user (simplest)
import json
import os
from datetime import datetime

def save_deck_metadata(user_id: str, deck_data: dict):
    """Store deck metadata as JSON file."""
    user_dir = f"data/users/{user_id}"
    os.makedirs(user_dir, exist_ok=True)
    
    deck_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    metadata = {
        "deck_id": deck_id,
        "created_at": datetime.now().isoformat(),
        "company_name": deck_data["company_name"],
        "website_url": deck_data["website_url"],
        "brand_colors": deck_data["brand_colors"],
        "slide_contents": deck_data["slide_contents"],
    }
    
    with open(f"{user_dir}/{deck_id}_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    return deck_id

# Option 2: SQLite for production (still free, works great)
import sqlite3

def init_sqlite():
    conn = sqlite3.connect("decks.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT,
            created_at TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS decks (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            company_name TEXT,
            website_url TEXT,
            pptx_path TEXT,
            created_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    return conn
```

---

## PART 3: FULL WORKFLOW (Step-by-Step Implementation)

### Step 1: User Input (Web Form, Zero Complexity)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI()

class DeckRequest(BaseModel):
    company_name: str
    website_url: str
    industry: str
    problem: str
    solution: str
    founding_year: int = None
    team_size: int = None
    traction_metrics: list = None

@app.post("/generate-deck")
async def generate_deck(req: DeckRequest):
    """
    Main entry point: takes user input, orchestrates entire pipeline.
    Returns job_id for polling progress.
    """
    
    # Step 1: Validate URL
    if not req.website_url.startswith(("http://", "https://")):
        req.website_url = f"https://{req.website_url}"
    
    # Step 2: Scrape website for brand data
    brand_data = await scrape_website_for_branding(req.website_url)
    
    # Step 3: Generate slide content using local LLM
    slide_contents = await generate_all_slides(
        company_name=req.company_name,
        industry=req.industry,
        problem=req.problem,
        solution=req.solution,
        brand_data=brand_data,
    )
    
    # Step 4: Generate PPTX file
    deck_path = create_investor_deck(
        company_data={
            "name": req.company_name,
            "tagline": brand_data["tagline"],
            "problem": req.problem,
            "solution": req.solution,
            "tam": slide_contents["market"]["content"],
            "metrics": req.traction_metrics or ["TBD"],
            "team_bio": f"{req.team_size or '?'} person team",
            "fundraising_goal": "Series A: $2M",
        },
        brand_colors=brand_data["colors"],
        output_path=f"generated_decks/{req.company_name}_{datetime.now().timestamp()}.pptx"
    )
    
    return {
        "status": "success",
        "deck_url": f"/decks/{deck_path}",
        "company_name": req.company_name,
    }
```

### Step 2: Website Intelligence (DIY Scraping, No APIs)

```python
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import re

async def scrape_website_for_branding(url: str):
    """
    Scrape website and extract:
    - Company name, tagline, description
    - Logo (largest image in <header>)
    - Color palette (CSS color values)
    - Team size, founding year (heuristics)
    """
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        try:
            await page.goto(url, wait_until="networkidle")
            html = await page.content()
            screenshot_path = f"screenshots/{hashlib.md5(url.encode()).hexdigest()}.png"
            await page.screenshot(path=screenshot_path)
        except Exception as e:
            print(f"Navigation failed: {e}")
            return {"error": str(e)}
        
        await browser.close()
    
    # Parse HTML
    soup = BeautifulSoup(html, "html.parser")
    
    # Extract text content
    title = soup.title.string if soup.title else "Untitled"
    meta_description = soup.find("meta", {"name": "description"})
    description = meta_description.get("content", "") if meta_description else ""
    
    # Extract logo (heuristic: largest image in header)
    header = soup.find("header") or soup.find("nav") or soup.find("div", {"id": "navbar"})
    images = header.find_all("img") if header else []
    logo_url = images[0].get("src", "") if images else ""
    
    # Extract colors from inline styles
    colors = []
    for element in soup.find_all(style=True):
        style = element.get("style", "")
        hex_matches = re.findall(r"#[0-9a-fA-F]{6}", style)
        colors.extend(hex_matches)
    
    # Deduplicate and take top 3
    color_freq = Counter(colors)
    top_colors = [color for color, _ in color_freq.most_common(3)]
    
    # Default colors if none found
    if not top_colors:
        top_colors = ["#1f2937", "#3b82f6", "#ffffff"]
    
    # Extract team size / founding year (regex heuristics)
    text_body = " ".join([p.get_text() for p in soup.find_all("p")])
    
    team_match = re.search(r"(\d+)\s+(?:people|team members|employees)", text_body, re.IGNORECASE)
    team_size = int(team_match.group(1)) if team_match else None
    
    year_match = re.search(r"(?:Founded|founded)\s+(\d{4})", text_body)
    founding_year = int(year_match.group(1)) if year_match else None
    
    return {
        "title": title,
        "description": description,
        "logo_url": logo_url,
        "colors": top_colors,
        "tagline": description[:100] if description else "Building the future",
        "team_size": team_size,
        "founding_year": founding_year,
    }
```

### Step 3: Content Generation (Local LLM, No APIs)

```python
import ollama
import json
import re

async def generate_all_slides(
    company_name: str,
    industry: str,
    problem: str,
    solution: str,
    brand_data: dict,
):
    """
    Generate all 10/20/30 slides using local Mistral.
    Returns structured slide content.
    """
    
    slides = {}
    
    # Slide 1: Title (hand-written)
    slides["title"] = {
        "slide_type": "title",
        "title": company_name,
        "subtitle": brand_data["tagline"],
    }
    
    # Slide 2: Problem
    prompt = f"""
    Create a professional pitch deck slide about the PROBLEM.
    Company: {company_name}
    Industry: {industry}
    Problem statement: {problem}
    
    Format as JSON with:
    {{"title": "The Problem", "bullets": ["bullet 1", "bullet 2", "bullet 3"]}}
    """
    response = ollama.generate(model="mistral", prompt=prompt, stream=False)
    slides["problem"] = parse_slide_response(response["response"])
    
    # Slide 3: Solution
    prompt = f"""
    Create a professional pitch deck slide about the SOLUTION.
    Company: {company_name}
    Solution: {solution}
    
    Format as JSON with:
    {{"title": "Our Solution", "bullets": ["bullet 1", "bullet 2", "bullet 3"]}}
    """
    response = ollama.generate(model="mistral", prompt=prompt, stream=False)
    slides["solution"] = parse_slide_response(response["response"])
    
    # Slide 4: Market Size (TAM/SAM/SOM — use industry defaults)
    market_sizes = {
        "saas": "$100B+ enterprise software market",
        "fintech": "$300B+ financial services market",
        "healthcare": "$2T+ global healthcare market",
        "e-commerce": "$5T+ global retail market",
        "developer-tools": "$500B+ software development market",
    }
    market_size = market_sizes.get(industry.lower(), "$10B+ addressable market")
    
    slides["market"] = {
        "slide_type": "market",
        "title": "Market Size",
        "bullets": [market_size, "Growing 20%+ annually", "Fragmented, consolidation play"],
    }
    
    # Slide 5: Traction (user input or placeholder)
    slides["traction"] = {
        "slide_type": "traction",
        "title": "Traction",
        "bullets": ["0–100 early users", "Retention: 80%+ monthly", "NPS: 50+"],
    }
    
    # Slide 6: Business Model
    prompt = f"""
    Create a business model slide for a {industry} company.
    Revenue model: SaaS subscription @ $99–999/mo or usage-based.
    
    Format as JSON with:
    {{"title": "Business Model", "bullets": ["revenue stream 1", "revenue stream 2", "gross margin target"]}}
    """
    response = ollama.generate(model="mistral", prompt=prompt, stream=False)
    slides["business_model"] = parse_slide_response(response["response"])
    
    # Slide 7: Go-to-Market
    slides["go_to_market"] = {
        "slide_type": "go_to_market",
        "title": "Go-to-Market",
        "bullets": ["Founder-led sales to early customers", "Self-serve motion + support at scale", "Partnerships with ecosystem players"],
    }
    
    # Slide 8: Competition
    slides["competition"] = {
        "slide_type": "competition",
        "title": "Competitive Advantage",
        "bullets": ["Proprietary technology / 10x UX", "Early mover advantage + network effects", "Founding team domain expertise"],
    }
    
    # Slide 9: Team (placeholder — user should customize)
    slides["team"] = {
        "slide_type": "team",
        "title": "The Team",
        "bullets": [
            f"{brand_data.get('team_size', '?')} passionate builders",
            "Avg 10+ years experience in {industry}",
            "Ex-Stripe/Figma/YC founders",
        ],
    }
    
    # Slide 10: The Ask
    slides["ask"] = {
        "slide_type": "ask",
        "title": "The Ask",
        "bullets": ["Raising $2M Series A", "18-month runway, breakeven in 24 months", "Use of funds: team (60%), product (30%), go-to-market (10%)"],
    }
    
    return slides

def parse_slide_response(response_text: str):
    """
    Extract JSON from LLM response (LLMs often add extra text).
    """
    try:
        # Find JSON block in response
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            return json.loads(json_str)
    except:
        pass
    
    # Fallback: return empty structure
    return {"title": "Slide Title", "bullets": ["To be customized by user"]}
```

### Step 4: PPTX Generation (Already Covered in Layer 5 Above)

---

## PART 4: DEPLOYMENT (Bootstrap Edition)

### Option A: Single VPS ($5–10/mo)

```bash
# 1. Rent a VPS (Hetzner, DigitalOcean, Linode)
#    - 1 CPU, 2GB RAM, 20GB SSD = $5–7/mo
#    - OS: Ubuntu 22.04 LTS

# 2. Install dependencies
ssh root@your.vps.ip
apt update && apt upgrade
apt install python3.11 python3.11-venv git docker.io

# 3. Clone your repo and set up
git clone https://github.com/yourusername/pitch-deck-generator.git
cd pitch-deck-generator
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Install Ollama (LLM server)
curl https://ollama.ai/install.sh | sh
ollama pull mistral
nohup ollama serve > ollama.log 2>&1 &

# 5. Run FastAPI server
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &

# 6. Reverse proxy with Nginx
apt install nginx certbot python3-certbot-nginx
# Configure /etc/nginx/sites-available/default
# Point to FastAPI localhost:8000
# Run: certbot --nginx (free SSL via Let's Encrypt)
systemctl restart nginx

# 7. Backup data
0 2 * * * tar -czf /backups/decks_$(date +\%Y\%m\%d).tar.gz ~/pitch-deck-generator/data/
```

### Option B: Docker + Free Tier Cloud (Google Cloud Run, Railway, Fly.io)

```dockerfile
# Dockerfile
FROM python:3.11-slim

RUN apt update && apt install -y git curl build-essential

# Install Ollama (builds inside container or use external service)
RUN curl https://ollama.ai/install.sh | sh

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["ollama", "serve", "&", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Better approach for free cloud**: Run Ollama on your local laptop, expose API via Cloudflare Tunnel, connect FastAPI from cloud to your local Ollama.

```bash
# On your laptop:
ollama serve  # listens on localhost:11434

# In another terminal:
pip install cloudflare-tunnel
cloudflare-tunnel --url http://localhost:11434
# Get public URL: https://xyz.trycloudflare.com

# In FastAPI on cloud (Railway, Heroku free tier):
# OLLAMA_URL=https://xyz.trycloudflare.com
# Connect to external Ollama service
```

### Option C: GitHub Pages + Serverless (Vercel, Netlify)

Frontend (React/Vue) hosted free on Vercel. Backend runs on your laptop (free) or cheap VPS.

```bash
# Frontend: Vercel (free tier)
npm create vite@latest pitch-deck-ui -- --template react
cd pitch-deck-ui
npm install
vercel deploy

# Backend: Your laptop or $5 VPS
# Expose via Cloudflare Tunnel (free)
cloudflare-tunnel --url http://localhost:8000
```

---

## PART 5: THE LAUNCH PATH (First $5k MRR in 6 Months)

### Month 1: MVP (Free, Open-Source, Single-Player)
- **Scope**: URL input → Scrape brand → Generate 7 slides (fixed templates) → Download PPTX
- **Time**: 2–3 weeks of solo dev
- **Deploy**: VPS or Vercel + your laptop as backend
- **Launch**: Product Hunt, Twitter, Hacker News

### Month 2: Feedback Loop & Iterate
- **Scope**: Add 3–5 more slide types, user customization (edit slides in-browser before download), landing page
- **Iterate on**: Which slide types do users actually use? What's broken?
- **Metric**: Track with plausible deniability (Google Analytics is free; Plausible is $9/mo — skip)

### Month 3: Auth + Free Tier
- **Scope**: Sign up with email (no payment), track deck generation count, limit free tier to 2 decks/mo
- **Auth**: Clerk free tier (up to 1k monthly active users)
- **DB upgrade**: SQLite → Postgres (Supabase free tier: 500MB, 2 concurrent connections)

### Month 4: Paid Tier + Stripe
- **Pricing**:
  - Free: 2 decks/mo (watermark)
  - Starter $9/mo: 10 decks, no watermark
  - Pro $29/mo: 50 decks + custom brand colors
- **Payments**: Stripe free, pay per transaction ($0.30 + 2.9%)
- **Payment processing**: Lemon Squeezy or Stripe (Stripe docs are better)

### Month 5: Acquisition
- **Channels**:
  - Twitter/LinkedIn: 1 founder story per week with "raised $X with this deck" social proof
  - Email: Build a 1k-person list of Product Hunt followers interested in pitch decks
  - Communities: Post in YC founder Slack, Indie Hackers, Nomad List, Twitter spaces
  - SEO: Blog posts on "[YC pitch deck structure]", "[how to raise Series A]"
- **CAC goal**: <$20 (viral coefficient + organic)

### Month 6: Consolidate & Plan Next
- **Target**: 500–1k users, 50–200 paid
- **Revenue**: $200–1k MRR (if 3% freemium→paid conversion at $20 ARPU)
- **Next**: Hire 1 part-time contractor; build integrations (Slack bot, email, Google Slides export)

---

## PART 6: THE UNIT ECONOMICS (Bootstrap Reality)

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Signups | 100 | 800 | 5,000 |
| Free users | 100 | 750 | 4,500 |
| Paid users | 0 | 50 | 500–1,000 |
| ARPU | — | $5 | $10–15 |
| MRR | $0 | $250 | $5,000–10,000 |
| Server costs | $0 | $15 | $50–100 |
| Stripe fees | $0 | $7 | $150–300 |
| Dev time | 160 hrs | 40 hrs/mo | 20 hrs/mo |
| **Gross margin** | — | 95% | 95% |

**Key assumption**: 3% freemium→paid conversion, $20 ARPU. If you hit 5%, you're at $10k MRR by month 6.

---

## PART 7: WHEN TO ADD PAID APIs (Only If Needed)

### DO NOT buy these in Month 1–3:
- ❌ Brandfetch API ($500+/mo)
- ❌ Brave/Tavily search ($5k+/mo for high volume)
- ❌ Claude/GPT-4 API ($0.003–$0.03 per deck)
- ❌ Redis Cloud, AWS Lambda, DataDog

### DO consider these only when:

**Exa search API** ($5/1k searches):
- *When*: If 50%+ of your generated decks have bad market size data
- *How*: Add a "Research TAM" checkbox; user clicks it → you call Exa → update the deck
- *Cost*: $5/1k = $0.005 per search; if 10% of users click it = $0.0005/deck

**Claude Haiku API** ($0.003 input, $0.015 output):
- *When*: Local Llama 7B quality is objectively worse than you need (after user feedback)
- *How*: Route only the hardest slide types (market analysis, competitive positioning) to Claude; keep templates for others
- *Cost*: ~$0.02 per hard slide; if 20% of decks use it = $0.004/deck

**Supabase for Postgres**:
- *When*: SQLite hit limits (100+ concurrent writes) or you need backups
- *How*: Start free tier, upgrade to paid ($25/mo) only when you hit 50k stored decks
- *Cost*: $25/mo covers 500GB storage

**Stripe (already free**) vs Lemon Squeezy:
- Stripe: $0.30 + 2.9% per transaction (industry standard)
- Lemon Squeezy: 5% flat (simpler for bootstrapped, no chargebacks worry)

---

## PART 8: OPEN-SOURCE STACK (Full Procurement Guide)

```
RUNTIME:
  FastAPI (Python web framework) — https://fastapi.tiangolo.com — MIT
  Uvicorn (ASGI server) — https://www.uvicorn.org — BSD
  Python 3.11+ — python.org — PSF
  
WEB SCRAPING:
  Playwright (browser automation) — https://playwright.dev — Apache 2.0
  Beautiful Soup 4 (HTML parser) — https://www.crummy.com/software/BeautifulSoup — MIT
  Requests (HTTP library) — https://requests.readthedocs.io — Apache 2.0
  
IMAGE/COLOR:
  Pillow (PIL, image processing) — https://pillow.readthedocs.io — HPND (BSD-like)
  
LLM (LOCAL):
  Ollama (LLM runtime) — https://ollama.ai — MIT
  Mistral 7B (model) — https://mistral.ai — Apache 2.0
  Llama 2 (model) — https://huggingface.co/meta-llama — Community license
  
PPTX GENERATION:
  python-pptx (PPTX library) — https://github.com/scanny/python-pptx — MIT
  
FRONTEND:
  React (UI framework) — https://react.dev — MIT
  Vite (build tool) — https://vitejs.dev — MIT
  Tailwind CSS (utility CSS) — https://tailwindcss.com — MIT
  
DATABASE:
  SQLite (local, free) — https://sqlite.org — Public domain
  Postgres (production, free tier via Supabase) — https://postgresql.org — PostgreSQL License
  
AUTH:
  Clerk (free tier: 1k MAU) — https://clerk.com — Commercial but free tier
  Or: Simple JWT + SQLite email verification
  
DEPLOYMENT:
  Docker (containerization) — https://docker.com — Apache 2.0
  Nginx (reverse proxy) — https://nginx.org — BSD
  Let's Encrypt (SSL certs) — https://letsencrypt.org — Apache 2.0
  Cloudflare Tunnel (expose local services) — https://developers.cloudflare.com — Free
  
ANALYTICS (FREE):
  Plausible (privacy-friendly) — $9/mo (or self-host)
  Simple Google Analytics — Free, basic, no privacy claims
  
PAYMENT:
  Stripe (payment processor) — https://stripe.com — Commercial
  Lemon Squeezy (SaaS-specific, simpler) — https://lemonsqueezy.com — Commercial
```

---

## PART 9: LEGAL / IP (Bootstrap Reality)

### Scraping Legal Considerations
- ✅ **Do**: Respect robots.txt, rate-limit to 1–2 req/sec, cache results
- ✅ **Do**: Use canonical user-agent and contact email in headers
- ⚠️ **Gray**: Extracting logo/colors from public homepage (precedent: Google Images, Brandfetch do this)
- ❌ **Don't**: Scrape proprietary data (private APIs, login-required pages)

**Practical advice**: Start with scraping only the public homepage. If a user complains, it's their own website — they can opt out by adding `X-Robots-Tag: noai` to their homepage header.

### Terms of Service Template
```markdown
# Terms of Service

1. User-Generated Decks
   - You own the content you generate (text input).
   - We own the software and output format (PPTX template).
   - You can use your deck commercially; we can use anonymized analytics.

2. Brand Data
   - We scrape your website's public homepage.
   - If you don't want this, email us or add a robots.txt rule.

3. API Usage
   - Free tier: 2 decks/month
   - Paid tier: Up to 50 decks/month
   - Abuse = account termination without refund.

4. Liability
   - We provide AS-IS; not responsible for deck accuracy.
   - You should fact-check before pitching investors.
```

---

## PART 10: METRICS TO TRACK (Google Sheets for Free)

Create a simple Google Sheet:

```
| Date | Signups | Free Users | Paid Users | MRR | LTV | CAC | Deck Gen/Day | Avg Deck Quality (1-5) |
|------|---------|-----------|-----------|-----|-----|-----|------------|---------------------|
| 2024-01 | 50 | 50 | 0 | $0 | — | — | 5 | 3.2 |
| 2024-02 | 150 | 140 | 10 | $100 | $600 | $25 | 25 | 3.5 |
```

**Google Forms** for user feedback (1 question: "Rate the deck quality 1–5"; free).

---

## PART 11: FAILURE MODES & MITIGATIONS

| Failure | Risk | Mitigation |
|---------|------|-----------|
| Playwright breaks on new website structure | High | Add fallback to requests-html; manual regex scraping |
| Mistral 7B produces nonsense slides | Medium | Template-based output with sentence length limits; human review for paid tiers |
| PPTX rendering breaks in PowerPoint | Medium | Test on Windows + Mac Office; rely on python-pptx's stability |
| User data loss (crashed VPS) | High | Daily JSON backups to GitHub + weekly SQL dumps to S3 (free tier) |
| Stripe webhook failure | Medium | Re-poll Stripe API for subscription status; log all webhooks to Postgres |
| Scaling: Ollama server becomes bottleneck | Medium | Queue slides for batch processing at off-peak hours; upgrade to quantized 4-bit model |
| Competitors raise $10M and undercut you | High | Lock in early adopters with network effects (share decks, team templates); pivot to white-label/API |

---

## PART 12: THE FINANCIAL REALITY (Be Honest)

**Initial setup cost (you doing all the work):**
- Dev time: 160 hours (8 weeks × 20 hrs/week) = **Your opportunity cost**
- VPS: $7/mo × 6 = $42
- Domain: $12/year
- **Total hard cost: $54 + your time**

**6-month revenue forecast (realistic, not optimistic):**
- Best case: 1,000 free users → 30 paid at $20 ARPU → **$600 MRR**
- Base case: 500 free users → 15 paid → **$300 MRR**
- Worst case: 200 free users → 5 paid → **$100 MRR**

**6-month gross profit:**
- Best case: $600 MRR × 6 months - $300 operating costs = **$3,300**
- Base case: $300 × 6 - $300 = **$1,500**
- Worst case: $100 × 6 - $300 = **-$100** (you lose money)

**Why this is actually good**:
1. You're learning (priceless)
2. You're not burning VC capital (no dilution)
3. You're proving PMF before hiring (sustainable)
4. Your unit economics are 90%+ margin (unlike Gamma, which spends $X on compute)

---

## FINAL CHECKLIST (Ship in 4 Weeks)

### Week 1: MVP Skeleton
- [ ] FastAPI server running locally
- [ ] HTML form: company_name, website_url, problem, solution
- [ ] Playwright script to scrape website
- [ ] Ollama running on your machine; Mistral model pulled

### Week 2: Core Pipeline
- [ ] Playwright → extract colors, logo, tagline
- [ ] Mistral → generate slide content (test locally)
- [ ] python-pptx → create 7-slide deck

### Week 3: End-to-End Flow
- [ ] Form input → Scrape → Generate → Download PPTX (works!)
- [ ] Test on 5 real websites (Figma, Stripe, Linear, etc.)
- [ ] Bug fixes + UX polish

### Week 4: Ship
- [ ] Deploy to VPS or Vercel
- [ ] Create landing page (1 page, no fluff)
- [ ] Post on Product Hunt, HackerNews, Twitter
- [ ] Email 50 founder friends

---

## WHAT NOT TO DO

- ❌ Build perfect UI first (ship buggy, iterate fast)
- ❌ Spend 4 weeks on branding (default is fine)
- ❌ Hire someone before you have product-market fit
- ❌ Use expensive cloud services (VPS works)
- ❌ Obsess over legal (terms of service can be 1 page)
- ❌ Build features nobody asked for (don't—validate in production)

---

## SUCCESS METRICS (What Matters in Month 1)

1. **Can a user generate a deck in <5 minutes?** (if no: ship faster, cut scope)
2. **Do they download the PPTX?** (if no: UX is broken)
3. **Would they pay $9/mo?** (ask in exit survey; target 5+ "hell yes" in first 50 users)
4. **Is the PPTX editable in PowerPoint?** (if no: this is a blocker, fix immediately)

If you nail these 4, you have product-market fit. Then optimize pricing/features.

---

## APPENDIX: Code Templates for Quick Copy-Paste

### A. requirements.txt (Minimal)
```
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
playwright==1.40.0
beautifulsoup4==4.12.2
pillow==10.1.0
requests==2.31.0
ollama==0.1.0  # Python client for local Ollama
python-pptx==0.6.21
sqlalchemy==2.0.23
python-multipart==0.0.6
```

### B. main.py (Skeleton)
```python
from fastapi import FastAPI, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
import asyncio
from datetime import datetime

app = FastAPI()

class DeckRequest(BaseModel):
    company_name: str
    website_url: str
    industry: str
    problem: str
    solution: str

@app.post("/generate-deck")
async def generate_deck(req: DeckRequest):
    # 1. Scrape
    brand_data = await scrape_website_for_branding(req.website_url)
    
    # 2. Generate
    slide_contents = await generate_all_slides(
        company_name=req.company_name,
        industry=req.industry,
        problem=req.problem,
        solution=req.solution,
        brand_data=brand_data,
    )
    
    # 3. Create PPTX
    deck_path = create_investor_deck(
        company_data={
            "name": req.company_name,
            "tagline": brand_data["tagline"],
            "problem": req.problem,
            "solution": req.solution,
        },
        brand_colors=brand_data["colors"],
        output_path=f"generated_decks/{req.company_name}_{datetime.now().timestamp()}.pptx"
    )
    
    return {"deck_url": f"/decks/{deck_path}", "company_name": req.company_name}

@app.get("/decks/{deck_name}")
async def download_deck(deck_name: str):
    return FileResponse(f"generated_decks/{deck_name}", media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## THE BOTTOM LINE

**You can launch a working pitch deck generator in 4 weeks for $0 in API costs.**

The wedge is: free + fast + editable. Not perfect — just working. Then iterate based on user feedback. Every day you delay to perfect it, Gamma gets $274k richer (their revenue = $100M/365 days).

Ship imperfect. Iterate fast. Charge early. Raise money only after PMF.

Good luck. You've got this. 🚀

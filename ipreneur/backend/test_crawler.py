"""Crawl a website and dump all extracted information to a file."""
import asyncio
import json
import sys
from pathlib import Path
from app.services.crawler.web_crawler import WebCrawler

# Force UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main():
    url = "https://linear.app"
    crawler = WebCrawler(timeout_ms=25000, max_pages=30)
    result = await crawler.crawl_url(url)

    # ── Console summary ────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Base URL       : {result.base_url}")
    print(f"Pages crawled  : {result.pages_crawled}")
    print(f"Images         : {len(result.all_images)}")
    print(f"Colors         : {len(result.all_colors)}")
    print(f"Pricing signals: {len(result.pricing_info)}")
    print(f"Team signals   : {len(result.team_info)}")

    print(f"\n── Pages ─────────────────────────────────────────────────")
    for p in result.pages:
        print(f"  {p.url}")
        if p.title:
            print(f"    Title      : {p.title}")
        if p.description:
            print(f"    Desc       : {p.description[:120]}")
        if p.headings:
            print(f"    Headings   : {p.headings[:3]}")

    print(f"\n── Pricing Signals ───────────────────────────────────────")
    for s in result.pricing_info:
        print(f"  {s[:100]}")

    print(f"\n── Team / People ─────────────────────────────────────────")
    for t in result.team_info:
        print(f"  {t[:120]}")

    print(f"\n── Brand Colors ──────────────────────────────────────────")
    print(f"  {result.all_colors}")

    print(f"\n── Images (first 20) ─────────────────────────────────────")
    for img in result.all_images[:20]:
        print(f"  {img}")

    # ── Save full output to JSON ───────────────────────────────────────────────
    output = {
        "base_url": result.base_url,
        "pages_crawled": result.pages_crawled,
        "all_colors": result.all_colors,
        "all_images": result.all_images,
        "pricing_info": result.pricing_info,
        "team_info": result.team_info,
        "discovered_urls": result.discovered_urls,
        "pages": [
            {
                "url": p.url,
                "title": p.title,
                "description": p.description,
                "headings": p.headings,
                "text_content": p.text_content,
                "images": p.images,
                "colors_from_css": p.colors_from_css,
                "pricing_signals": p.pricing_signals,
                "team_mentions": p.team_mentions,
                "structured_data": p.structured_data,
            }
            for p in result.pages
        ],
        "text_summary": result.text_summary,
    }

    out_path = Path("crawl_output.json")
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ Full data saved to: {out_path.resolve()}")


asyncio.run(main())

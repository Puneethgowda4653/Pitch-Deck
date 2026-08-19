"""
ImageService — fetches company logo and relevant slide background photos.

Logo: downloaded from the URL extracted by the web crawler.
Backgrounds: Unsplash Source API (no key needed) — returns a relevant photo
             for a given keyword (e.g. "quick commerce india", "food delivery").
"""
import io
import asyncio
from typing import Optional

import httpx
from loguru import logger


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# Slide type → Unsplash search keyword
SLIDE_KEYWORDS: dict[str, str] = {
    "cover":               "{industry} technology startup",
    "closing":             "future city technology",
    "market_opportunity":  "market growth business",
    "problem":             "challenge problem solving",
    "solution":            "innovation technology solution",
    "traction":            "growth success startup",
    "team":                "professional team office",
    "financials":          "finance investment growth",
}


def normalize_logo(raw: bytes) -> Optional[bytes]:
    """Decode arbitrary fetched image bytes via Pillow and re-encode as PNG,
    so the renderer always receives a format python-pptx can actually embed.
    Notably, python-pptx CANNOT embed SVG — logos fetched as SVG (common for
    modern startups) previously failed silently (bare `except: pass` at the
    picture-add call site). Returns None for formats Pillow can't decode, with
    a logged reason instead of a silent failure."""
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        return raw  # Pillow not installed — pass through, let pptx try/fail as before
    try:
        with Image.open(io.BytesIO(raw)) as img:
            buf = io.BytesIO()
            img.convert("RGBA").save(buf, format="PNG")
            return buf.getvalue()
    except UnidentifiedImageError:
        logger.warning("Logo bytes not a Pillow-decodable raster format (likely SVG) — skipping logo")
        return None
    except Exception as exc:
        logger.warning(f"Logo normalize failed: {exc}")
        return None


async def fetch_image_bytes(url: str, timeout: int = 8) -> Optional[bytes]:
    """Download an image URL and return raw bytes. Returns None on failure."""
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=timeout,
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                ct = resp.headers.get("content-type", "")
                if "image" in ct or url.lower().endswith((".png", ".jpg", ".jpeg", ".svg", ".webp")):
                    return resp.content
    except Exception as exc:
        logger.debug(f"Image fetch failed {url[:60]}: {exc}")
    return None


async def fetch_unsplash_background(keyword: str, width: int = 1920, height: int = 1080) -> Optional[bytes]:
    """
    Fetch a relevant background photo from Unsplash Source API.
    No API key needed — returns a random photo matching the keyword.
    """
    url = f"https://source.unsplash.com/{width}x{height}/?{keyword.replace(' ', ',')}"
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=10,
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and "image" in resp.headers.get("content-type", ""):
                logger.debug(f"Unsplash photo fetched for '{keyword}' ({len(resp.content):,} bytes)")
                return resp.content
    except Exception as exc:
        logger.debug(f"Unsplash fetch failed for '{keyword}': {exc}")
    return None


async def fetch_slide_backgrounds(
    slide_types: list[str],
    industry: str,
    company_name: str,
) -> dict[str, Optional[bytes]]:
    """
    Fetch background photos for all slides that benefit from one.
    Returns {slide_type: image_bytes or None}.
    Only fetches for slides that have a keyword mapping.
    """
    tasks = []
    slide_type_list = []
    
    for slide_type in slide_types:
        if slide_type in SLIDE_KEYWORDS:
            keyword_template = SLIDE_KEYWORDS[slide_type]
            keyword = keyword_template.replace("{industry}", industry or "technology")
            tasks.append(fetch_unsplash_background(keyword))
            slide_type_list.append(slide_type)

    results = {}
    if tasks:
        task_results = await asyncio.gather(*tasks, return_exceptions=True)
        for slide_type, result in zip(slide_type_list, task_results):
            if isinstance(result, Exception):
                results[slide_type] = None
            else:
                results[slide_type] = result
    
    fetched = sum(1 for v in results.values() if v)
    logger.info(f"📸 Slide backgrounds: {fetched}/{len(results)} fetched")
    return results

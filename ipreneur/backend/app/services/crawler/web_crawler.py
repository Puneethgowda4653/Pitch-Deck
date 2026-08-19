"""
Web Crawler v3 — Full-site BFS crawler (Playwright edition).

Strategy:
  1. Seed the queue from sitemap.xml + homepage links
  2. Pop the highest-priority URL, crawl it, extract all its links → enqueue
  3. Repeat until queue empty or max_pages reached (default 100)
  4. Per page: title, description, headings, body text, images, CSS colors,
     JSON-LD, pricing signals, team mentions
  5. Build a rich CrawlResult with a detailed text summary for AI consumption

Uses Playwright (headless Chromium) to fully render JavaScript before parsing
with BeautifulSoup4 — works on React/Next.js/Vue SPAs.
"""
import asyncio
import concurrent.futures
import heapq
import json
import re
import sys
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse, urljoin, urldefrag

from bs4 import BeautifulSoup
from loguru import logger
from playwright.async_api import async_playwright, Browser


# ── Priority scoring — higher = more important to crawl first ─────────────────
_PATH_SCORES: list[tuple[int, list[str]]] = [
    (100, ["/"]),
    # People pages are the #1 source of accurate team data — crawl them early & always.
    (95,  ["/team", "/leadership", "/our-team", "/founders", "/people", "/management",
           "/board", "/directors", "/our-people", "/who-we-are", "/team-members"]),
    (90,  ["/about", "/about-us", "/company", "/story"]),
    (85,  ["/product", "/products", "/features", "/platform", "/solution", "/solutions"]),
    (80,  ["/pricing", "/plans", "/price"]),
    (70,  ["/customers", "/case-studies", "/testimonials", "/success-stories"]),
    (60,  ["/how-it-works", "/why-us", "/use-cases", "/integrations"]),
    (55,  ["/contact", "/contact-us", "/careers"]),
    (50,  ["/blog", "/news", "/press", "/resources"]),
    (40,  ["/demo", "/get-started", "/signup", "/sign-up"]),
]

_PARALLEL_PAGES = 4   # concurrent browser pages
_CATEGORY_CAP = 5     # max pages crawled per scoring category
_SKIP_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
    ".pdf", ".zip", ".gz", ".tar",
    ".js", ".css", ".xml", ".json", ".rss", ".atom",
    ".mp4", ".mp3", ".avi", ".mov", ".woff", ".woff2", ".ttf",
}


def _score_path(path: str) -> tuple[int, str]:
    """Return (priority_score, category_key) for a URL path."""
    # Strip locale prefix like /in/, /us/, /gb/, /en/, /fr/ etc.
    p = re.sub(r"^/[a-z]{2}(-[a-z]{2})?/", "/", path.lower()).rstrip("/") or "/"
    for score, patterns in _PATH_SCORES:
        for pattern in patterns:
            if p == pattern:
                return score, pattern
            if p.startswith(pattern + "/"):
                depth_below = p[len(pattern):].count("/")
                return max(5, score - depth_below * 10), pattern
    depth = p.count("/")
    return max(1, 10 - depth * 2), "__other__"


def _normalize_url(url: str) -> str:
    """Normalize URL: strip fragment, trailing slash (except root), empty query."""
    p = urlparse(url)
    path = p.path if p.path else "/"
    # Collapse trailing slash on non-root paths
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    # Drop empty query strings like ?
    query = p.query if p.query else ""
    from urllib.parse import urlunparse
    return urlunparse((p.scheme, p.netloc, path, p.params, query, ""))


def _is_crawlable(url: str, domain: str) -> bool:
    """Return True if this URL should be added to the crawl queue."""
    try:
        p = urlparse(url)
    except Exception:
        return False
    if p.netloc != domain:
        return False
    path = p.path.lower()
    if any(path.endswith(ext) for ext in _SKIP_EXTENSIONS):
        return False
    # Skip auth / admin / API / tracking paths
    skip_prefixes = ("/api/", "/auth/", "/admin/", "/cdn-cgi/", "/_next/", "/static/")
    if any(path.startswith(pf) for pf in skip_prefixes):
        return False
    return True


@dataclass
class PageData:
    url: str
    title: str
    description: str
    headings: list[str]
    text_content: str
    structured_data: list[dict]
    images: list[str]
    links: list[str]          # internal links discovered on this page
    colors_from_css: list[str]
    pricing_signals: list[str]
    team_mentions: list[str]


@dataclass
class CrawlResult:
    base_url: str
    pages_crawled: int = 0
    pages: list[PageData] = field(default_factory=list)
    text_summary: str = ""
    all_images: list[str] = field(default_factory=list)
    all_colors: list[str] = field(default_factory=list)
    sitemap_urls: list[str] = field(default_factory=list)
    discovered_urls: list[str] = field(default_factory=list)
    pricing_info: list[str] = field(default_factory=list)
    team_info: list[str] = field(default_factory=list)


class WebCrawler:
    """
    Full-site BFS crawler using Playwright (headless Chromium) + BeautifulSoup4.
    Discovers and crawls the entire website by following links from every page.
    """

    def __init__(self, timeout_ms: int = 30000, max_pages: int = 100):
        self.timeout_ms = timeout_ms
        self.max_pages = max_pages

    # ── Public entry points ────────────────────────────────────────────────────

    async def crawl(self, project_id: str) -> CrawlResult:
        from app.db.session import get_background_db_context
        from app.models.models import Project

        async with get_background_db_context() as db:
            project = await db.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")
            url = project.company_url

        return await self.crawl_url(url)

    async def crawl_url(self, url: str) -> CrawlResult:
        """BFS crawl entry point. On Windows, uvicorn runs a WindowsSelectorEventLoop
        which cannot spawn the subprocesses Playwright needs. We side-step this by
        running the entire crawl in a thread with an explicitly-created ProactorEventLoop."""
        if sys.platform == "win32":
            def _run_in_proactor() -> CrawlResult:
                loop = asyncio.ProactorEventLoop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(self._crawl_url_impl(url))
                finally:
                    loop.close()
                    asyncio.set_event_loop(None)

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return await asyncio.get_event_loop().run_in_executor(pool, _run_in_proactor)
        return await self._crawl_url_impl(url)

    async def _crawl_url_impl(self, url: str) -> CrawlResult:
        """BFS crawl — follows links from every crawled page."""
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        domain = parsed.netloc
        logger.info(f"🕷️  Starting full-site crawl: {base_url} (max {self.max_pages} pages, {_PARALLEL_PAGES} parallel)")

        result = CrawlResult(base_url=base_url)

        # Priority queue: entries are (-score, url) so highest score pops first
        pq: list[tuple[int, str]] = []
        visited: set[str] = set()
        category_counts: dict[str, int] = {}

        queued: set[str] = set()  # tracks what's already in the heap

        def enqueue(u: str) -> None:
            clean, _ = urldefrag(u)
            if not clean:
                return
            clean = _normalize_url(clean)
            if clean in visited or clean in queued:
                return
            if not _is_crawlable(clean, domain):
                return
            score, _ = _score_path(urlparse(clean).path)
            queued.add(clean)
            heapq.heappush(pq, (-score, clean))

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                # Seed: sitemap + homepage links run in parallel
                logger.info("  Seeding queue from sitemap + homepage ...")
                sitemap_urls, homepage_links = await asyncio.gather(
                    self._try_sitemaps(browser, base_url),
                    self._extract_page_links(browser, base_url, domain)
                )

                result.sitemap_urls = sitemap_urls
                enqueue(base_url)
                for u in sitemap_urls:
                    enqueue(u)
                for u in homepage_links:
                    enqueue(u)

                logger.info(f"  Queue seeded with {len(pq)} URLs")

                # BFS in batches of _PARALLEL_PAGES
                while pq and result.pages_crawled < self.max_pages:
                    # Dequeue next batch — skip visited and category-capped URLs
                    batch: list[str] = []
                    while pq and len(batch) < _PARALLEL_PAGES:
                        _, u = heapq.heappop(pq)
                        if u in visited:
                            continue
                        _, cat = _score_path(urlparse(u).path)
                        if category_counts.get(cat, 0) >= _CATEGORY_CAP:
                            continue  # cap reached for this category
                        visited.add(u)
                        batch.append(u)

                    if not batch:
                        break

                    remaining = self.max_pages - result.pages_crawled
                    batch = batch[:remaining]

                    # Crawl batch in parallel
                    crawl_results = await asyncio.gather(
                        *[self._crawl_page(browser, u) for u in batch],
                        return_exceptions=True,
                    )

                    for page_url, page_data in zip(batch, crawl_results):
                        if isinstance(page_data, Exception):
                            logger.warning(f"  ✗ {page_url}: {page_data}")
                            continue
                        if not page_data:
                            continue

                        _, cat = _score_path(urlparse(page_url).path)
                        category_counts[cat] = category_counts.get(cat, 0) + 1

                        result.pages.append(page_data)
                        result.all_images.extend(page_data.images)
                        result.all_colors.extend(page_data.colors_from_css)
                        result.pricing_info.extend(page_data.pricing_signals)
                        result.team_info.extend(page_data.team_mentions)
                        result.pages_crawled += 1
                        logger.debug(
                            f"  ✓ [{result.pages_crawled}/{self.max_pages}] "
                            f"{page_url} ({len(page_data.text_content)} chars, "
                            f"+{len(page_data.links)} links)"
                        )

                        # Enqueue links discovered on this page
                        for link in page_data.links:
                            enqueue(link)

                result.discovered_urls = list(visited)

            finally:
                await browser.close()

        # Deduplicate aggregated data
        result.all_images = list(dict.fromkeys(result.all_images))[:100]
        result.all_colors = list(dict.fromkeys(result.all_colors))[:40]
        result.pricing_info = list(dict.fromkeys(result.pricing_info))[:30]
        result.team_info = list(dict.fromkeys(result.team_info))[:50]

        result.text_summary = self._build_text_summary(result)

        logger.info(
            f"✅ Crawl complete | pages={result.pages_crawled} | "
            f"images={len(result.all_images)} | colors={len(result.all_colors)} | "
            f"pricing={len(result.pricing_info)} | team={len(result.team_info)}"
        )
        return result

    # ── Sitemap ────────────────────────────────────────────────────────────────

    async def _try_sitemaps(self, browser: Browser, base_url: str) -> list[str]:
        found: list[str] = []
        candidates = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml"]

        for path in candidates:
            page = await browser.new_page()
            try:
                response = await page.goto(
                    urljoin(base_url, path), timeout=8000, wait_until="domcontentloaded"
                )
                if response and response.status == 200:
                    content_type = response.headers.get("content-type", "")
                    if "xml" in content_type:
                        text = await response.text()
                        found.extend(self._parse_sitemap(text))
                        logger.debug(f"  Sitemap at {path}: {len(found)} URLs")
                        break
            except Exception:
                pass
            finally:
                if not page.is_closed():
                    await page.close()

        return found[:500]

    def _parse_sitemap(self, xml_text: str) -> list[str]:
        return re.findall(r"<loc>\s*(https?://[^<]+)\s*</loc>", xml_text)

    # ── Link extraction (used for seeding from homepage) ──────────────────────

    async def _extract_page_links(self, browser: Browser, url: str, domain: str) -> list[str]:
        """Fetch a page with Playwright and return all internal links."""
        links: list[str] = []
        page = await browser.new_page()
        try:
            response = await page.goto(url, timeout=15000, wait_until="domcontentloaded")
            if response and response.status < 400:
                await page.wait_for_timeout(1000)
                html = await page.content()
                links = self._extract_links_from_html(html, url, domain)
        except Exception as exc:
            logger.debug(f"Link extraction failed {url}: {exc}")
        finally:
            if not page.is_closed():
                await page.close()
        return links

    def _extract_links_from_html(self, html: str, base_url: str, domain: str) -> list[str]:
        soup = BeautifulSoup(html, "lxml")
        links: list[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            full = urljoin(base_url, href)
            clean, _ = urldefrag(full)
            if _is_crawlable(clean, domain):
                links.append(clean)
        return list(dict.fromkeys(links))

    # ── Page crawling ──────────────────────────────────────────────────────────

    async def _crawl_page(self, browser: Browser, url: str) -> Optional[PageData]:
        page = await browser.new_page()
        domain = urlparse(url).netloc
        try:
            try:
                response = await page.goto(url, timeout=self.timeout_ms, wait_until="load")
                if not response:
                    logger.debug(f"  No response: {url}")
                    return None
                if response.status >= 400:
                    logger.debug(f"  HTTP {response.status}: {url}")
                    return None
                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type:
                    logger.debug(f"  Non-HTML ({content_type}): {url}")
                    return None
                await page.wait_for_timeout(800)
            except Exception as exc:
                logger.warning(f"  ✗ page.goto {url}: {exc}")
                return None

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            return PageData(
                url=url,
                title=self._extract_title(soup),
                description=self._extract_description(soup),
                headings=self._extract_headings(soup),
                text_content=self._extract_text(soup),
                structured_data=self._extract_json_ld(soup),
                images=self._extract_images(soup, url),
                links=self._extract_links_from_html(html, url, domain),
                colors_from_css=self._extract_colors(html),
                pricing_signals=self._extract_pricing_signals(soup, html),
                team_mentions=self._extract_team_mentions(soup),
            )
        finally:
            if not page.is_closed():
                await page.close()

    # ── Extractors ─────────────────────────────────────────────────────────────

    def _extract_title(self, soup: BeautifulSoup) -> str:
        for sel in [{"property": "og:title"}, {"name": "twitter:title"}]:
            m = soup.find("meta", sel)
            if m and m.get("content"):
                return m["content"].strip()[:200]
        t = soup.find("title")
        return t.get_text(strip=True)[:200] if t else ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        for sel in [{"property": "og:description"}, {"name": "description"}, {"name": "twitter:description"}]:
            m = soup.find("meta", sel)
            if m and m.get("content"):
                return m["content"].strip()[:600]
        return ""

    def _extract_headings(self, soup: BeautifulSoup) -> list[str]:
        headings = []
        for tag in soup.find_all(["h1", "h2", "h3"]):
            text = tag.get_text(separator=" ", strip=True)
            if text and 3 < len(text) < 200:
                headings.append(f"[{tag.name.upper()}] {text}")
        return headings[:40]

    def _extract_text(self, soup: BeautifulSoup) -> str:
        for tag in soup(["script", "style", "nav", "footer", "noscript", "iframe", "svg"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        text = re.sub(r"\s{2,}", " ", text).strip()
        return text[:6000]

    def _extract_json_ld(self, soup: BeautifulSoup) -> list[dict]:
        results = []
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, dict):
                    results.append(data)
                elif isinstance(data, list):
                    results.extend(data)
            except Exception:
                pass
        return results[:5]

    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        imgs = []
        for img in soup.find_all("img", src=True):
            src = img["src"]
            if src.startswith("data:"):
                continue
            if not src.startswith("http"):
                src = urljoin(base_url, src)
            imgs.append(src)
        return imgs[:20]

    def _extract_colors(self, html: str) -> list[str]:
        colors = re.findall(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", html)
        return [f"#{c}" for c in list(dict.fromkeys(colors))][:25]

    def _extract_pricing_signals(self, soup: BeautifulSoup, html: str) -> list[str]:
        signals = []
        price_pattern = re.compile(
            r"\$\d[\d,]*(?:\.\d+)?(?:\s*/?(?:mo(?:nth)?|yr|year|user|seat|month))?",
            re.IGNORECASE,
        )
        for m in price_pattern.finditer(html):
            s = m.group().strip()
            if s not in signals:
                signals.append(s)
        for el in soup.find_all(class_=re.compile(r"plan|tier|pricing", re.I)):
            text = el.get_text(separator=" ", strip=True)
            if 5 < len(text) < 200:
                signals.append(text[:200])
        return list(dict.fromkeys(signals))[:15]

    def _extract_team_mentions(self, soup: BeautifulSoup) -> list[str]:
        mentions: list[str] = []

        # 1. Schema.org Person JSON-LD — most reliable structured source
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                data = json.loads(script.string or "")
                nodes = data if isinstance(data, list) else [data]
                for node in nodes:
                    if isinstance(node, dict) and node.get("@type") == "Person":
                        name = node.get("name", "").strip()
                        role = (node.get("jobTitle") or node.get("description") or "").strip()
                        if name:
                            mentions.append(f"{name} — {role}" if role else name)
                    # Also handle @graph arrays
                    for item in node.get("@graph", []) if isinstance(node, dict) else []:
                        if isinstance(item, dict) and item.get("@type") == "Person":
                            name = item.get("name", "").strip()
                            role = (item.get("jobTitle") or "").strip()
                            if name:
                                mentions.append(f"{name} — {role}" if role else name)
            except Exception:
                pass

        # 2. Structured name+role card patterns in the DOM
        # Look for team section containers first, then extract name+role sibling pairs
        team_containers = soup.find_all(
            ["section", "div", "article"],
            class_=re.compile(r"\b(team|people|founders?|leadership|members?|about-us)\b", re.I),
        )
        for container in team_containers:
            # Each card typically has a heading (name) + nearby p/span (role)
            for name_el in container.find_all(["h2", "h3", "h4", "h5", "strong"]):
                name = name_el.get_text(strip=True)
                if not (3 < len(name) < 70):
                    continue
                # Skip generic section headings
                if re.search(r"\b(team|our|meet|about|people|join|leadership)\b", name, re.I):
                    continue
                # Look for a nearby role element (sibling or child of parent)
                role = ""
                parent = name_el.parent
                for candidate in parent.find_all(["p", "span", "small", "em"], limit=5):
                    t = candidate.get_text(strip=True)
                    if 3 < len(t) < 80 and t != name:
                        role = t
                        break
                if not role:
                    # Try next sibling
                    sib = name_el.find_next_sibling()
                    if sib:
                        t = sib.get_text(strip=True)
                        if 3 < len(t) < 80:
                            role = t
                entry = f"{name} — {role}" if role else name
                if entry not in mentions:
                    mentions.append(entry)

        # 3. Elements with explicit role-class attributes as fallback
        for el in soup.find_all(attrs={"class": re.compile(r"\b(person|founder|member|employee)\b", re.I)}):
            text = el.get_text(separator=" | ", strip=True)
            if 5 < len(text) < 200 and text not in mentions:
                mentions.append(text[:200])

        return list(dict.fromkeys(mentions))[:30]

    # ── Text Summary Builder ───────────────────────────────────────────────────

    def _build_text_summary(self, result: CrawlResult) -> str:
        """Build a rich, structured text summary for AI consumption."""
        parts: list[str] = []

        # Lead with team/people signals so real names survive the prompt's char cap.
        if result.team_info:
            parts.append("=== TEAM / PEOPLE SIGNALS (names found on site) ===\n" + "\n".join(result.team_info[:25]))

        for page in result.pages:
            section_parts = [f"=== PAGE: {page.url} ==="]
            if page.title:
                section_parts.append(f"Title: {page.title}")
            if page.description:
                section_parts.append(f"Meta description: {page.description}")
            if page.headings:
                section_parts.append("Headings:\n" + "\n".join(page.headings[:15]))
            if page.structured_data:
                for ld in page.structured_data[:2]:
                    ld_type = ld.get("@type", "")
                    if ld_type in ("Organization", "Product", "SoftwareApplication", "WebSite", "Person"):
                        section_parts.append(f"Schema.org [{ld_type}]: {json.dumps(ld, default=str)[:500]}")
            if page.text_content:
                section_parts.append(f"Content:\n{page.text_content[:3000]}")
            parts.append("\n".join(section_parts))

        if result.pricing_info:
            parts.append("=== PRICING SIGNALS ACROSS SITE ===\n" + "\n".join(result.pricing_info[:15]))

        return "\n\n" + ("-" * 60) + "\n\n".join(parts)

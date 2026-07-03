import asyncio, sys
sys.path.insert(0, ".")
from app.services.crawler.web_crawler import WebCrawler

async def test():
    crawler = WebCrawler(timeout_ms=20000, max_pages=5)
    result = await crawler.crawl_url("https://stripe.com")
    print(f"Pages crawled: {result.pages_crawled}")
    print(f"Discovered URLs: {len(result.discovered_urls)}")
    print(f"Pricing signals: {result.pricing_info[:3]}")
    print(f"Colors: {result.all_colors[:5]}")
    print(f"Summary length: {len(result.text_summary)} chars")
    print("First 500 chars of summary:")
    print(result.text_summary[:500])

asyncio.run(test())

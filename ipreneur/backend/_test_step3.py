import asyncio, sys, os
sys.path.insert(0, ".")
os.environ["GEMINI_API_KEY"] = "AIzaSyBk5xevd5Hx3oOKfRgEOYduMdXSlUf-7jM"
os.environ["GEMINI_API_KEY_2"] = "AIzaSyAZTs-NytCOptkXHrMtFgGasYtdsgc1ZeQ"
os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"
os.environ["GEMINI_MAX_TOKENS"] = "8192"
os.environ["GEMINI_THINKING_BUDGET"] = "8192"

from app.services.crawler.web_crawler import WebCrawler
from app.services.branding.extractor import BrandingExtractor

async def test():
    crawler = WebCrawler(timeout_ms=20000, max_pages=4)
    crawl = await crawler.crawl_url("https://stripe.com")
    print(f"Crawled {crawl.pages_crawled} pages")
    
    extractor = BrandingExtractor()
    branding = await extractor.extract(crawl)
    print(f"Company: {branding.company_name}")
    print(f"Industry: {branding.industry}")
    print(f"Tagline: {branding.tagline}")
    print(f"Description: {branding.description[:200]}")
    print(f"Products: {branding.key_products[:4]}")
    print(f"Business model: {branding.business_model}")
    print(f"Primary color: {branding.primary_color}")

asyncio.run(test())

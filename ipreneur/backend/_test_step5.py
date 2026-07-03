import asyncio, sys, os
sys.path.insert(0, ".")
os.environ["GEMINI_API_KEY"] = "AIzaSyBk5xevd5Hx3oOKfRgEOYduMdXSlUf-7jM"
os.environ["GEMINI_API_KEY_2"] = "AIzaSyAZTs-NytCOptkXHrMtFgGasYtdsgc1ZeQ"
os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"
os.environ["GEMINI_MAX_TOKENS"] = "8192"
os.environ["GEMINI_THINKING_BUDGET"] = "8192"

from app.services.crawler.web_crawler import CrawlResult
from app.services.branding.extractor import BrandingData
from app.agents.research.research_agent import ResearchData
from app.agents.analysis.analysis_agent import AnalysisAgent

async def test():
    branding = BrandingData(
        company_name="Stripe",
        industry="FinTech / Payments",
        tagline="Financial infrastructure for the internet",
        description="Stripe is a technology company that builds economic infrastructure for the internet.",
        target_audience="Businesses and developers",
        key_products=["Stripe Payments", "Stripe Connect", "Stripe Billing", "Stripe Radar"],
        business_model="Transaction fee (2.9% + 30c) + SaaS subscriptions",
    )
    research = ResearchData(
        market_size="$2.2T global payments volume (2024)",
        market_growth="14.5% CAGR 2024-2030",
        target_market="Online businesses processing payments ($180B SAM)",
        competitors=[
            {"name": "PayPal", "description": "Legacy payments player", "strength": "Brand recognition", "weakness": "High fees, poor developer experience"},
            {"name": "Adyen", "description": "Enterprise payments platform", "strength": "Global coverage", "weakness": "Complex integration"},
        ],
        industry_trends=["Buy Now Pay Later growth", "Embedded finance expansion", "Real-time payments adoption"],
        pain_points=["Payment fraud costing $48B annually", "Cross-border payment complexity", "Poor checkout conversion rates"],
        tam_sam_som={"tam": {"value": "$2.2T", "description": "Global payment volume"}, "sam": {"value": "$180B", "description": "Online merchant payments"}, "som": {"value": "$5B", "description": "3-year target"}}
    )
    crawl = CrawlResult(base_url="https://stripe.com", pages_crawled=3, text_summary="Stripe is the financial infrastructure platform...")

    agent = AnalysisAgent()
    analysis = await agent.run(branding=branding, research=research, crawl=crawl)
    print(f"Positioning: {analysis.positioning}")
    print(f"Investor score: {analysis.investor_score.score}/10")
    print(f"Score summary: {analysis.investor_score.summary}")
    print(f"ICP: {analysis.icp.description}")
    print(f"Competitive moat: {analysis.competitive_moat[:200]}")
    print(f"GTM ({len(analysis.gtm_strategy)} channels): {analysis.gtm_strategy[:2]}")
    print(f"Revenue scenarios: {analysis.revenue_scenarios}")

asyncio.run(test())

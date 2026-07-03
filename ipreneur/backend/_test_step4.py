import asyncio, sys, os
sys.path.insert(0, ".")
os.environ["GEMINI_API_KEY"] = "AIzaSyBk5xevd5Hx3oOKfRgEOYduMdXSlUf-7jM"
os.environ["GEMINI_API_KEY_2"] = "AIzaSyAZTs-NytCOptkXHrMtFgGasYtdsgc1ZeQ"
os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"
os.environ["GEMINI_MAX_TOKENS"] = "8192"
os.environ["GEMINI_THINKING_BUDGET"] = "8192"

from app.agents.research.research_agent import ResearchAgent

async def test():
    agent = ResearchAgent()
    result = await agent.run(
        company_name="Stripe",
        company_url="https://stripe.com",
        industry="FinTech / Payments",
        description="Stripe is a financial infrastructure platform for businesses. Millions of companies use Stripe to accept payments, send payouts, and manage their businesses online."
    )
    print(f"Market size: {result.market_size}")
    print(f"Growth: {result.market_growth}")
    print(f"Target market: {result.target_market}")
    print(f"Competitors ({len(result.competitors)}): {[c['name'] for c in result.competitors]}")
    print(f"Trends ({len(result.industry_trends)}): {result.industry_trends[:2]}")
    print(f"Pain points ({len(result.pain_points)}): {result.pain_points[:2]}")
    print(f"TAM: {result.tam_sam_som.get('tam', {})}")

asyncio.run(test())

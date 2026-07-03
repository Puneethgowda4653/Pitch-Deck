"""
Branding Extractor — Uses Gemini to analyze crawled website data
and extract brand identity (company name, colors, industry, tagline, description).
"""
from dataclasses import dataclass, field
from typing import Optional
import json

from loguru import logger

from app.core.config import settings
from app.core.genai_client import make_genai_client
from app.services.crawler.web_crawler import CrawlResult


@dataclass
class BrandingData:
    company_name: str = ""
    industry: str = ""
    tagline: str = ""
    description: str = ""
    primary_color: str = "#2540B5"
    secondary_color: str = "#7B2CBF"
    logo_url: Optional[str] = None
    tone: str = "professional"
    target_audience: str = ""
    key_products: list[str] = field(default_factory=list)
    # Website Intelligence Layer — structured extraction
    tech_stack: list[str] = field(default_factory=list)
    competitors_mentioned: list[str] = field(default_factory=list)
    testimonials: list[dict] = field(default_factory=list)
    pricing_model: dict = field(default_factory=dict)
    business_model: str = ""

    def model_dump(self) -> dict:
        return {
            "company_name": self.company_name,
            "industry": self.industry,
            "tagline": self.tagline,
            "description": self.description,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            "logo_url": self.logo_url,
            "tone": self.tone,
            "target_audience": self.target_audience,
            "key_products": self.key_products,
            "tech_stack": self.tech_stack,
            "competitors_mentioned": self.competitors_mentioned,
            "testimonials": self.testimonials,
            "pricing_model": self.pricing_model,
            "business_model": self.business_model,
        }


def _is_usable_color(hex_color: str) -> bool:
    """Return True if this color is a meaningful brand color — not near-white or near-black."""
    try:
        h = hex_color.lstrip("#")
        if len(h) == 3:
            h = h[0]*2 + h[1]*2 + h[2]*2
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        brightness = (r * 299 + g * 587 + b * 114) / 1000
        return 30 < brightness < 210  # exclude near-black and near-white
    except Exception:
        return False


class BrandingExtractor:
    """Extracts brand identity from crawled website data using Gemini AI."""

    def __init__(self):
        self._client = make_genai_client(settings.gemini_api_key)

    async def extract(self, crawl_result: CrawlResult) -> BrandingData:
        """Analyze crawled content and extract branding information."""
        logger.info(f"🎨 Extracting branding from {crawl_result.base_url}")

        prompt = self._build_prompt(crawl_result)

        try:
            response = self._client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            raw_text = response.text

            # Parse JSON from response
            json_str = raw_text
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]

            data = json.loads(json_str.strip())

            branding = BrandingData(
                company_name=data.get("company_name", ""),
                industry=data.get("industry", ""),
                tagline=data.get("tagline", ""),
                description=data.get("description", ""),
                primary_color=data.get("primary_color", "#2540B5"),
                secondary_color=data.get("secondary_color", "#7B2CBF"),
                tone=data.get("tone", "professional"),
                target_audience=data.get("target_audience", ""),
                key_products=data.get("key_products", []),
                tech_stack=data.get("tech_stack", []),
                competitors_mentioned=data.get("competitors_mentioned", []),
                testimonials=data.get("testimonials", []),
                pricing_model=data.get("pricing_model", {}),
                business_model=data.get("business_model", ""),
            )

            # Use first detected logo
            if crawl_result.all_images:
                for img in crawl_result.all_images:
                    if "logo" in img.lower():
                        branding.logo_url = img
                        break

            # Use website colors — filter out near-white and near-black
            usable = [c for c in crawl_result.all_colors if _is_usable_color(c)]
            if len(usable) >= 2:
                branding.primary_color = usable[0]
                branding.secondary_color = usable[1]
            elif len(usable) == 1:
                branding.primary_color = usable[0]

            logger.info(f"✅ Branding extracted: {branding.company_name} ({branding.industry})")
            return branding

        except Exception as e:
            logger.error(f"❌ Branding extraction failed: {e}")
            # Return sensible defaults from crawl data
            title = ""
            if crawl_result.pages:
                title = crawl_result.pages[0].title
            return BrandingData(
                company_name=title or "Company",
                industry="Technology",
                description=crawl_result.pages[0].description if crawl_result.pages else "",
            )

    def _build_prompt(self, crawl_result: CrawlResult) -> str:
        text_sample = crawl_result.text_summary[:4000]
        colors_str = ", ".join(crawl_result.all_colors[:10]) if crawl_result.all_colors else "none detected"

        return f"""You are a business intelligence analyst extracting structured data from a company website.
Analyze the content carefully and extract ALL fields. Be specific — use exact terms found in the text.

Website URL: {crawl_result.base_url}

Page Content:
{text_sample}

Detected Colors: {colors_str}

Return ONLY a JSON object with these fields (no other text):
{{
  "company_name": "The company/product name",
  "industry": "A SPECIFIC, searchable industry niche — not a broad category. Use terms that would return real competitor names in a Google search. BAD examples: 'Technology', 'Software', 'Finance'. GOOD examples: 'Quick Commerce', 'Decentralized Exchange', 'B2B Payments Infrastructure', 'AI Recruiting Software', 'Restaurant Management SaaS', 'Supply Chain Visibility Platform', 'Last-Mile Delivery', 'Buy Now Pay Later'. Pick the most specific label that matches what this company does.",
  "tagline": "Their main tagline or value proposition (exact words if possible)",
  "description": "A 2-3 sentence description of what the company does and who it serves",
  "primary_color": "#hexcolor (brand primary — use detected colors if available)",
  "secondary_color": "#hexcolor (brand secondary)",
  "tone": "professional/casual/technical/playful",
  "target_audience": "Who they serve (e.g. SMBs, Enterprise, Developers, Founders)",
  "key_products": ["product or feature name 1", "product 2"],
  "business_model": "How they make money: SaaS subscription / marketplace / transaction fee / freemium / etc.",
  "tech_stack": ["React", "AWS", "Python"],
  "competitors_mentioned": ["Competitor A", "Competitor B"],
  "pricing_model": {{
    "model": "subscription/one-time/freemium/usage-based",
    "tiers": ["free", "pro $X/mo", "enterprise — contact sales"],
    "notes": "any notable pricing signals e.g. annual discount, trial period"
  }},
  "testimonials": [
    {{"quote": "exact or paraphrased quote", "author": "Name, Title at Company", "metric": "optional result e.g. 3x ROI"}}
  ]
}}

EXTRACTION RULES:
- tech_stack: look for logos, 'built with', 'powered by', footer links, job listings tech mentions
- competitors_mentioned: look for 'vs', 'alternative to', 'unlike', comparison pages, 'switch from'
- pricing_model.tiers: extract any price numbers or tier names found on the page
- testimonials: extract up to 3 real testimonials with metrics if present
- If a field has no evidence on the page, return [] or {{}} or "" — do NOT invent data"""

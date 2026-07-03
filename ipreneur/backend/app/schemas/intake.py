"""
Company intake schema — collects founder-provided metrics before the pipeline runs.
These override inferred data from the website crawl wherever provided.
"""
from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


class FundingStage(str, Enum):
    idea = "idea"
    pre_revenue = "pre_revenue"
    pre_seed = "pre_seed"
    seed = "seed"
    series_a = "series_a"
    series_b = "series_b"
    growth = "growth"
    bootstrapped = "bootstrapped"


class BusinessModelType(str, Enum):
    saas = "saas"
    marketplace = "marketplace"
    services = "services"
    ecommerce = "ecommerce"
    fintech = "fintech"
    hardware = "hardware"
    other = "other"


class CompanyIntake(BaseModel):
    # ── Required ────────────────────────────────────────────────────────────
    website_url: str

    # ── Business basics ──────────────────────────────────────────────────────
    company_name: Optional[str] = None
    industry: Optional[str] = None
    business_model: Optional[BusinessModelType] = None
    funding_stage: Optional[FundingStage] = None
    founded_year: Optional[int] = None
    team_size: Optional[int] = None

    # ── Financials ───────────────────────────────────────────────────────────
    arr_usd: Optional[float] = None         # Annual Recurring Revenue
    mrr_usd: Optional[float] = None         # Monthly Recurring Revenue

    # ── Traction ─────────────────────────────────────────────────────────────
    total_customers: Optional[int] = None
    monthly_active_users: Optional[int] = None
    growth_rate_mom_pct: Optional[float] = None  # Month-over-month growth %

    # ── Unit economics ───────────────────────────────────────────────────────
    cac_usd: Optional[float] = None         # Customer Acquisition Cost
    ltv_usd: Optional[float] = None         # Lifetime Value
    churn_rate_pct: Optional[float] = None  # Monthly churn %
    nrr_pct: Optional[float] = None         # Net Revenue Retention %

    # ── The Ask ──────────────────────────────────────────────────────────────
    ask_amount_usd: Optional[float] = None  # How much they're raising
    round_type: Optional[str] = None        # "Seed", "Series A", etc.

    @field_validator("website_url")
    @classmethod
    def ensure_scheme(cls, v: str) -> str:
        v = v.strip()
        if v and not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v

    def to_prompt_section(self) -> str:
        """Format intake data as a prompt section — ground truth for AI agents."""
        lines: list[str] = []

        if self.company_name:
            lines.append(f"  Company Name: {self.company_name}")
        if self.industry:
            lines.append(f"  Industry: {self.industry}")
        if self.funding_stage:
            lines.append(f"  Funding Stage: {self.funding_stage.value.replace('_', ' ').title()}")
        if self.business_model:
            lines.append(f"  Business Model: {self.business_model.value.upper()}")
        if self.founded_year:
            lines.append(f"  Founded: {self.founded_year}")
        if self.team_size:
            lines.append(f"  Team Size: {self.team_size}")

        if self.arr_usd is not None:
            lines.append(f"  ARR: ${self.arr_usd:,.0f}")
        elif self.mrr_usd is not None:
            lines.append(f"  MRR: ${self.mrr_usd:,.0f}  (implied ARR ~${self.mrr_usd * 12:,.0f})")

        if self.total_customers is not None:
            lines.append(f"  Total Customers: {self.total_customers:,}")
        if self.monthly_active_users is not None:
            lines.append(f"  MAU: {self.monthly_active_users:,}")
        if self.growth_rate_mom_pct is not None:
            lines.append(f"  MoM Growth: {self.growth_rate_mom_pct:.1f}%")

        if self.cac_usd is not None:
            lines.append(f"  CAC: ${self.cac_usd:,.0f}")
        if self.ltv_usd is not None:
            lines.append(f"  LTV: ${self.ltv_usd:,.0f}")
        if self.cac_usd and self.ltv_usd and self.cac_usd > 0:
            lines.append(f"  LTV:CAC: {self.ltv_usd / self.cac_usd:.1f}x")
        if self.churn_rate_pct is not None:
            lines.append(f"  Monthly Churn: {self.churn_rate_pct:.1f}%")
        if self.nrr_pct is not None:
            lines.append(f"  Net Revenue Retention: {self.nrr_pct:.0f}%")

        if self.ask_amount_usd is not None:
            round_label = self.round_type or "unspecified round"
            lines.append(f"  Raising: ${self.ask_amount_usd:,.0f} ({round_label})")

        if not lines:
            return ""

        header = "FOUNDER-PROVIDED METRICS (treat as ground truth — override inferred data):"
        return header + "\n" + "\n".join(lines)

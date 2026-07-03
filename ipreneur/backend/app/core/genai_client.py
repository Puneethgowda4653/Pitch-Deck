"""
Gemini AI client — single provider, no fallback.

Auth: the API key is sent in the `x-goog-api-key` HTTP header. This is Google's
documented method and works for BOTH key formats:
  - AIzaSy... (legacy standard keys)
  - AQ.xxx    (new authorization keys — now the default from AI Studio)

Do NOT use `?key=` (returns 400 for AQ. keys) or `Authorization: Bearer`
(returns 401). The header is the only transport that authenticates both types.

Note: AQ. keys only work on accounts that are not restricted. A restricted
account returns 401 ACCESS_TOKEN_TYPE_UNSUPPORTED regardless of transport —
that is an account-level issue, not a code issue.
"""
import httpx
from loguru import logger

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class _UnifiedResponse:
    def __init__(self, text: str, grounding: list | None = None):
        self.text = text
        self.grounding = grounding or []   # list of {"title": ..., "uri": ...}


class _GeminiModels:
    def __init__(self, gemini_key: str, max_tokens: int = 8192, thinking_budget: int = 0):
        self._gemini_key = gemini_key or ""
        self._max_tokens = max_tokens
        self._thinking_budget = thinking_budget

    def _call_gemini(self, model: str, contents: str, max_tokens: int, use_search: bool = False) -> _UnifiedResponse:
        url = f"{_GEMINI_BASE}/{model}:generateContent"
        gen_config = {"maxOutputTokens": max_tokens, "temperature": 0.7}
        # gemini-2.5-* are THINKING models: reasoning tokens count against
        # maxOutputTokens. Without this, thinking eats the budget and the JSON
        # gets truncated mid-deck. thinkingBudget=0 disables thinking entirely.
        gen_config["thinkingConfig"] = {"thinkingBudget": self._thinking_budget}
        payload = {
            "contents": [{"parts": [{"text": contents}]}],
            "generationConfig": gen_config,
        }
        if use_search:
            # Google Search grounding — model searches the live web and grounds
            # its answer in real sources instead of training-memory guesses.
            payload["tools"] = [{"google_search": {}}]
        headers = {
            "x-goog-api-key": self._gemini_key,
            "Content-Type": "application/json",
        }
        logger.debug(f"Gemini → x-goog-api-key header | model={model} | search={use_search}")

        with httpx.Client(timeout=180) as client:
            resp = client.post(url, headers=headers, json=payload)

        if not resp.is_success:
            try:
                err = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                err = resp.text
            raise RuntimeError(f"Gemini {resp.status_code}: {err}")

        data = resp.json()
        try:
            cand = data["candidates"][0]
            # Gemini may split output across multiple parts — join text parts.
            parts = cand["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
            if not text:
                raise KeyError("no text parts")
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Unexpected Gemini response: {data}") from e

        # Capture web-search grounding sources (present only when use_search=True).
        grounding: list = []
        try:
            for chunk in cand.get("groundingMetadata", {}).get("groundingChunks", []):
                web = chunk.get("web") or {}
                if web.get("uri") or web.get("title"):
                    grounding.append({"title": web.get("title", ""), "uri": web.get("uri", "")})
        except Exception:
            pass
        return _UnifiedResponse(text, grounding=grounding)

    def generate_content(self, model: str, contents: str, config=None, use_search: bool = False) -> _UnifiedResponse:
        max_tokens = self._max_tokens
        if config and hasattr(config, "max_output_tokens") and config.max_output_tokens:
            max_tokens = config.max_output_tokens

        if not self._gemini_key or len(self._gemini_key) < 20:
            raise RuntimeError(
                "No valid GEMINI_API_KEY configured. Add a working Gemini key to .env."
            )

        result = self._call_gemini(model, contents, max_tokens, use_search=use_search)
        logger.debug("✅ Gemini succeeded")
        return result


# ── Public API ─────────────────────────────────────────────────────────────────

class GeminiClientWrapper:
    """Drop-in wrapper — name kept for import compatibility with master_agent.py."""
    def __init__(self, gemini_key: str, max_tokens: int = 8192, thinking_budget: int = 0):
        self.models = _GeminiModels(gemini_key, max_tokens, thinking_budget)


def make_genai_client(api_key: str) -> GeminiClientWrapper:
    from app.core.config import settings
    return GeminiClientWrapper(
        gemini_key=api_key,
        max_tokens=settings.gemini_max_tokens,
        thinking_budget=settings.gemini_thinking_budget,
    )

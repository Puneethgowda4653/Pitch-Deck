from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Returns a Supabase client instance."""
    url: str = settings.supabase_url
    # Use anon key or service role key based on what's available
    key: str = settings.supabase_anon_key or getattr(settings, "supabase_key", "")
    
    if not url or not key:
        raise ValueError("Supabase URL and Key must be provided in the environment variables.")
        
    return create_client(url, key)

# Expose a singleton client for easy import
supabase_client = get_supabase_client() if settings.supabase_url and (settings.supabase_anon_key or getattr(settings, "supabase_key", "")) else None

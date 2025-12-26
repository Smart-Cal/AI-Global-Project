"""
Supabase 연결 관리
"""
import os
from typing import Optional
from supabase import create_client, Client

_supabase_client: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """
    Supabase 클라이언트 반환 (싱글톤 패턴)

    Returns:
        Supabase Client 또는 None (설정되지 않은 경우)
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        return None

    if url.startswith("https://xxxxx") or key.startswith("eyJxxxxx"):
        return None

    try:
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        print(f"Supabase 연결 실패: {e}")
        return None


def is_connected() -> bool:
    """Supabase 연결 상태 확인"""
    client = get_supabase()
    return client is not None

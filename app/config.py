"""
설정 관리 모듈
환경변수 로드 및 앱 설정
"""
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()


class Settings:
    """앱 설정 클래스"""

    # OpenAI API
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # App Settings
    APP_NAME: str = "AI 캘린더"
    APP_ICON: str = "🗓️"

    # OpenAI Model
    OPENAI_MODEL: str = "gpt-4o-mini"  # 비용 효율적인 모델

    # Watcher Settings (감시자 설정)
    ONBOARDING_STUCK_TIMEOUT: int = 180  # 3분 (초)
    PLAN_REVISION_THRESHOLD: int = 2  # 플랜 수정 횟수 임계값
    EXECUTION_DROPOUT_DAYS: int = 3  # 연속 미체크 일수

    @classmethod
    def validate(cls) -> bool:
        """필수 환경변수 검증"""
        required = [
            ("OPENAI_API_KEY", cls.OPENAI_API_KEY),
            ("SUPABASE_URL", cls.SUPABASE_URL),
            ("SUPABASE_KEY", cls.SUPABASE_KEY),
        ]

        missing = [name for name, value in required if not value or value == "sk-xxxxx" or value.startswith("https://xxxxx")]

        if missing:
            return False
        return True

    @classmethod
    def get_missing_keys(cls) -> list:
        """누락된 환경변수 목록 반환"""
        required = [
            ("OPENAI_API_KEY", cls.OPENAI_API_KEY),
            ("SUPABASE_URL", cls.SUPABASE_URL),
            ("SUPABASE_KEY", cls.SUPABASE_KEY),
        ]

        return [name for name, value in required if not value or value == "sk-xxxxx" or value.startswith("https://xxxxx")]


settings = Settings()

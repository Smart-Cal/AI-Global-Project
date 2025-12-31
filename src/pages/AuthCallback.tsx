import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { handleGoogleCallback, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    // 이미 로그인된 경우 홈으로
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    const processCallback = async () => {
      try {
        // URL에서 에러 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const errorParam = urlParams.get('error') || hashParams.get('error');
        const errorDescription =
          urlParams.get('error_description') || hashParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // 구글 콜백 처리
        const success = await handleGoogleCallback();

        if (success) {
          // URL 해시 정리
          window.history.replaceState(null, '', window.location.pathname);
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.');
        setProcessing(false);

        // 5초 후 로그인 페이지로 이동
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 5000);
      }
    };

    processCallback();
  }, [handleGoogleCallback, navigate, user]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          padding: '20px',
        }}
      >
        <div style={{ fontSize: '48px' }}>😕</div>
        <h2 style={{ color: '#333', margin: 0 }}>로그인 실패</h2>
        <div
          style={{
            background: '#fee2e2',
            color: '#E03E3E',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
        <p style={{ color: '#666', fontSize: '14px' }}>
          잠시 후 로그인 페이지로 이동합니다...
        </p>
        <button
          onClick={() => navigate('/auth', { replace: true })}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4A90D9',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          지금 이동하기
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
      }}
    >
      <div className="spinner" style={{ width: '48px', height: '48px' }} />
      <p style={{ color: '#666', fontSize: '16px' }}>로그인 처리 중...</p>
    </div>
  );
};

export default AuthCallback;

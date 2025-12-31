import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'register';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, user, isLoading, initFromToken } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // 토큰에서 사용자 복원 시도
    initFromToken();
  }, [initFromToken]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password) {
      setError('전화번호와 비밀번호를 입력해주세요.');
      return;
    }

    if (mode === 'register' && !name) {
      setError('이름을 입력해주세요.');
      return;
    }

    try {
      if (mode === 'login') {
        await login(phone, password);
      } else {
        await register(phone, password, name, nickname || name);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🌴</div>
          <h1 className="auth-title">PALM</h1>
          <p className="auth-subtitle">Personal AI Life Manager</p>
        </div>

        <div className="auth-features">
          <div className="auth-feature">
            <span className="auth-feature-icon">🎯</span>
            <span>목표 기반 일정 추천</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">🤖</span>
            <span>AI 에이전트와 대화</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">📊</span>
            <span>스마트 할 일 관리</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">📅</span>
            <span>자동 시간 배치</span>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            회원가입
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#E03E3E',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">전화번호</label>
            <input
              type="tel"
              className="form-input"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <input
              type="password"
              className="form-input"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label className="form-label">이름</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">닉네임 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="닉네임을 입력하세요"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'register';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, user, isLoading } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const openModal = (m: AuthMode) => {
    setMode(m);
    setModalOpen(true);
    setError('');
    setPhone('');
    setPassword('');
    setName('');
    setNickname('');
  };

  const handleSubmit = async () => {
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
      setModalOpen(false);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">📅</div>
      <h1 className="auth-title">AI 캘린더</h1>
      <p className="auth-subtitle">AI가 도와주는 스마트한 일정 관리</p>

      <div className="auth-features">
        <div className="auth-feature">✨ 자연어로 일정 추가</div>
        <div className="auth-feature">📊 카테고리별 일정 관리</div>
        <div className="auth-feature">🤖 AI 일정 도우미</div>
        <div className="auth-feature">📱 모바일 최적화 디자인</div>
      </div>

      <div className="auth-buttons">
        <button className="btn btn-primary" onClick={() => openModal('login')}>
          로그인
        </button>
        <button className="btn btn-secondary" onClick={() => openModal('register')}>
          회원가입
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === 'login' ? '로그인' : '회원가입'}
      >
        {error && (
          <div style={{ background: '#FFEBEE', color: '#C62828', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div className="input-group">
          <label className="input-label">전화번호</label>
          <input
            type="tel"
            className="input"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">비밀번호</label>
          <input
            type="password"
            className="input"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {mode === 'register' && (
          <>
            <div className="input-group">
              <label className="input-label">이름</label>
              <input
                type="text"
                className="input"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">닉네임 (선택)</label>
              <input
                type="text"
                className="input"
                placeholder="닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={isLoading}
          style={{ marginTop: '8px' }}
        >
          {isLoading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{ marginTop: '8px' }}
        >
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </Modal>
    </div>
  );
};

export default AuthPage;

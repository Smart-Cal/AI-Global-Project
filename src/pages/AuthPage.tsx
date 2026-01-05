import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithGoogle, user, isLoading, initFromToken } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    initFromToken();
  }, [initFromToken]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google login error:', err);
      setError(err instanceof Error ? err.message : 'Google login failed.');
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
            <span>Goal-based Schedule Recommendation</span>
          </div>
          <div className="auth-feature">
            <span>Chat with AI Agent</span>
          </div>
          <div className="auth-feature">
            <span>Smart Todo Management</span>
          </div>
          <div className="auth-feature">
            <span>Automatic Time Scheduling</span>
          </div>
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

        <button
          type="button"
          className="btn btn-google btn-block btn-lg"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backgroundColor: '#fff',
            color: '#333',
            border: '1px solid #ddd',
            padding: '14px 20px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <>
              <div className="spinner" style={{ width: '20px', height: '20px' }} />
              <span>Logging in...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p
          style={{
            marginTop: '24px',
            fontSize: '12px',
            color: '#999',
            textAlign: 'center',
          }}
        >
          By logging in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

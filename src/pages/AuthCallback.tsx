import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { handleGoogleCallback, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    // Redirect to home if already logged in
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    const processCallback = async () => {
      try {
        // Check for error parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const errorParam = urlParams.get('error') || hashParams.get('error');
        const errorDescription =
          urlParams.get('error_description') || hashParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // Process Google callback
        const success = await handleGoogleCallback();

        if (success) {
          // Clean up URL hash
          window.history.replaceState(null, '', window.location.pathname);
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred during login processing.');
        setProcessing(false);

        // Redirect to login page after 5 seconds
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
        <h2 style={{ color: '#333', margin: 0 }}>Login Failed</h2>
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
          Redirecting to login page in a moment...
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
          Go now
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
      <p style={{ color: '#666', fontSize: '16px' }}>Processing login...</p>
    </div>
  );
};

export default AuthCallback;

import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { getGoogleCalendarStatus, getGoogleCalendarAuthUrl, disconnectGoogleCalendar } from '../services/api';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Check Google Calendar connection status on modal open
  useEffect(() => {
    if (isOpen) {
      checkCalendarStatus();

      // Check URL params for calendar connection result
      const params = new URLSearchParams(window.location.search);
      if (params.get('calendar_connected') === 'true') {
        showToast('Google Calendar connected!', 'success');
        setCalendarConnected(true);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (params.get('calendar_error') === 'true') {
        showToast('Failed to connect Google Calendar', 'error');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [isOpen]);

  const checkCalendarStatus = async () => {
    try {
      const status = await getGoogleCalendarStatus();
      setCalendarConnected(status.connected);
    } catch (error) {
      console.error('Failed to check calendar status:', error);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const { url } = await getGoogleCalendarAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      showToast('Failed to start calendar connection', 'error');
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      await disconnectGoogleCalendar();
      setCalendarConnected(false);
      showToast('Google Calendar disconnected', 'success');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      showToast('Failed to disconnect calendar', 'error');
    } finally {
      setCalendarLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Settings</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Google Calendar Integration */}
          <div className="settings-section">
            <h4>External Services</h4>
            <div className="external-service-card">
              <div className="service-info">
                <div className="service-icon google-calendar-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    {/* Google Calendar Official Icon */}
                    <path d="M24 4H8C5.79 4 4 5.79 4 8V24C4 26.21 5.79 28 8 28H24C26.21 28 28 26.21 28 24V8C28 5.79 26.21 4 24 4Z" fill="#4285F4"/>
                    <path d="M24 4H20V8H28V8C28 5.79 26.21 4 24 4Z" fill="#1A73E8"/>
                    <path d="M28 8H20V16H28V8Z" fill="#1A73E8"/>
                    <path d="M28 16H20V24H28V16Z" fill="#34A853"/>
                    <path d="M20 24H12V28H24C26.21 28 28 26.21 28 24H20Z" fill="#34A853"/>
                    <path d="M12 24H4V24C4 26.21 5.79 28 8 28H12V24Z" fill="#FBBC04"/>
                    <path d="M4 24V16H12V24H4Z" fill="#FBBC04"/>
                    <path d="M4 16V8H12V16H4Z" fill="#EA4335"/>
                    <path d="M12 4H8C5.79 4 4 5.79 4 8H12V4Z" fill="#EA4335"/>
                    <rect x="8" y="8" width="16" height="16" rx="1" fill="white"/>
                    <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#4285F4">31</text>
                  </svg>
                </div>
                <div className="service-details">
                  <span className="service-name">Google Calendar</span>
                  <span className="service-status">
                    {calendarConnected ? (
                      <span className="status-connected">Connected</span>
                    ) : (
                      <span className="status-disconnected">Not connected</span>
                    )}
                  </span>
                </div>
              </div>
              <button
                className={`btn ${calendarConnected ? 'btn-danger' : 'btn-primary'} btn-sm`}
                onClick={calendarConnected ? handleDisconnectCalendar : handleConnectCalendar}
                disabled={calendarLoading}
              >
                {calendarLoading ? 'Loading...' : calendarConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
            {calendarConnected && (
              <p className="service-hint">
                Your Google Calendar is synced. Events will be automatically synced with your calendar.
              </p>
            )}
            {!calendarConnected && (
              <p className="service-hint">
                Connect your Google Calendar to sync events and check for conflicts automatically.
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

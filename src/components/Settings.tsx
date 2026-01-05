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
                <div className="service-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 4V2M15 4V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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

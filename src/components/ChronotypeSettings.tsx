import React, { useState } from 'react';
import { useSettingsStore, type Chronotype } from '../store/settingsStore';
import { useToast } from './Toast';
import TimePicker from './TimePicker';

interface ChronotypeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChronotypeSettings: React.FC<ChronotypeSettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, getChronotypeInfo } = useSettingsStore();
  const { showToast } = useToast();

  const [localSettings, setLocalSettings] = useState(settings);

  const chronotypes: { value: Chronotype; icon: string; label: string; description: string }[] = [
    {
      value: 'morning',
      icon: '🌅',
      label: 'Morning (Early Bird)',
      description: 'Prefers waking up early and has high energy in the morning',
    },
    {
      value: 'neutral',
      icon: '⚖️',
      label: 'Intermediate',
      description: 'Maintains balanced energy throughout the day',
    },
    {
      value: 'evening',
      icon: '🌙',
      label: 'Evening (Night Owl)',
      description: 'Prefers staying up late and has high energy in the evening',
    },
  ];

  const handleChronotypeChange = (chronotype: Chronotype) => {
    setLocalSettings(prev => ({ ...prev, chronotype }));

    // Chronotype에 따른 기본 시간 설정
    switch (chronotype) {
      case 'morning':
        setLocalSettings(prev => ({ ...prev, wakeUpTime: '05:30', sleepTime: '22:00' }));
        break;
      case 'evening':
        setLocalSettings(prev => ({ ...prev, wakeUpTime: '09:00', sleepTime: '01:00' }));
        break;
      case 'neutral':
        setLocalSettings(prev => ({ ...prev, wakeUpTime: '07:00', sleepTime: '23:00' }));
        break;
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    showToast('Settings saved', 'success');
    onClose();
  };

  const getOptimalHoursText = (chronotype: Chronotype) => {
    switch (chronotype) {
      case 'morning':
        return {
          focus: '6 AM ~ 11 AM',
          energy: '8 AM ~ 11 AM',
          windDown: '7 PM ~ 9 PM',
        };
      case 'evening':
        return {
          focus: '2 PM ~ 8 PM',
          energy: '4 PM ~ 8 PM',
          windDown: '10 PM ~ Midnight',
        };
      case 'neutral':
        return {
          focus: '9 AM ~ 4 PM',
          energy: '10 AM ~ 3 PM',
          windDown: '8 PM ~ 10 PM',
        };
    }
  };

  const currentHours = getOptimalHoursText(localSettings.chronotype);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Chronotype Settings</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Chronotype 설명 */}
          <div className="chronotype-intro">
            <p>
              Chronotype represents your daily energy pattern.
              Select the type that suits you, and PALM will recommend optimal activity times.
            </p>
          </div>

          {/* Chronotype 선택 */}
          <div className="chronotype-selector">
            {chronotypes.map((type) => (
              <div
                key={type.value}
                className={`chronotype-option ${localSettings.chronotype === type.value ? 'selected' : ''}`}
                onClick={() => handleChronotypeChange(type.value)}
              >
                <div className="chronotype-icon">{type.icon}</div>
                <div className="chronotype-content">
                  <h4>{type.label}</h4>
                  <p>{type.description}</p>
                </div>
                <div className="chronotype-check">
                  {localSettings.chronotype === type.value && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="var(--primary)" />
                      <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 최적 시간대 정보 */}
          <div className="chronotype-hours-info">
            <h4>Recommended Activity Times</h4>
            <div className="hours-grid">
              <div className="hours-item">
                <span className="hours-icon">🎯</span>
                <div className="hours-content">
                  <span className="hours-label">Focus Time</span>
                  <span className="hours-value">{currentHours.focus}</span>
                </div>
              </div>
              <div className="hours-item">
                <span className="hours-icon">⚡</span>
                <div className="hours-content">
                  <span className="hours-label">Energy Peak</span>
                  <span className="hours-value">{currentHours.energy}</span>
                </div>
              </div>
              <div className="hours-item">
                <span className="hours-icon">🌙</span>
                <div className="hours-content">
                  <span className="hours-label">Wind Down Time</span>
                  <span className="hours-value">{currentHours.windDown}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 기상/취침 시간 설정 */}
          <div className="chronotype-times">
            <h4>Wake Up & Sleep Time</h4>
            <div className="times-row">
              <div className="time-field">
                <TimePicker
                  label="Wake Up Time"
                  value={localSettings.wakeUpTime}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, wakeUpTime: value }))}
                  placeholder="Select Wake Up Time"
                />
              </div>
              <div className="time-field">
                <TimePicker
                  label="Sleep Time"
                  value={localSettings.sleepTime}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, sleepTime: value }))}
                  placeholder="Select Sleep Time"
                />
              </div>
            </div>
          </div>

          {/* 작업 설정 */}
          <div className="chronotype-work-settings">
            <h4>Work Settings</h4>
            <div className="work-settings-grid">
              <div className="setting-item">
                <label>Focus Duration</label>
                <select
                  value={localSettings.preferredWorkDuration}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    preferredWorkDuration: parseInt(e.target.value)
                  }))}
                  className="form-input"
                >
                  <option value={25}>25 min (Pomodoro)</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min (Ultradian)</option>
                  <option value={120}>120 min</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Break Interval</label>
                <select
                  value={localSettings.breakInterval}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    breakInterval: parseInt(e.target.value)
                  }))}
                  className="form-input"
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChronotypeSettings;

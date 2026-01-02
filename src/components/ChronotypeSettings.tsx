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
      label: '아침형 (Early Bird)',
      description: '아침에 에너지가 높고 일찍 일어나는 것을 선호합니다',
    },
    {
      value: 'neutral',
      icon: '⚖️',
      label: '중립형 (Intermediate)',
      description: '일정한 시간대에 균형잡힌 에너지를 유지합니다',
    },
    {
      value: 'evening',
      icon: '🌙',
      label: '저녁형 (Night Owl)',
      description: '저녁에 에너지가 높고 늦게까지 활동하는 것을 선호합니다',
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
    showToast('설정이 저장되었습니다', 'success');
    onClose();
  };

  const getOptimalHoursText = (chronotype: Chronotype) => {
    switch (chronotype) {
      case 'morning':
        return {
          focus: '오전 6시 ~ 11시',
          energy: '오전 8시 ~ 11시',
          windDown: '저녁 7시 ~ 9시',
        };
      case 'evening':
        return {
          focus: '오후 2시 ~ 저녁 8시',
          energy: '오후 4시 ~ 저녁 8시',
          windDown: '밤 10시 ~ 자정',
        };
      case 'neutral':
        return {
          focus: '오전 9시 ~ 오후 4시',
          energy: '오전 10시 ~ 오후 3시',
          windDown: '저녁 8시 ~ 10시',
        };
    }
  };

  const currentHours = getOptimalHoursText(localSettings.chronotype);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Chronotype 설정</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Chronotype 설명 */}
          <div className="chronotype-intro">
            <p>
              Chronotype(생체리듬 유형)은 당신의 하루 에너지 패턴을 나타냅니다.
              본인에게 맞는 유형을 선택하면 PALM이 최적의 시간대에 활동을 추천해드립니다.
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
            <h4>추천 활동 시간대</h4>
            <div className="hours-grid">
              <div className="hours-item">
                <span className="hours-icon">🎯</span>
                <div className="hours-content">
                  <span className="hours-label">집중 시간</span>
                  <span className="hours-value">{currentHours.focus}</span>
                </div>
              </div>
              <div className="hours-item">
                <span className="hours-icon">⚡</span>
                <div className="hours-content">
                  <span className="hours-label">에너지 피크</span>
                  <span className="hours-value">{currentHours.energy}</span>
                </div>
              </div>
              <div className="hours-item">
                <span className="hours-icon">🌙</span>
                <div className="hours-content">
                  <span className="hours-label">마무리 시간</span>
                  <span className="hours-value">{currentHours.windDown}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 기상/취침 시간 설정 */}
          <div className="chronotype-times">
            <h4>기상 및 취침 시간</h4>
            <div className="times-row">
              <div className="time-field">
                <TimePicker
                  label="기상 시간"
                  value={localSettings.wakeUpTime}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, wakeUpTime: value }))}
                  placeholder="기상 시간 선택"
                />
              </div>
              <div className="time-field">
                <TimePicker
                  label="취침 시간"
                  value={localSettings.sleepTime}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, sleepTime: value }))}
                  placeholder="취침 시간 선택"
                />
              </div>
            </div>
          </div>

          {/* 작업 설정 */}
          <div className="chronotype-work-settings">
            <h4>작업 설정</h4>
            <div className="work-settings-grid">
              <div className="setting-item">
                <label>집중 작업 시간</label>
                <select
                  value={localSettings.preferredWorkDuration}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    preferredWorkDuration: parseInt(e.target.value)
                  }))}
                  className="form-input"
                >
                  <option value={25}>25분 (포모도로)</option>
                  <option value={45}>45분</option>
                  <option value={60}>60분</option>
                  <option value={90}>90분 (울트라디안)</option>
                  <option value={120}>120분</option>
                </select>
              </div>
              <div className="setting-item">
                <label>휴식 간격</label>
                <select
                  value={localSettings.breakInterval}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    breakInterval: parseInt(e.target.value)
                  }))}
                  className="form-input"
                >
                  <option value={5}>5분</option>
                  <option value={10}>10분</option>
                  <option value={15}>15분</option>
                  <option value={20}>20분</option>
                  <option value={30}>30분</option>
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

import React, { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '시간 선택'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      setSelectedHour(h);
      setSelectedMinute(m);
    } else {
      setSelectedHour(null);
      setSelectedMinute(null);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    const minute = selectedMinute ?? 0;
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(timeStr);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    const hour = selectedHour ?? 9;
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(timeStr);
  };

  const formatDisplay = () => {
    if (selectedHour === null) return '';
    const hour = selectedHour;
    const minute = selectedMinute ?? 0;
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour}:${minute.toString().padStart(2, '0')}`;
  };

  const clearTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHour(null);
    setSelectedMinute(null);
    onChange('');
  };

  return (
    <div className="time-picker-container" ref={containerRef}>
      {label && <label className="form-label">{label}</label>}
      <div
        className={`time-picker-input ${isOpen ? 'focused' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="time-picker-icon">🕐</span>
        <span className={`time-picker-value ${!value ? 'placeholder' : ''}`}>
          {value ? formatDisplay() : placeholder}
        </span>
        {value && (
          <button className="time-picker-clear" onClick={clearTime}>
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="time-picker-dropdown">
          <div className="time-picker-columns">
            {/* Hours */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">시</div>
              <div className="time-picker-scroll">
                {hours.map(hour => {
                  const period = hour < 12 ? '오전' : '오후';
                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                  return (
                    <div
                      key={hour}
                      className={`time-picker-option ${selectedHour === hour ? 'selected' : ''}`}
                      onClick={() => handleHourSelect(hour)}
                    >
                      <span className="time-period">{period}</span>
                      <span className="time-value">{displayHour}시</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minutes */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">분</div>
              <div className="time-picker-scroll">
                {minutes.map(minute => (
                  <div
                    key={minute}
                    className={`time-picker-option ${selectedMinute === minute ? 'selected' : ''}`}
                    onClick={() => handleMinuteSelect(minute)}
                  >
                    <span className="time-value">{minute.toString().padStart(2, '0')}분</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick select */}
          <div className="time-picker-quick">
            <button onClick={() => { handleHourSelect(9); handleMinuteSelect(0); setIsOpen(false); }}>
              오전 9:00
            </button>
            <button onClick={() => { handleHourSelect(12); handleMinuteSelect(0); setIsOpen(false); }}>
              오후 12:00
            </button>
            <button onClick={() => { handleHourSelect(14); handleMinuteSelect(0); setIsOpen(false); }}>
              오후 2:00
            </button>
            <button onClick={() => { handleHourSelect(18); handleMinuteSelect(0); setIsOpen(false); }}>
              오후 6:00
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;

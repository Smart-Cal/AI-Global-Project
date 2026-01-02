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
  const [period, setPeriod] = useState<'오전' | '오후'>('오전');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      setPeriod(h < 12 ? '오전' : '오후');
      setSelectedHour(h === 0 ? 12 : h > 12 ? h - 12 : h);
      setSelectedMinute(m);
    } else {
      setPeriod('오전');
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

  const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const updateTime = (newPeriod: '오전' | '오후', hour: number | null, minute: number | null) => {
    if (hour === null) return;

    let hour24 = hour;
    if (newPeriod === '오전') {
      hour24 = hour === 12 ? 0 : hour;
    } else {
      hour24 = hour === 12 ? 12 : hour + 12;
    }

    const min = minute ?? 0;
    const timeStr = `${hour24.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    onChange(timeStr);
  };

  const handlePeriodSelect = (p: '오전' | '오후') => {
    setPeriod(p);
    updateTime(p, selectedHour, selectedMinute);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    updateTime(period, hour, selectedMinute);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    if (selectedHour === null) {
      setSelectedHour(9);
      updateTime(period, 9, minute);
    } else {
      updateTime(period, selectedHour, minute);
    }
  };

  const formatDisplay = () => {
    if (selectedHour === null) return '';
    const minute = selectedMinute ?? 0;
    return `${period} ${selectedHour}:${minute.toString().padStart(2, '0')}`;
  };

  const clearTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHour(null);
    setSelectedMinute(null);
    setPeriod('오전');
    onChange('');
  };

  return (
    <div className="time-picker-container" ref={containerRef}>
      {label && <label className="form-label">{label}</label>}
      <div
        className={`time-picker-input ${isOpen ? 'focused' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="time-picker-icon"></span>
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
          <div className="time-picker-columns three-columns">
            {/* 오전/오후 */}
            <div className="time-picker-column period-column">
              <div className="time-picker-column-header">오전/오후</div>
              <div className="time-picker-scroll period-scroll">
                <div
                  className={`time-picker-option period-option ${period === '오전' ? 'selected' : ''}`}
                  onClick={() => handlePeriodSelect('오전')}
                >
                  오전
                </div>
                <div
                  className={`time-picker-option period-option ${period === '오후' ? 'selected' : ''}`}
                  onClick={() => handlePeriodSelect('오후')}
                >
                  오후
                </div>
              </div>
            </div>

            {/* Hours (1-12) */}
            <div className="time-picker-column">
              <div className="time-picker-column-header">시</div>
              <div className="time-picker-scroll">
                {hours.map(hour => (
                  <div
                    key={hour}
                    className={`time-picker-option ${selectedHour === hour ? 'selected' : ''}`}
                    onClick={() => handleHourSelect(hour)}
                  >
                    <span className="time-value">{hour}시</span>
                  </div>
                ))}
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
        </div>
      )}
    </div>
  );
};

export default TimePicker;

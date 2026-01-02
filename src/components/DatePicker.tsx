import React, { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '날짜 선택'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      // YYYY-MM-DD 형식에서 직접 파싱 (타임존 문제 방지)
      const [year, month] = value.split('-').map(Number);
      setCurrentYear(year);
      setCurrentMonth(month - 1);
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

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const navigateMonth = (direction: number) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const formatDisplay = () => {
    if (!value) return '';
    // YYYY-MM-DD 형식에서 직접 파싱 (타임존 문제 방지)
    const [year, month, day] = value.split('-').map(Number);
    // 요일 계산을 위해 로컬 날짜로 생성
    const date = new Date(year, month - 1, day);
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const today = new Date().toISOString().split('T')[0];

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="date-picker-day empty" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const isSelected = dateStr === value;
      const isToday = dateStr === today;

      days.push(
        <div
          key={day}
          className={`date-picker-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateSelect(day)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="date-picker-container" ref={containerRef}>
      {label && <label className="form-label">{label}</label>}
      <div
        className={`date-picker-input ${isOpen ? 'focused' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="date-picker-icon">📅</span>
        <span className={`date-picker-value ${!value ? 'placeholder' : ''}`}>
          {value ? formatDisplay() : placeholder}
        </span>
        {value && (
          <button className="date-picker-clear" onClick={clearDate}>
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="date-picker-dropdown">
          <div className="date-picker-header">
            <button className="date-picker-nav" onClick={() => navigateMonth(-1)}>
              ◀
            </button>
            <span className="date-picker-title">
              {currentYear}년 {currentMonth + 1}월
            </span>
            <button className="date-picker-nav" onClick={() => navigateMonth(1)}>
              ▶
            </button>
          </div>

          <div className="date-picker-weekdays">
            {weekdays.map(day => (
              <div key={day} className="date-picker-weekday">{day}</div>
            ))}
          </div>

          <div className="date-picker-days">
            {renderCalendarDays()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;

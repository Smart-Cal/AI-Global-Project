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
  placeholder = 'Select Date'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Direct parsing from YYYY-MM-DD
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

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = weekdays[date.getDay()];
    return `${months[month - 1]} ${day}, ${year} (${weekday})`;
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
        <span className="date-picker-icon"></span>
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
              {months[currentMonth]} {currentYear}
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

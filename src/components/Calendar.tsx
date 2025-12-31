import React, { useEffect } from 'react';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { type CalendarEvent, type CalendarView, DEFAULT_CATEGORY_COLOR } from '../types';

interface CalendarProps {
  onDateClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  selectedDate: string | null;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  onDateClick,
  onEventClick,
  selectedDate,
  view,
  onViewChange,
}) => {
  const { user } = useAuthStore();
  const {
    events,
    selectedMonth,
    selectedYear,
    setMonth,
    loadMonthEvents,
    getEventsByDate,
  } = useEventStore();
  const { getCategoryById } = useCategoryStore();

  useEffect(() => {
    if (user) {
      loadMonthEvents(user.id, selectedYear, selectedMonth);
    }
  }, [user, selectedYear, selectedMonth, loadMonthEvents]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setMonth(12, selectedYear - 1);
    } else {
      setMonth(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setMonth(1, selectedYear + 1);
    } else {
      setMonth(selectedMonth + 1, selectedYear);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setMonth(now.getMonth() + 1, now.getFullYear());
    onDateClick(todayStr);
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayOfMonth = getFirstDayOfMonth(selectedYear, selectedMonth);

  // Previous month days
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const calendarDays: Array<{ day: number; month: 'prev' | 'current' | 'next'; dateStr: string }> = [];

  // Add previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, month: 'prev', dateStr });
  }

  // Add current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, month: 'current', dateStr });
  }

  // Add next month days
  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, month: 'next', dateStr });
  }

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={handlePrevMonth}>
          ←
        </button>
        <h2 className="calendar-month-title">
          {selectedYear}년 {selectedMonth}월
        </h2>
        <button className="calendar-nav-btn" onClick={handleNextMonth}>
          →
        </button>
        <button className="calendar-today-btn" onClick={handleToday}>
          오늘
        </button>
        <div className="calendar-view-toggle">
          <button
            className={`view-toggle-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => onViewChange('month')}
          >
            월
          </button>
          <button
            className={`view-toggle-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => onViewChange('week')}
          >
            주
          </button>
          <button
            className={`view-toggle-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => onViewChange('day')}
          >
            일
          </button>
        </div>
      </div>

      <div className="calendar-weekdays">
        {weekdays.map((day, idx) => (
          <div
            key={day}
            className={`calendar-weekday ${idx === 0 ? 'sunday' : ''} ${idx === 6 ? 'saturday' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map(({ day, month, dateStr }, idx) => {
          const dayEvents = getEventsByDate(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dayOfWeek = idx % 7;

          return (
            <div
              key={dateStr}
              className={`calendar-day ${month !== 'current' ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onDateClick(dateStr)}
            >
              <div
                className={`day-number ${dayOfWeek === 0 ? 'sunday' : ''} ${dayOfWeek === 6 ? 'saturday' : ''}`}
              >
                {day}
              </div>
              <div className="day-events">
                {dayEvents.slice(0, 3).map((event) => {
                  const category = event.category_id ? getCategoryById(event.category_id) : null;
                  const eventColor = category?.color || DEFAULT_CATEGORY_COLOR;
                  return (
                    <div
                      key={event.id}
                      className={`day-event ${event.is_ai_suggested && !event.is_confirmed ? 'ai-suggested' : ''} ${event.is_completed ? 'completed' : ''}`}
                      style={{ backgroundColor: eventColor, opacity: event.is_completed ? 0.6 : 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {event.is_completed && '✓ '}
                      {event.start_time && `${event.start_time.slice(0, 5)} `}
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="day-more">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

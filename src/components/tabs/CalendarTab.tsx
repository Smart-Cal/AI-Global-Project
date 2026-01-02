import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useCategoryStore } from '../../store/categoryStore';
import { DEFAULT_CATEGORY_COLOR, type CalendarEvent, type Category } from '../../types';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarTabProps {
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date?: string) => void;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ onEventClick, onAddEvent }) => {
  const { events, loadEvents } = useEventStore();
  const { categories, fetchCategories, getCategoryById } = useCategoryStore();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEvents();
    fetchCategories();
  }, []);

  // Initialize category filters with all categories
  useEffect(() => {
    if (categories.length > 0 && categoryFilters.size === 0) {
      setCategoryFilters(new Set(categories.map(c => c.id)));
    }
  }, [categories]);

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7; // Monday start
    const days: (Date | null)[] = [];

    // Padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getWeekDays = (startDate: Date) => {
    const days: Date[] = [];
    const start = new Date(startDate);
    // Adjust to Monday
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayOffset);

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatDateStr = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => {
      const matchesDate = e.event_date === dateStr;
      const matchesCategory = !e.category_id || categoryFilters.has(e.category_id);
      return matchesDate && matchesCategory;
    });
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDateStr(date);

    if (viewMode === 'month') {
      setSelectedWeekStart(date);
      setViewMode('week');
    } else if (viewMode === 'week') {
      setSelectedDate(dateStr);
      setViewMode('day');
    }
  };

  const handleBackClick = () => {
    if (viewMode === 'day') {
      setViewMode('week');
      setSelectedDate(null);
    } else if (viewMode === 'week') {
      setViewMode('month');
      setSelectedWeekStart(null);
    }
  };

  const toggleCategoryFilter = (categoryId: string) => {
    const newFilters = new Set(categoryFilters);
    if (newFilters.has(categoryId)) {
      newFilters.delete(categoryId);
    } else {
      newFilters.add(categoryId);
    }
    setCategoryFilters(newFilters);
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

  // Month View
  const renderMonthView = () => {
    const days = getMonthDays();
    const today = formatDateStr(new Date());

    return (
      <div className="calendar-month">
        <div className="calendar-month-header">
          <button onClick={() => navigateMonth(-1)} className="calendar-nav-btn">&lt;</button>
          <h2>{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
          <button onClick={() => navigateMonth(1)} className="calendar-nav-btn">&gt;</button>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-days">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="calendar-day empty" />;
            }

            const dateStr = formatDateStr(date);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = dateStr === today;
            const visibleEvents = dayEvents.slice(0, 2);
            const moreCount = dayEvents.length - 2;

            return (
              <div
                key={idx}
                className={`calendar-day ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(date)}
              >
                <span className="calendar-day-number">{date.getDate()}</span>
                {isToday && <span className="calendar-today-label">TODAY</span>}

                <div className="calendar-day-events">
                  {visibleEvents.map((event, eventIdx) => {
                    const category = event.category_id ? getCategoryById(event.category_id) : null;
                    return (
                      <div
                        key={eventIdx}
                        className="calendar-event-dot"
                        style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                        title={event.title}
                      />
                    );
                  })}
                </div>

                {moreCount > 0 && (
                  <div className="calendar-more">+{moreCount} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = selectedWeekStart || currentDate;
    const weekDays = getWeekDays(weekStart);
    const today = formatDateStr(new Date());
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="calendar-week">
        <div className="calendar-week-header">
          <button onClick={handleBackClick} className="calendar-back-btn">
            ← 월 보기
          </button>
          <h2>
            {weekDays[0].getMonth() + 1}월 {weekDays[0].getDate()}일 - {weekDays[6].getDate()}일
          </h2>
        </div>

        <div className="calendar-week-grid">
          {/* Time column */}
          <div className="calendar-time-column">
            <div className="calendar-time-header" />
            {hours.map(hour => (
              <div key={hour} className="calendar-time-slot">
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((date, dayIdx) => {
            const dateStr = formatDateStr(date);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = dateStr === today;

            return (
              <div
                key={dayIdx}
                className={`calendar-day-column ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(date)}
              >
                <div className="calendar-day-header">
                  <span className="calendar-day-name">{weekdays[dayIdx]}</span>
                  <span className={`calendar-day-date ${isToday ? 'today' : ''}`}>
                    {date.getDate()}
                  </span>
                </div>

                <div className="calendar-day-slots">
                  {hours.map(hour => (
                    <div key={hour} className="calendar-hour-slot" />
                  ))}

                  {/* Events */}
                  {dayEvents.map((event, eventIdx) => {
                    const category = event.category_id ? getCategoryById(event.category_id) : null;
                    const startHour = event.start_time
                      ? parseInt(event.start_time.split(':')[0])
                      : 9;
                    const endHour = event.end_time
                      ? parseInt(event.end_time.split(':')[0])
                      : startHour + 1;
                    const duration = endHour - startHour;

                    return (
                      <div
                        key={eventIdx}
                        className="calendar-week-event"
                        style={{
                          top: `${startHour * 60}px`,
                          height: `${duration * 60}px`,
                          backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        <div className="calendar-week-event-title">{event.title}</div>
                        <div className="calendar-week-event-time">
                          {event.start_time?.slice(0, 5)} - {event.end_time?.slice(0, 5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day View
  const renderDayView = () => {
    if (!selectedDate) return null;

    const date = new Date(selectedDate);
    const dayEvents = getEventsForDate(selectedDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="calendar-day-view">
        <div className="calendar-day-view-header">
          <button onClick={handleBackClick} className="calendar-back-btn">
            ← 주 보기
          </button>
          <h2>
            {date.getMonth() + 1}월 {date.getDate()}일 {weekdays[(date.getDay() + 6) % 7]}요일
          </h2>
          <button
            className="calendar-add-btn"
            onClick={() => onAddEvent(selectedDate)}
          >
            + 일정 추가
          </button>
        </div>

        <div className="calendar-day-schedule">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => {
              if (!e.start_time) return hour === 9; // Default to 9am
              return parseInt(e.start_time.split(':')[0]) === hour;
            });

            return (
              <div key={hour} className="calendar-hour-row">
                <div className="calendar-hour-label">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div className="calendar-hour-content">
                  {hourEvents.map((event, idx) => {
                    const category = event.category_id ? getCategoryById(event.category_id) : null;
                    return (
                      <div
                        key={idx}
                        className="calendar-day-event"
                        style={{ borderLeftColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="calendar-day-event-title">{event.title}</div>
                        <div className="calendar-day-event-time">
                          {event.start_time?.slice(0, 5)} - {event.end_time?.slice(0, 5)}
                        </div>
                        {event.location && (
                          <div className="calendar-day-event-location">{event.location}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-tab">
      {/* Category Filter Sidebar */}
      <aside className="calendar-sidebar">
        <div className="calendar-sidebar-header">
          <h3>My calendars</h3>
        </div>
        <div className="calendar-category-list">
          {categories.map(category => (
            <label key={category.id} className="calendar-category-item">
              <input
                type="checkbox"
                checked={categoryFilters.has(category.id)}
                onChange={() => toggleCategoryFilter(category.id)}
              />
              <span className="category-color" style={{ backgroundColor: category.color }} />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
      </aside>

      {/* Main Calendar Area */}
      <div className="calendar-main">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  );
};

export default CalendarTab;

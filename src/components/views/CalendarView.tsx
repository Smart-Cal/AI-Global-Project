import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useCategoryStore } from '../../store/categoryStore';
import { DEFAULT_CATEGORY_COLOR, type CalendarEvent } from '../../types';

type ViewMode = 'month' | 'week';

interface CalendarViewProps {
  onDateClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  selectedDate: string | null;
  onAddEvent: (date?: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  onDateClick,
  onEventClick,
  selectedDate,
  onAddEvent,
}) => {
  const { events, loadEvents } = useEventStore();
  const { categories, fetchCategories, getCategoryById } = useCategoryStore();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  // Selected category IDs (only checked ones are shown)
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    loadEvents();
    fetchCategories();
  }, []);

  // Select all categories by default when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !filtersInitialized) {
      setCategoryFilters(new Set(categories.map(c => c.id)));
      setFiltersInitialized(true);
    }
  }, [categories, filtersInitialized]);

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7;
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getWeekDays = (startDate: Date) => {
    const days: Date[] = [];
    const start = new Date(startDate);
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

  // Get default category ID
  const getDefaultCategoryId = () => {
    const defaultCat = categories.find(c => c.name === 'Default' || c.name === '기본');
    return defaultCat?.id;
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => {
      const matchesDate = e.event_date === dateStr;
      // Category filter check:
      // - If filter is not initialized, show all
      // - Events without category are treated as "Default" category
      // - If event has category, only show if included in filter
      if (!filtersInitialized) return matchesDate;

      const categoryId = e.category_id || getDefaultCategoryId();
      const matchesCategory = categoryId ? categoryFilters.has(categoryId) : true;
      return matchesDate && matchesCategory;
    });
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDateStr(date);
    onDateClick(dateStr);

    if (viewMode === 'month') {
      setSelectedWeekStart(date);
      setViewMode('week');
    } else if (viewMode === 'week') {
      // Add event to the clicked date in week view
      onAddEvent(dateStr);
    }
  };

  const handleBackClick = () => {
    if (viewMode === 'week') {
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

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const renderMonthView = () => {
    const days = getMonthDays();
    const today = formatDateStr(new Date());

    return (
      <div className="calendar-month">
        <div className="calendar-month-header">
          <button onClick={() => navigateMonth(-1)} className="calendar-nav-btn">&lt;</button>
          <h2>{currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</h2>
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

  // Convert time string (HH:MM) to minutes
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const renderWeekView = () => {
    const weekStart = selectedWeekStart || currentDate;
    const weekDays = getWeekDays(weekStart);
    const today = formatDateStr(new Date());
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="calendar-week">
        <div className="calendar-week-header">
          <button onClick={handleBackClick} className="calendar-back-btn">
            ← Month View
          </button>
          <h2>
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </h2>
        </div>

        <div className="calendar-week-grid">
          <div className="calendar-time-column">
            <div className="calendar-time-header" />
            {hours.map(hour => (
              <div key={hour} className="calendar-time-slot">
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

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

                  {dayEvents.map((event, eventIdx) => {
                    const category = event.category_id ? getCategoryById(event.category_id) : null;

                    // Calculate position and height precisely in 10-minute units
                    const startMinutes = event.start_time
                      ? timeToMinutes(event.start_time)
                      : 9 * 60; // Default 9am
                    const endMinutes = event.end_time
                      ? timeToMinutes(event.end_time)
                      : startMinutes + 60; // Default 1 hour
                    const durationMinutes = endMinutes - startMinutes;

                    // Ensure minimum height of 20px (about 20 minutes)
                    const height = Math.max(durationMinutes, 20);

                    return (
                      <div
                        key={eventIdx}
                        className="calendar-week-event"
                        style={{
                          top: `${startMinutes}px`,
                          height: `${height}px`,
                          backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        <div className="calendar-week-event-title">{event.title}</div>
                        {height >= 40 && (
                          <div className="calendar-week-event-time">
                            {event.start_time?.slice(0, 5)} - {event.end_time?.slice(0, 5)}
                          </div>
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
    <div className="calendar-view-container">
      {/* Category Sidebar */}
      <div className={`calendar-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
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
      </div>

      {/* Toggle sidebar button */}
      <button
        className="toggle-sidebar-btn calendar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? '◀' : '▶'}
      </button>

      <div className="calendar-main">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
      </div>
    </div>
  );
};

export default CalendarView;

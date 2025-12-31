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
  // 선택된 카테고리 ID 목록 (체크된 것만 보임)
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  useEffect(() => {
    loadEvents();
    fetchCategories();
  }, []);

  // 카테고리가 로드되면 모든 카테고리를 기본 선택
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

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => {
      const matchesDate = e.event_date === dateStr;
      // 카테고리 필터 체크:
      // - 필터가 초기화되지 않았으면 모두 표시
      // - 카테고리가 없는 일정은 항상 표시
      // - 카테고리가 있으면 필터에 포함된 경우만 표시
      let matchesCategory = true;
      if (filtersInitialized && e.category_id) {
        matchesCategory = categoryFilters.has(e.category_id);
      }
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
      // 주간 뷰에서 날짜 클릭 시 해당 날짜로 일정 추가
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

  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

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

  // 시간 문자열(HH:MM)을 분으로 변환
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
            ← 월 보기
          </button>
          <h2>
            {weekDays[0].getMonth() + 1}월 {weekDays[0].getDate()}일 - {weekDays[6].getDate()}일
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

                    // 10분 단위로 정밀하게 위치와 높이 계산
                    const startMinutes = event.start_time
                      ? timeToMinutes(event.start_time)
                      : 9 * 60; // 기본 9시
                    const endMinutes = event.end_time
                      ? timeToMinutes(event.end_time)
                      : startMinutes + 60; // 기본 1시간
                    const durationMinutes = endMinutes - startMinutes;

                    // 최소 높이 20px (약 20분) 보장
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
    <div className="calendar-view">
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

      <div className="calendar-main">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
      </div>
    </div>
  );
};

export default CalendarView;

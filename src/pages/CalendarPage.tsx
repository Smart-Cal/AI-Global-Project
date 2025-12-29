import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { EventModal, AIChatModal, DateEventsModal } from '../components';
import type { CalendarEvent } from '../types';

const CalendarPage: React.FC = () => {
  const { user } = useAuthStore();
  const { events, loadMonthEvents, selectedMonth, selectedYear, setMonth, setSelectedDate, getEventsByDate } = useEventStore();

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => {
    if (user?.id) {
      loadMonthEvents(user.id, selectedYear, selectedMonth);
    }
  }, [user?.id, selectedYear, selectedMonth, loadMonthEvents]);

  const calendarData = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    const lastDay = new Date(selectedYear, selectedMonth, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: string; day: number; events: CalendarEvent[] } | null> = [];

    // Empty cells for offset
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter((e) => e.event_date === dateStr);
      days.push({ date: dateStr, day: d, events: dayEvents });
    }

    return days;
  }, [selectedYear, selectedMonth, events]);

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setMonth(12, selectedYear - 1);
    } else {
      setMonth(selectedMonth - 1, selectedYear);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setMonth(1, selectedYear + 1);
    } else {
      setMonth(selectedMonth + 1, selectedYear);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setSelectedDate(dateStr);
    setDateModalOpen(true);
  };

  const handleAddEventFromDate = () => {
    setDateModalOpen(false);
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setDateModalOpen(false);
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div>
      {/* Calendar Navigation */}
      <div className="calendar-nav">
        <button onClick={goToPrevMonth}>◀</button>
        <span className="calendar-month">{selectedYear}년 {selectedMonth}월</span>
        <button onClick={goToNextMonth}>▶</button>
      </div>

      {/* Weekday Headers */}
      <div className="calendar-weekdays">
        {weekdays.map((day, i) => (
          <div
            key={day}
            className={`calendar-weekday ${i === 0 ? 'sunday' : ''} ${i === 6 ? 'saturday' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {calendarData.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="calendar-day empty" />;
          }

          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDateStr;
          const dayOfWeek = (index % 7);

          return (
            <div
              key={cell.date}
              className={`calendar-day ${isSelected ? 'selected' : ''}`}
              onClick={() => handleDateClick(cell.date)}
            >
              <div
                className={`day-number ${isToday ? 'today' : ''} ${dayOfWeek === 0 ? 'sunday' : ''} ${dayOfWeek === 6 ? 'saturday' : ''}`}
              >
                {cell.day}
              </div>
              <div className="day-events">
                {cell.events.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="day-event"
                    style={{ background: event.color }}
                  >
                    {event.title}
                  </div>
                ))}
                {cell.events.length > 3 && (
                  <div style={{ fontSize: '9px', color: '#666', textAlign: 'center' }}>
                    +{cell.events.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="section" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              setEditingEvent(null);
              setSelectedDateStr(todayStr);
              setEventModalOpen(true);
            }}
          >
            ➕ 새 일정
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setAiChatOpen(true)}
          >
            💬 AI 도우미
          </button>
        </div>
      </div>

      {/* Modals */}
      <DateEventsModal
        isOpen={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        date={selectedDateStr}
        events={getEventsByDate(selectedDateStr)}
        onAddEvent={handleAddEventFromDate}
        onEditEvent={handleEditEvent}
      />

      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        defaultDate={selectedDateStr || todayStr}
      />

      <AIChatModal
        isOpen={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
      />
    </div>
  );
};

export default CalendarPage;

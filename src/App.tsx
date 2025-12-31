import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import {
  Sidebar,
  Calendar,
  Dashboard,
  ChatPanel,
  GoalsView,
  TodosView,
  EventModal,
  EventDetailModal,
  GoalModal,
  TodoModal,
} from './components';
import AuthPage from './pages/AuthPage';
import { MenuIcon, PlusIcon, SparkleIcon } from './components/Icons';
import type { SidebarView, CalendarView, CalendarEvent, Goal } from './types';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>로딩 중...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<SidebarView>('dashboard');
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  // Modal states
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);

  // Editing states
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleViewChange = (view: SidebarView) => {
    setCurrentView(view);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setViewingEvent(event);
    setEventDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    if (viewingEvent) {
      setEditingEvent(viewingEvent);
      setEventDetailModalOpen(false);
      setViewingEvent(null);
      setEventModalOpen(true);
    }
  };

  const handleGoalClick = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalModalOpen(true);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  const handleAddGoal = () => {
    setEditingGoal(null);
    setGoalModalOpen(true);
  };

  const handleAddTodo = () => {
    setTodoModalOpen(true);
  };

  const handleOpenChat = () => {
    setChatPanelOpen(true);
  };

  const getContentTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return '대시보드';
      case 'calendar':
        return '캘린더';
      case 'goals':
        return '목표';
      case 'todos':
        return '할 일';
      default:
        return '';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onEventClick={handleEventClick}
            onGoalClick={handleGoalClick}
            onViewChange={(view) => setCurrentView(view)}
            onOpenChat={handleOpenChat}
          />
        );
      case 'calendar':
        return (
          <Calendar
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            selectedDate={selectedDate}
            view={calendarView}
            onViewChange={setCalendarView}
          />
        );
      case 'goals':
        return <GoalsView onAddGoal={handleAddGoal} />;
      case 'todos':
        return <TodosView onAddTodo={handleAddTodo} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAddGoal={handleAddGoal}
      />

      <main className="main-content">
        <header className="content-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon size={20} />
          </button>
          <h1 className="content-title">{getContentTitle()}</h1>
          <div className="content-actions">
            {currentView === 'calendar' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddEvent}>
                <PlusIcon size={14} /> 새 일정
              </button>
            )}
            {currentView === 'goals' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddGoal}>
                <PlusIcon size={14} /> 새 목표
              </button>
            )}
            {currentView === 'todos' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddTodo}>
                <PlusIcon size={14} /> 새 할 일
              </button>
            )}
            <button
              className={`btn ${chatPanelOpen ? 'btn-primary' : 'btn-secondary'} btn-sm btn-ai`}
              onClick={() => setChatPanelOpen(!chatPanelOpen)}
            >
              <SparkleIcon size={14} /> AI
            </button>
          </div>
        </header>

        <div className="content-body">
          <div style={{ flex: 1, overflow: 'auto' }}>{renderContent()}</div>

          {chatPanelOpen && (
            <div className="right-panel">
              <ChatPanel onClose={() => setChatPanelOpen(false)} />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <EventDetailModal
        isOpen={eventDetailModalOpen}
        onClose={() => {
          setEventDetailModalOpen(false);
          setViewingEvent(null);
        }}
        event={viewingEvent}
        onEdit={handleEditFromDetail}
      />

      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        defaultDate={selectedDate || undefined}
      />

      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        editingGoal={editingGoal}
      />

      <TodoModal
        isOpen={todoModalOpen}
        onClose={() => setTodoModalOpen(false)}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

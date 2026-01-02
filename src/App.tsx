import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import {
  Sidebar,
  Calendar,
  EventModal,
  EventDetailModal,
  GoalModal,
  TodoModal,
} from './components';
import AssistantView from './components/views/AssistantView';
import CalendarView from './components/views/CalendarView';
import ScheduleView from './components/views/ScheduleView';
import GoalView from './components/views/GoalView';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import { ToastProvider } from './components/Toast';
import SearchModal from './components/SearchModal';
import { MenuIcon, PlusIcon, SearchIcon } from './components/Icons';
import type { CalendarView as CalendarViewType, CalendarEvent, Goal } from './types';

// View types (기존 SidebarView 대체)
type AppView = 'assistant' | 'calendar' | 'schedule' | 'goal';

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
  const [currentView, setCurrentView] = useState<AppView>('assistant');
  const [calendarView, setCalendarView] = useState<CalendarViewType>('month');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal states
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // 키보드 단축키: Ctrl+K로 검색 모달 열기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Editing states
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleViewChange = (view: AppView) => {
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

  const handleAddEvent = (date?: string) => {
    setSelectedDate(date || null);
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


  const getContentTitle = () => {
    switch (currentView) {
      case 'assistant':
        return '비서';
      case 'calendar':
        return '캘린더';
      case 'schedule':
        return '일정';
      case 'goal':
        return 'Goal';
      default:
        return '';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'assistant':
        return <AssistantView />;
      case 'calendar':
        return (
          <CalendarView
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            selectedDate={selectedDate}
            onAddEvent={handleAddEvent}
          />
        );
      case 'schedule':
        return (
          <ScheduleView
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
            onAddTodo={handleAddTodo}
          />
        );
      case 'goal':
        return (
          <GoalView
            onGoalClick={handleGoalClick}
            onAddGoal={handleAddGoal}
          />
        );
      default:
        return null;
    }
  };

  // 사이드바용 뷰 매핑 (기존 SidebarView와 호환)
  const sidebarViewMap: Record<string, AppView> = {
    'dashboard': 'assistant',
    'calendar': 'calendar',
    'goals': 'goal',
    'todos': 'schedule',
  };

  const handleSidebarViewChange = (view: string) => {
    const mappedView = sidebarViewMap[view] || 'assistant';
    setCurrentView(mappedView);
  };

  // 현재 뷰를 사이드바 뷰로 변환
  const getSidebarView = () => {
    switch (currentView) {
      case 'assistant': return 'dashboard';
      case 'calendar': return 'calendar';
      case 'goal': return 'goals';
      case 'schedule': return 'todos';
      default: return 'dashboard';
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentView={getSidebarView() as any}
        onViewChange={handleSidebarViewChange as any}
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
            <button className="search-btn" onClick={() => setSearchModalOpen(true)}>
              <SearchIcon size={16} />
              <span>검색</span>
              <kbd>Ctrl+K</kbd>
            </button>
            {currentView === 'calendar' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleAddEvent()}>
                <PlusIcon size={14} /> 새 일정
              </button>
            )}
            {currentView === 'goal' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddGoal}>
                <PlusIcon size={14} /> 새 목표
              </button>
            )}
            {currentView === 'schedule' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddTodo}>
                <PlusIcon size={14} /> 새 할 일
              </button>
            )}
          </div>
        </header>

        <div className="content-body">
          <div style={{ flex: 1, overflow: 'auto' }}>{renderContent()}</div>
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

      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onEventClick={handleEventClick}
        onGoalClick={handleGoalClick}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
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
    </ToastProvider>
  );
};

export default App;

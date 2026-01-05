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
import NewDashboard from './components/views/NewDashboard';
import GroupsView from './components/views/GroupsView';
import GroupDetailView from './components/views/GroupDetailView';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import SearchModal from './components/SearchModal';
import Settings from './components/Settings';
import { MenuIcon, PlusIcon, SearchIcon } from './components/Icons';
import type { CalendarView as CalendarViewType, CalendarEvent, Goal } from './types';

// View types - added groups
type AppView = 'dashboard' | 'assistant' | 'calendar' | 'schedule' | 'goal' | 'groups' | 'group-detail';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const MainLayout: React.FC = () => {
  // Set default view to dashboard
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [calendarView, setCalendarView] = useState<CalendarViewType>('month');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [initialAssistantMessage, setInitialAssistantMessage] = useState<string | null>(null);

  // Modal states
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Keyboard shortcut: Ctrl+K to open search modal
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

  const handleViewChange = (view: AppView, message?: string) => {
    if (view === 'assistant' && message) {
      setInitialAssistantMessage(message);
    }
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

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    setCurrentView('group-detail');
  };

  const handleBackFromGroup = () => {
    setSelectedGroupId(null);
    setCurrentView('groups');
  };


  const getContentTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'assistant':
        return 'Assistant';
      case 'calendar':
        return 'Calendar';
      case 'schedule':
        return 'Schedule';
      case 'goal':
        return 'Goals';
      case 'groups':
        return 'Groups';
      case 'group-detail':
        return 'Group Detail';
      default:
        return '';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <NewDashboard
            onNavigate={handleViewChange}
          />
        );
      case 'assistant':
        return (
          <AssistantView
            initialMessage={initialAssistantMessage}
            onInitialMessageConsumed={() => setInitialAssistantMessage(null)}
          />
        );
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
      case 'groups':
        return (
          <GroupsView
            onGroupClick={handleGroupClick}
          />
        );
      case 'group-detail':
        return selectedGroupId ? (
          <GroupDetailView
            groupId={selectedGroupId}
            onBack={handleBackFromGroup}
          />
        ) : null;
      default:
        return null;
    }
  };

  // View mapping for Sidebar (Compatible with existing SidebarView)
  const sidebarViewMap: Record<string, AppView> = {
    'dashboard': 'dashboard',
    'assistant': 'assistant',
    'calendar': 'calendar',
    'goals': 'goal',
    'todos': 'schedule',
    'groups': 'groups',
  };

  const handleSidebarViewChange = (view: string) => {
    const mappedView = sidebarViewMap[view] || 'dashboard';
    setCurrentView(mappedView);
  };

  // Convert current view to sidebar view
  const getSidebarView = () => {
    switch (currentView) {
      case 'dashboard': return 'dashboard';
      case 'assistant': return 'assistant';
      case 'calendar': return 'calendar';
      case 'goal': return 'goals';
      case 'schedule': return 'todos';
      case 'groups':
      case 'group-detail':
        return 'groups';
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
        onOpenSettings={() => setSettingsModalOpen(true)}
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
              <span>Search</span>
              <kbd>Ctrl+K</kbd>
            </button>
            {currentView === 'calendar' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleAddEvent()}>
                <PlusIcon size={14} /> New Event
              </button>
            )}
            {currentView === 'goal' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddGoal}>
                <PlusIcon size={14} /> New Goal
              </button>
            )}
            {currentView === 'schedule' && (
              <button className="btn btn-primary btn-sm" onClick={handleAddTodo}>
                <PlusIcon size={14} /> New Todo
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

      <Settings
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ConfirmProvider>
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
      </ConfirmProvider>
    </ToastProvider>
  );
};

export default App;

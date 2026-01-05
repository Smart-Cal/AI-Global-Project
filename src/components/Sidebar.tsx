import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useCategoryStore } from '../store/categoryStore';
import { useSettingsStore } from '../store/settingsStore';
import type { SidebarView, Goal } from '../types';
import { getIcon, PlusIcon, CalendarIcon, ClockIcon } from './Icons';

// Check if goal is active
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
}

// Extract date from deadline
function getDeadlineDate(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  return deadline.split('T')[0];
}

interface SidebarProps {
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: () => void;
  onOpenChronotype?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  onAddGoal,
  onOpenChronotype,
}) => {
  const { user, logout } = useAuthStore();
  const { goals } = useGoalStore();
  const { todos } = useTodoStore();
  const { getCategoryById } = useCategoryStore();
  const { getChronotypeInfo } = useSettingsStore();

  const activeGoals = goals.filter(isGoalActive);
  const pendingTodos = todos.filter((t) => !t.is_completed);
  const overdueTodos = todos.filter((t) => {
    const deadlineDate = getDeadlineDate(t.deadline);
    if (t.is_completed || !deadlineDate) return false;
    return deadlineDate < new Date().toISOString().split('T')[0];
  });

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  const navItems = [
    { id: 'dashboard' as SidebarView, icon: 'home', label: 'Dashboard' },
    { id: 'assistant' as SidebarView, icon: 'sparkle', label: 'AI Assistant' },
    { id: 'calendar' as SidebarView, icon: 'calendar', label: 'Calendar' },
    { id: 'goals' as SidebarView, icon: 'target', label: 'Goals', badge: activeGoals.length || undefined },
    { id: 'todos' as SidebarView, icon: 'check', label: 'Todos', badge: pendingTodos.length || undefined },
    { id: 'groups' as SidebarView, icon: 'users', label: 'Groups' },
  ];

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><CalendarIcon size={20} /></div>
          <span className="sidebar-title">PALM</span>
        </div>

        <div className="sidebar-user" onClick={handleLogout}>
          <div className="user-avatar">{user?.nickname?.[0] || user?.name?.[0] || '?'}</div>
          <span className="user-name">{user?.nickname || user?.name}</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Menu</div>
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                onClick={() => {
                  onViewChange(item.id);
                  onClose();
                }}
              >
                <span className="nav-icon">{getIcon(item.icon, 18)}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && <span className="badge">{item.badge}</span>}
              </div>
            ))}
          </div>

          {overdueTodos.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title" style={{ color: '#E03E3E' }}>
                Overdue Todos ({overdueTodos.length})
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-goals">
          <div className="nav-section-title">My Goals</div>
          {activeGoals.slice(0, 5).map((goal) => {
            const category = goal.category_id ? getCategoryById(goal.category_id) : null;
            return (
              <div
                key={goal.id}
                className="goal-item"
                onClick={() => onViewChange('goals')}
              >
                <span
                  className="goal-icon"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: category?.color || '#9CA3AF',
                    display: 'inline-block',
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {goal.title}
                </span>
                <span className="goal-progress">{calculateGoalProgress(goal)}%</span>
              </div>
            );
          })}
          <button className="add-goal-btn" onClick={onAddGoal}>
            <PlusIcon size={14} />
            <span>Add New Goal</span>
          </button>
        </div>

        {/* Chronotype settings button */}
        {onOpenChronotype && (
          <div className="sidebar-settings">
            <button className="chronotype-btn" onClick={onOpenChronotype}>
              <span className="chronotype-icon">{getChronotypeInfo().icon}</span>
              <span className="chronotype-label">{getChronotypeInfo().label}</span>
              <ClockIcon size={14} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

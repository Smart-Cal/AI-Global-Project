import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useCategoryStore } from '../store/categoryStore';
import type { SidebarView } from '../types';
import { getIcon, PlusIcon, CalendarIcon } from './Icons';

interface SidebarProps {
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  onAddGoal,
}) => {
  const { user, logout } = useAuthStore();
  const { goals } = useGoalStore();
  const { todos } = useTodoStore();
  const { getCategoryById } = useCategoryStore();

  const activeGoals = goals.filter((g) => g.is_active);
  const pendingTodos = todos.filter((t) => !t.is_completed);
  const overdueTodos = todos.filter((t) => {
    if (t.is_completed || !t.due_date) return false;
    return t.due_date < new Date().toISOString().split('T')[0];
  });

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout();
    }
  };

  const navItems = [
    { id: 'dashboard' as SidebarView, icon: 'home', label: '비서' },
    { id: 'calendar' as SidebarView, icon: 'calendar', label: '캘린더' },
    { id: 'goals' as SidebarView, icon: 'target', label: '목표', badge: activeGoals.length || undefined },
    { id: 'todos' as SidebarView, icon: 'check', label: '할 일', badge: pendingTodos.length || undefined },
  ];

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><CalendarIcon size={20} /></div>
          <span className="sidebar-title">AI Calendar</span>
        </div>

        <div className="sidebar-user" onClick={handleLogout}>
          <div className="user-avatar">{user?.nickname?.[0] || user?.name?.[0] || '?'}</div>
          <span className="user-name">{user?.nickname || user?.name}</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">메뉴</div>
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
                지연된 할 일 ({overdueTodos.length})
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-goals">
          <div className="nav-section-title">내 목표</div>
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
                <span className="goal-progress">{goal.progress}%</span>
              </div>
            );
          })}
          <button className="add-goal-btn" onClick={onAddGoal}>
            <PlusIcon size={14} />
            <span>새 목표 추가</span>
          </button>
        </div>
      </aside>
    </>
  );
};

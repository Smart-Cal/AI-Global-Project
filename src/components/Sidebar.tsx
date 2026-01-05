import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useCategoryStore } from '../store/categoryStore';
import { useConfirm } from './ConfirmModal';
import type { SidebarView, Goal } from '../types';
import { getIcon, PlusIcon, CalendarIcon, SettingsIcon, SparkleIcon } from './Icons';

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
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  onAddGoal,
  onOpenSettings,
}) => {
  const { user, logout } = useAuthStore();
  const { goals } = useGoalStore();
  const { todos } = useTodoStore();
  const { getCategoryById } = useCategoryStore();
  const { confirm } = useConfirm();
  const [showPricingModal, setShowPricingModal] = useState(false);

  const activeGoals = goals.filter(isGoalActive);
  const pendingTodos = todos.filter((t) => !t.is_completed);
  const overdueTodos = todos.filter((t) => {
    const deadlineDate = getDeadlineDate(t.deadline);
    if (t.is_completed || !deadlineDate) return false;
    return deadlineDate < new Date().toISOString().split('T')[0];
  });

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log Out',
      confirmVariant: 'danger'
    });
    if (confirmed) {
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

        {/* Pricing Button */}
        <div className="sidebar-pricing">
          <button className="pricing-btn" onClick={() => setShowPricingModal(true)}>
            <SparkleIcon size={18} />
            <span>Upgrade Plan</span>
          </button>
        </div>

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

        {/* Settings button */}
        {onOpenSettings && (
          <div className="sidebar-settings">
            <button className="settings-btn" onClick={onOpenSettings}>
              <SettingsIcon size={18} />
              <span>Settings</span>
            </button>
          </div>
        )}
      </aside>

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-title">PALM Pricing</div>
              <button className="modal-close" onClick={() => setShowPricingModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                marginBottom: '20px'
              }}>
                <SparkleIcon size={32} style={{ color: 'white' }} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>
                Launch Period Special
              </h2>
              <div style={{
                display: 'inline-block',
                padding: '6px 16px',
                background: '#ECFDF5',
                color: '#059669',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '16px'
              }}>
                FREE
              </div>
              <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                Enjoy all premium features for free during our launch period!
                We'll notify you before any changes to pricing.
              </p>
              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: '#F9FAFB',
                borderRadius: '12px',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                  Included Features:
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6B7280', lineHeight: 1.8 }}>
                  <li>Unlimited AI Assistant usage</li>
                  <li>Google Calendar sync</li>
                  <li>Place & restaurant recommendations</li>
                  <li>Smart scheduling</li>
                  <li>Group collaboration</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowPricingModal(false)} style={{ width: '100%' }}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

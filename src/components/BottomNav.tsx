import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: '홈' },
  { path: '/calendar', label: '캘린더' },
  { path: '/schedule', label: '일정' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

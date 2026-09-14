import React from 'react';

export function Header({ user, onLogout, theme, onToggleTheme }) {
  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="nav-brand">
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤖</span>
              <span>AIRIS</span>
              <span className="brand-badge" style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px' }}>
                Talent Intelligence Suite
              </span>
            </a>
          </h2>
        </div>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a 
            href="/admin" 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Switch back to Classic Admin UI"
          >
            <span>🔄</span> Classic UI
          </a>

          <button 
            onClick={onToggleTheme} 
            className="theme-toggle-btn" 
            aria-label="Toggle dark mode" 
            title="Toggle theme"
            style={{ cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 10px' }}
          >
            <span className="theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          
          {user && (
            <span className="user-chip" style={{ fontSize: '0.85rem', padding: '4px 10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color, #4f46e5)', borderRadius: '9999px', fontWeight: 600 }}>
              👤 {user.name || user.email} ({user.role || 'Admin'})
            </span>
          )}

          <button 
            onClick={onLogout} 
            className="btn-secondary" 
            style={{ padding: '6px 14px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

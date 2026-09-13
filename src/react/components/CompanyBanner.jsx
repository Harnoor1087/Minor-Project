import React from 'react';

export function CompanyBanner({ company }) {
  if (!company) return null;

  return (
    <div 
      className="card" 
      style={{ 
        marginBottom: '2rem', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)', 
        border: '1px solid var(--border-color)', 
        padding: '1.5rem 2rem', 
        borderRadius: '16px' 
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div 
            style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '14px', 
              background: 'var(--bg-card)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '2rem', 
              border: '1px solid var(--border-color)', 
              boxShadow: 'var(--card-shadow)' 
            }}
          >
            {company.logo || '🏢'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>{company.name} Workspace</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                {company.industry || 'Technology'}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                🛡️ Firebase Firestore Cloud Synced
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              {company.tagline || 'Autonomous AI Screening & Integrity Proctoring'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a 
            href={company.slug ? `/company/${company.slug}` : '/companies'} 
            target="_blank" 
            rel="noreferrer"
            className="btn-primary" 
            style={{ fontSize: '0.88rem', padding: '0.5rem 1.15rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>🌐</span> View Public Careers Portal ➔
          </a>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="company-page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="company-page-action">{action}</div>}
    </header>
  );
}

export function SectionHeading({ title, detail }) {
  return (
    <div className="company-section-heading">
      <h2>{title}</h2>
      {detail && <span>{detail}</span>}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="company-empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

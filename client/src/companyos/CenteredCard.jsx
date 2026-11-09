import React from 'react';

export default function CenteredCard({ title, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        {title && <h1 className="text-xl font-bold text-center">{title}</h1>}
        {children}
      </div>
    </div>
  );
}

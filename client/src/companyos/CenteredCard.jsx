import React from 'react';

export default function CenteredCard({ title, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-7 sm:p-8 space-y-5">
        {title && <h1 className="text-2xl font-extrabold text-center tracking-tight">{title}</h1>}
        {children}
      </div>
    </div>
  );
}

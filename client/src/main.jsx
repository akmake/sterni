import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import { initDeviceInfo } from './utils/deviceInfo.js';
import { initBehaviorTracker } from './utils/behaviorTracker.js';

// ★ Pre-collect device info (battery, media devices) before any API calls
initDeviceInfo();

// ★ Track on-page engagement (scroll/clicks/active-time) — reports on page leave
initBehaviorTracker();

// Create a client for React Query
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="bottom-center" />
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// client/src/stores/authStore.js

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
// Import the injector function from api.js. Using a relative path for safety.
import { injectAuthStore } from '../utils/api';

const getInitialState = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const activeView = localStorage.getItem('activeView') || user?.preferredView || 'management';
    return { user, isAuthenticated: !!user, activeView };
  } catch (error) {
    return { user: null, isAuthenticated: false, activeView: 'management' };
  }
};

export const useAuthStore = create(
  devtools(
    (set, get) => ({
      ...getInitialState(),

      login: (userData) => {
        if (!userData || !userData._id) {
          console.error("Login action called with invalid user data:", userData);
          return;
        }
        localStorage.setItem('user', JSON.stringify(userData));
        const activeView = userData.preferredView || 'management';
        localStorage.setItem('activeView', activeView);
        set({ user: userData, isAuthenticated: true, activeView }, false, 'LOGIN_ACTION');
      },

      logout: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('activeView');
        set({ user: null, isAuthenticated: false, activeView: 'management' }, false, 'LOGOUT_ACTION');
      },

      setActiveView: (view) => {
        localStorage.setItem('activeView', view);
        set({ activeView: view }, false, 'SET_ACTIVE_VIEW');
      },

      toggleView: () => {
        const current = get().activeView;
        const next = current === 'household' ? 'management' : 'household';
        localStorage.setItem('activeView', next);
        set({ activeView: next }, false, 'TOGGLE_VIEW');
        return next;
      },

      updateUser: (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData }, false, 'UPDATE_USER');
      },
    }),
    { name: "Auth Store" }
  )
);

// --- THIS IS THE FIX ---
// After the store is created, we inject its API into the api.js module.
// This breaks the circular dependency.
injectAuthStore(useAuthStore.getState());

// We also subscribe to future changes, although it's less critical for login/logout
// which don't change at runtime.
useAuthStore.subscribe(state => {
  injectAuthStore(state);
});
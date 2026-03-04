import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket';
import { useAuthStore } from '../stores/authStore';

export default function useSocket() {
  const { isAuthenticated } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;

    connectSocket();
    initialized.current = true;

    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, [isAuthenticated]);

  return getSocket();
}

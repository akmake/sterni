import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { companyApi } from './companyApi';

const RETRY_MS = 3000;
const WORK_KEYS = ['tasks', 'projects', 'project', 'home'];
const CHAT_KEYS = ['conversations', 'conversation', 'home'];

// The socket carries only "something changed"; data is always refetched through
// the API, so what a user sees is still decided by the server's access checks.
export function useRealtime(orgId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = (keys) =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === 'company' && queryKey[1] === orgId && keys.includes(queryKey[2]),
      });
    const refreshChat = () => refresh(CHAT_KEYS);
    const refreshWork = () => refresh(WORK_KEYS);

    const socket = io('/company', { withCredentials: true });
    let retryTimer = null;

    const retry = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(async () => {
        try {
          // Any API call renews an expired session cookie before the socket retries.
          await companyApi.me();
        } catch {
          // Offline or logged out; the next attempt or the session guard handles it.
        }
        socket.connect();
      }, RETRY_MS);
    };

    socket.on('connect', () => {
      // Covers whatever arrived while disconnected, and any role change.
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] });
      refreshChat();
      refreshWork();
    });
    socket.on('connect_error', retry);
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') retry();
    });
    socket.on('work_changed', refreshWork);
    socket.on('message_new', refreshChat);
    socket.on('message_updated', refreshChat);
    socket.on('conversations_changed', refreshChat);
    socket.on('notification_new', () => refresh(['notifications']));
    socket.on('presence_changed', () => refresh(['members']));

    return () => {
      clearTimeout(retryTimer);
      socket.close();
    };
  }, [orgId, queryClient]);
}

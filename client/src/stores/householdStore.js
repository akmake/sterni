import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../utils/api';
import { getSocket, joinFamilyRoom } from '../utils/socket';

const useHouseholdStore = create(
  devtools(
    (set, get) => ({
      // Family
      family: null,
      familyLoading: false,

      // Shopping
      shoppingItems: [],
      shoppingLoading: false,

      // Household Tasks
      householdTasks: [],
      tasksLoading: false,

      // Expenses
      expenses: [],
      expensesLoading: false,
      expenseSummary: null,

      // ===== FAMILY =====
      fetchFamily: async () => {
        set({ familyLoading: true });
        try {
          const res = await api.get('/family/my');
          set({ family: res.data, familyLoading: false });
        } catch (err) {
          console.error(err);
          set({ familyLoading: false });
        }
      },

      createFamily: async (name) => {
        try {
          const res = await api.post('/family/create', { name });
          set({ family: res.data });
          joinFamilyRoom();
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      joinFamily: async (code) => {
        try {
          const res = await api.post('/family/join', { code });
          set({ family: res.data });
          joinFamilyRoom();
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      leaveFamily: async () => {
        try {
          await api.post('/family/leave');
          set({ family: null, shoppingItems: [], householdTasks: [], expenses: [] });
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      removeMember: async (memberId) => {
        try {
          const res = await api.delete(`/family/members/${memberId}`);
          set({ family: res.data });
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // ===== CATEGORIES =====
      addCategory: async (type, data) => {
        try {
          const res = await api.post(`/family/categories/${type}`, data);
          // Update the family object in store
          const family = get().family;
          if (!family) return;
          const fieldMap = { shopping: 'shoppingCategories', task: 'taskCategories', expense: 'expenseCategories' };
          const field = fieldMap[type];
          if (field) set({ family: { ...family, [field]: res.data } });
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      removeCategory: async (type, categoryId) => {
        try {
          const res = await api.delete(`/family/categories/${type}/${categoryId}`);
          const family = get().family;
          if (!family) return;
          const fieldMap = { shopping: 'shoppingCategories', task: 'taskCategories', expense: 'expenseCategories' };
          const field = fieldMap[type];
          if (field) set({ family: { ...family, [field]: res.data } });
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // ===== SHOPPING =====
      fetchShopping: async () => {
        set({ shoppingLoading: true });
        try {
          const res = await api.get('/shopping');
          set({ shoppingItems: res.data, shoppingLoading: false });
        } catch (err) {
          console.error(err);
          set({ shoppingLoading: false });
        }
      },

      addShoppingItem: async (item) => {
        try {
          const res = await api.post('/shopping', item);
          // Don't update state here - socket will handle it
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      toggleShoppingItem: async (id) => {
        try {
          const res = await api.patch(`/shopping/${id}/toggle`);
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      deleteShoppingItem: async (id) => {
        try {
          await api.delete(`/shopping/${id}`);
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      clearBoughtItems: async () => {
        try {
          await api.delete('/shopping/bought/clear');
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // ===== HOUSEHOLD TASKS =====
      fetchHouseholdTasks: async () => {
        set({ tasksLoading: true });
        try {
          const res = await api.get('/household-tasks');
          set({ householdTasks: res.data, tasksLoading: false });
        } catch (err) {
          console.error(err);
          set({ tasksLoading: false });
        }
      },

      addHouseholdTask: async (task) => {
        try {
          const res = await api.post('/household-tasks', task);
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      toggleHouseholdTask: async (id) => {
        try {
          const res = await api.patch(`/household-tasks/${id}/toggle`);
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      updateHouseholdTask: async (id, data) => {
        try {
          const res = await api.patch(`/household-tasks/${id}`, data);
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      deleteHouseholdTask: async (id) => {
        try {
          await api.delete(`/household-tasks/${id}`);
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // ===== EXPENSES =====
      fetchExpenses: async (month, year) => {
        set({ expensesLoading: true });
        try {
          const params = {};
          if (month && year) { params.month = month; params.year = year; }
          const res = await api.get('/expenses', { params });
          set({ expenses: res.data, expensesLoading: false });
        } catch (err) {
          console.error(err);
          set({ expensesLoading: false });
        }
      },

      addExpense: async (expense) => {
        try {
          const res = await api.post('/expenses', expense);
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      deleteExpense: async (id) => {
        try {
          await api.delete(`/expenses/${id}`);
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      fetchExpenseSummary: async (month, year) => {
        try {
          const params = {};
          if (month && year) { params.month = month; params.year = year; }
          const res = await api.get('/expenses/summary', { params });
          set({ expenseSummary: res.data });
        } catch (err) {
          console.error(err);
        }
      },

      // ===== SOCKET LISTENERS =====
      setupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;

        // Shopping real-time
        socket.on('shopping:added', (item) => {
          set(state => ({ shoppingItems: [item, ...state.shoppingItems] }));
        });
        socket.on('shopping:toggled', (item) => {
          set(state => ({
            shoppingItems: state.shoppingItems.map(i => i._id === item._id ? item : i)
          }));
        });
        socket.on('shopping:updated', (item) => {
          set(state => ({
            shoppingItems: state.shoppingItems.map(i => i._id === item._id ? item : i)
          }));
        });
        socket.on('shopping:deleted', (id) => {
          set(state => ({
            shoppingItems: state.shoppingItems.filter(i => i._id !== id)
          }));
        });
        socket.on('shopping:clearedBought', () => {
          set(state => ({
            shoppingItems: state.shoppingItems.filter(i => !i.isBought)
          }));
        });

        // Household tasks real-time
        socket.on('householdTask:added', (task) => {
          set(state => ({ householdTasks: [task, ...state.householdTasks] }));
        });
        socket.on('householdTask:toggled', (task) => {
          set(state => ({
            householdTasks: state.householdTasks.map(t => t._id === task._id ? task : t)
          }));
        });
        socket.on('householdTask:updated', (task) => {
          set(state => ({
            householdTasks: state.householdTasks.map(t => t._id === task._id ? task : t)
          }));
        });
        socket.on('householdTask:deleted', (id) => {
          set(state => ({
            householdTasks: state.householdTasks.filter(t => t._id !== id)
          }));
        });

        // Expenses real-time
        socket.on('expense:added', (expense) => {
          set(state => ({ expenses: [expense, ...state.expenses] }));
        });
        socket.on('expense:updated', (expense) => {
          set(state => ({
            expenses: state.expenses.map(e => e._id === expense._id ? expense : e)
          }));
        });
        socket.on('expense:deleted', (id) => {
          set(state => ({
            expenses: state.expenses.filter(e => e._id !== id)
          }));
        });
      },

      cleanupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;
        const events = [
          'shopping:added', 'shopping:toggled', 'shopping:updated', 'shopping:deleted', 'shopping:clearedBought',
          'householdTask:added', 'householdTask:toggled', 'householdTask:updated', 'householdTask:deleted',
          'expense:added', 'expense:updated', 'expense:deleted'
        ];
        events.forEach(e => socket.off(e));
      },
    }),
    { name: 'Household Store' }
  )
);

export default useHouseholdStore;

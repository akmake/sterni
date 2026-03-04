import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

const useFinanceStore = create(
  devtools(
    (set, get) => ({
      // === Dashboard ===
      dashboard: null,
      dashboardLoading: false,

      // === Transactions ===
      transactions: [],
      transactionsLoading: false,
      transactionsMeta: { total: 0, page: 1, pages: 1 },

      // === Categories ===
      categories: [],
      rules: [],
      categoriesLoading: false,

      // === Recurring ===
      recurring: [],
      recurringSummary: null,
      recurringLoading: false,

      // === Budget ===
      budget: null,
      budgetSpending: {},
      budgetExists: false,
      budgetLoading: false,

      // === Deposits ===
      deposits: [],
      depositsSummary: null,
      depositsLoading: false,

      // === Analytics ===
      analytics: null,
      insights: [],
      recommendations: [],
      analyticsLoading: false,

      // === Import ===
      parsedTransactions: [],
      unseenMerchants: [],
      importLoading: false,

      // ==================== DASHBOARD ====================
      fetchDashboard: async () => {
        set({ dashboardLoading: true });
        try {
          const res = await api.get('/finance/dashboard');
          set({ dashboard: res.data, dashboardLoading: false });
        } catch (err) {
          set({ dashboardLoading: false });
          throw err.response?.data || err;
        }
      },

      // ==================== TRANSACTIONS ====================
      fetchTransactions: async (params = {}) => {
        set({ transactionsLoading: true });
        try {
          const res = await api.get('/finance/transactions', { params });
          set({
            transactions: res.data.transactions,
            transactionsMeta: { total: res.data.total, page: res.data.page, pages: res.data.pages },
            transactionsLoading: false,
          });
        } catch (err) {
          set({ transactionsLoading: false });
          throw err.response?.data || err;
        }
      },

      addTransaction: async (data) => {
        const res = await api.post('/finance/transactions', data);
        return res.data;
      },

      updateTransaction: async (id, data) => {
        const res = await api.put(`/finance/transactions/${id}`, data);
        return res.data;
      },

      deleteTransaction: async (id) => {
        await api.delete(`/finance/transactions/${id}`);
      },

      deleteAllTransactions: async () => {
        await api.delete('/finance/transactions/all');
        set({ transactions: [] });
      },

      // ==================== CATEGORIES ====================
      fetchCategories: async () => {
        set({ categoriesLoading: true });
        try {
          const res = await api.get('/finance/categories');
          set({ categories: res.data, categoriesLoading: false });
        } catch (err) {
          set({ categoriesLoading: false });
          throw err.response?.data || err;
        }
      },

      createCategory: async (data) => {
        const res = await api.post('/finance/categories', data);
        set(s => ({ categories: [...s.categories, res.data] }));
        return res.data;
      },

      deleteCategory: async (id) => {
        await api.delete(`/finance/categories/${id}`);
        set(s => ({ categories: s.categories.filter(c => c._id !== id) }));
      },

      syncCategories: async () => {
        const res = await api.post('/finance/categories/sync');
        set({ categories: res.data.categories });
      },

      fetchRules: async () => {
        const res = await api.get('/finance/categories/rules');
        set({ rules: res.data });
      },

      createRule: async (data) => {
        const res = await api.post('/finance/categories/rules', data);
        set(s => ({ rules: [...s.rules, res.data] }));
        return res.data;
      },

      deleteRule: async (id) => {
        await api.delete(`/finance/categories/rules/${id}`);
        set(s => ({ rules: s.rules.filter(r => r._id !== id) }));
      },

      applyRules: async () => {
        const res = await api.post('/finance/categories/rules/apply');
        return res.data;
      },

      // ==================== RECURRING ====================
      fetchRecurring: async () => {
        set({ recurringLoading: true });
        try {
          const res = await api.get('/finance/recurring');
          set({
            recurring: res.data.transactions,
            recurringSummary: res.data.summary,
            recurringLoading: false,
          });
        } catch (err) {
          set({ recurringLoading: false });
          throw err.response?.data || err;
        }
      },

      addRecurring: async (data) => {
        const res = await api.post('/finance/recurring', data);
        return res.data;
      },

      updateRecurring: async (id, data) => {
        const res = await api.put(`/finance/recurring/${id}`, data);
        return res.data;
      },

      deleteRecurring: async (id) => {
        await api.delete(`/finance/recurring/${id}`);
        set(s => ({ recurring: s.recurring.filter(r => r._id !== id) }));
      },

      toggleRecurring: async (id) => {
        const res = await api.patch(`/finance/recurring/${id}/toggle`);
        set(s => ({ recurring: s.recurring.map(r => r._id === id ? res.data : r) }));
        return res.data;
      },

      detectPatterns: async () => {
        const res = await api.get('/finance/recurring/detect');
        return res.data;
      },

      getCashflow: async (months) => {
        const res = await api.get('/finance/recurring/cashflow', { params: { months } });
        return res.data;
      },

      // ==================== BUDGET ====================
      fetchBudget: async (month, year) => {
        set({ budgetLoading: true });
        try {
          const res = await api.get('/finance/budgets', { params: { month, year } });
          set({
            budget: res.data.budget,
            budgetSpending: res.data.spending || {},
            budgetExists: res.data.exists,
            budgetLoading: false,
          });
        } catch (err) {
          set({ budgetLoading: false });
          throw err.response?.data || err;
        }
      },

      upsertBudget: async (data) => {
        const res = await api.post('/finance/budgets', data);
        set({ budget: res.data, budgetExists: true });
        return res.data;
      },

      deleteBudget: async (id) => {
        await api.delete(`/finance/budgets/${id}`);
        set({ budget: null, budgetExists: false });
      },

      copyBudget: async (data) => {
        const res = await api.post('/finance/budgets/copy', data);
        return res.data;
      },

      getBudgetSummary: async (year) => {
        const res = await api.get('/finance/budgets/summary', { params: { year } });
        return res.data;
      },

      // ==================== DEPOSITS ====================
      fetchDeposits: async () => {
        set({ depositsLoading: true });
        try {
          const res = await api.get('/finance/deposits');
          set({
            deposits: res.data.deposits,
            depositsSummary: res.data.summary,
            depositsLoading: false,
          });
        } catch (err) {
          set({ depositsLoading: false });
          throw err.response?.data || err;
        }
      },

      addDeposit: async (data) => {
        const res = await api.post('/finance/deposits', data);
        return res.data;
      },

      updateDeposit: async (id, data) => {
        const res = await api.put(`/finance/deposits/${id}`, data);
        set(s => ({ deposits: s.deposits.map(d => d._id === id ? res.data : d) }));
        return res.data;
      },

      breakDeposit: async (id) => {
        const res = await api.post(`/finance/deposits/${id}/break`);
        set(s => ({ deposits: s.deposits.map(d => d._id === id ? res.data : d) }));
        return res.data;
      },

      matureDeposit: async (id) => {
        const res = await api.post(`/finance/deposits/${id}/mature`);
        set(s => ({ deposits: s.deposits.map(d => d._id === id ? res.data : d) }));
        return res.data;
      },

      deleteDeposit: async (id) => {
        await api.delete(`/finance/deposits/${id}`);
        set(s => ({ deposits: s.deposits.filter(d => d._id !== id) }));
      },

      // ==================== ANALYTICS ====================
      fetchAnalytics: async (months = 6) => {
        set({ analyticsLoading: true });
        try {
          const res = await api.get('/finance/analytics', { params: { months } });
          set({ analytics: res.data, analyticsLoading: false });
        } catch (err) {
          set({ analyticsLoading: false });
          throw err.response?.data || err;
        }
      },

      fetchInsights: async () => {
        const res = await api.get('/finance/analytics/insights');
        set({ insights: res.data });
      },

      fetchRecommendations: async () => {
        const res = await api.get('/finance/analytics/recommendations');
        set({ recommendations: res.data });
      },

      // ==================== IMPORT ====================
      parseImport: async (data, fileType) => {
        set({ importLoading: true });
        try {
          const res = await api.post('/finance/import/parse', { data, fileType });
          set({
            parsedTransactions: res.data.transactions,
            unseenMerchants: res.data.unseenMerchants,
            importLoading: false,
          });
          return res.data;
        } catch (err) {
          set({ importLoading: false });
          throw err.response?.data || err;
        }
      },

      processImport: async (transactions) => {
        set({ importLoading: true });
        try {
          const res = await api.post('/finance/import/process', { transactions });
          set({ parsedTransactions: [], unseenMerchants: [], importLoading: false });
          return res.data;
        } catch (err) {
          set({ importLoading: false });
          throw err.response?.data || err;
        }
      },

      // ==================== SOCKET ====================
      setupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;

        // Transactions
        socket.on('finance:transaction:added', (t) => {
          set(s => ({ transactions: [t, ...s.transactions] }));
        });
        socket.on('finance:transaction:updated', (t) => {
          set(s => ({ transactions: s.transactions.map(x => x._id === t._id ? t : x) }));
        });
        socket.on('finance:transaction:deleted', (id) => {
          set(s => ({ transactions: s.transactions.filter(x => x._id !== id) }));
        });
        socket.on('finance:transactions:cleared', () => {
          set({ transactions: [] });
        });

        // Categories
        socket.on('finance:category:added', (c) => {
          set(s => ({ categories: [...s.categories, c] }));
        });
        socket.on('finance:category:deleted', (id) => {
          set(s => ({ categories: s.categories.filter(x => x._id !== id) }));
        });

        // Recurring
        socket.on('finance:recurring:added', (r) => {
          set(s => ({ recurring: [r, ...s.recurring] }));
        });
        socket.on('finance:recurring:updated', (r) => {
          set(s => ({ recurring: s.recurring.map(x => x._id === r._id ? r : x) }));
        });
        socket.on('finance:recurring:deleted', (id) => {
          set(s => ({ recurring: s.recurring.filter(x => x._id !== id) }));
        });

        // Budget
        socket.on('finance:budget:updated', (b) => {
          set({ budget: b, budgetExists: true });
        });
        socket.on('finance:budget:deleted', () => {
          set({ budget: null, budgetExists: false });
        });

        // Deposits
        socket.on('finance:deposit:added', (d) => {
          set(s => ({ deposits: [...s.deposits, d] }));
        });
        socket.on('finance:deposit:updated', (d) => {
          set(s => ({ deposits: s.deposits.map(x => x._id === d._id ? d : x) }));
        });
        socket.on('finance:deposit:deleted', (id) => {
          set(s => ({ deposits: s.deposits.filter(x => x._id !== id) }));
        });

        // Import
        socket.on('finance:import:completed', () => {
          get().fetchDashboard();
          get().fetchTransactions();
        });
      },

      cleanupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;
        [
          'finance:transaction:added', 'finance:transaction:updated',
          'finance:transaction:deleted', 'finance:transactions:cleared',
          'finance:category:added', 'finance:category:deleted',
          'finance:recurring:added', 'finance:recurring:updated', 'finance:recurring:deleted',
          'finance:budget:updated', 'finance:budget:deleted',
          'finance:deposit:added', 'finance:deposit:updated', 'finance:deposit:deleted',
          'finance:import:completed',
        ].forEach(e => socket.off(e));
      },
    }),
    { name: 'Finance Store' }
  )
);

export default useFinanceStore;

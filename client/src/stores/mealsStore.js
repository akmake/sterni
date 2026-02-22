import { create } from 'zustand';
import api from '../api';

const useMealsStore = create((set, get) => ({
  meals: [],
  loading: false,
  error: null,

  // Fetch all meals
  fetchMeals: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/meals');
      set({ meals: response.data.data?.meals || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Get meal by ID
  getMealById: (id) => get().meals.find((m) => m._id === id),

  // Get meal by key
  getMealByKey: (key) => get().meals.find((m) => m.key === key),

  // Create meal
  createMeal: async (mealData) => {
    try {
      await api.post('/meals', mealData);
      await set({ loading: true });
      const response = await api.get('/meals');
      set({ meals: response.data.data?.meals || [], loading: false });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Update meal
  updateMeal: async (id, mealData) => {
    try {
      await api.patch(`/meals/${id}`, mealData);
      const response = await api.get('/meals');
      set({ meals: response.data.data?.meals || [] });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Delete meal
  deleteMeal: async (id) => {
    try {
      await api.delete(`/meals/${id}`);
      const response = await api.get('/meals');
      set({ meals: response.data.data?.meals || [] });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useMealsStore;

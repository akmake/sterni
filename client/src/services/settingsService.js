import api from '@/utils/api'; // הנחת עבודה: יש לך axios מוגדר

export const getAccounts = async () => {
  const { data } = await api.get('/settings/accounts');
  return data;
};

export const saveAccount = async (accountData) => {
  const { data } = await api.post('/settings/account', accountData);
  return data;
};

export const testConnection = async (accountData) => {
  const { data } = await api.post('/settings/test-connection', accountData);
  return data;
};

export const getSystemConfig = async () => {
  const { data } = await api.get('/settings/config');
  return data;
};

export const updateRouting = async (routingData) => {
  const { data } = await api.post('/settings/routing', routingData);
  return data;
};
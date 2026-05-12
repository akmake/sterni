import api from '@/utils/api'; // הנחת עבודה: יש לך axios מוגדר

export const getAccounts = async () => {
  const { data } = await api.get('/settings/accounts');
  return data;
};

export const getAccountPassword = async (id) => {
  const { data } = await api.get(`/settings/accounts/${id}/password`);
  return data.password;
};

export const deleteAccount = async (id) => {
  const { data } = await api.delete(`/settings/account/${id}`);
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

export const getQuoteTemplate = async () => {
  const { data } = await api.get('/settings/quote-template');
  return data;
};

export const updateQuoteTemplate = async (templateData) => {
  const { data } = await api.post('/settings/quote-template', templateData);
  return data;
};

export const getQuoteTemplates = async () => {
  const { data } = await api.get('/settings/quote-templates');
  return data;
};

export const createQuoteTemplate = async (templateData) => {
  const { data } = await api.post('/settings/quote-templates', templateData);
  return data;
};

export const updateQuoteTemplateById = async (id, templateData) => {
  const { data } = await api.put(`/settings/quote-templates/${id}`, templateData);
  return data;
};

export const deleteQuoteTemplateById = async (id) => {
  const { data } = await api.delete(`/settings/quote-templates/${id}`);
  return data;
};

export const activateQuoteTemplateById = async (id) => {
  const { data } = await api.post(`/settings/quote-templates/${id}/activate`);
  return data;
};

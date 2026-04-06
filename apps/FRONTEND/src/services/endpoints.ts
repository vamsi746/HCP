import api from './api';

// Auth
export const login = (badgeNumber: string, password: string) =>
  api.post('/auth/login', { badgeNumber, password });

export const logout = () => api.post('/auth/logout');

export const fetchMe = () => api.get('/auth/me');

// Officers
export const getOfficers = (params?: Record<string, unknown>) =>
  api.get('/officers', { params });

export const getOfficer = (id: string) => api.get(`/officers/${id}`);

export const createOfficer = (data: Record<string, unknown>) =>
  api.post('/officers', data);

export const updateOfficer = (id: string, data: Record<string, unknown>) =>
  api.put(`/officers/${id}`, data);

export const deleteOfficer = (id: string) =>
  api.delete(`/officers/${id}`);

// DSR
export const getDSRs = (params?: Record<string, unknown>) =>
  api.get('/dsr', { params });

export const uploadDSR = (formData: FormData) =>
  api.post('/dsr/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getDSRStats = () => api.get('/dsr/stats');

// Cases
export const getCases = (params?: Record<string, unknown>) =>
  api.get('/cases', { params });

export const createCase = (data: Record<string, unknown>) =>
  api.post('/cases', data);

export const getCaseStats = (type: string) => api.get(`/cases/stats/${type}`);

// Violations
export const getViolations = (params?: Record<string, unknown>) =>
  api.get('/violations', { params });

export const exemptViolation = (id: string, reason: string) =>
  api.post(`/violations/${id}/exempt`, { reason });

// Actions
export const getActions = (params?: Record<string, unknown>) =>
  api.get('/actions', { params });

export const createAction = (data: Record<string, unknown>) =>
  api.post('/actions', data);

// Appeals
export const getAppeals = (params?: Record<string, unknown>) =>
  api.get('/appeals', { params });

export const submitAppeal = (data: Record<string, unknown>) =>
  api.post('/appeals', data);

// Zones
export const getZones = () => api.get('/zones');
export const getHierarchy = () => api.get('/zones/hierarchy');

// Reports
export const getDashboard = () => api.get('/reports/dashboard');
export const getBottomPerformers = () => api.get('/reports/bottom-performers');
export const getTopPerformers = () => api.get('/reports/top-performers');
export const getZoneComparison = () => api.get('/reports/zone-comparison');

// Mapping
export const getMappingHierarchy = () => api.get('/mapping/hierarchy');
export const getOfficerWarnings = () => api.get('/mapping/officer-warnings');
export const getGISData = () => api.get('/mapping/gis');

// Police Stations (for dropdowns)
export const getPoliceStations = () => api.get('/zones/stations');

import api from './api';

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

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

export const reassignOfficerSector = (id: string, sectorId: string) =>
  api.put(`/officers/${id}/reassign-sector`, { sectorId, role: 'PRIMARY_SI' });

// Officer Memo Tracker
export const getOfficerMemoTracker = (params?: Record<string, unknown>) =>
  api.get('/officers/memo-tracker', { params });

export const getOfficerMemos = (officerId: string) =>
  api.get(`/officers/memo-tracker/${officerId}/memos`);

// Violations
export const getViolations = (params?: Record<string, unknown>) =>
  api.get('/violations', { params });

export const exemptViolation = (id: string, reason: string) =>
  api.post(`/violations/${id}/exempt`, { reason });

export const updateViolation = (id: string, data: Record<string, unknown>) =>
  api.put(`/violations/${id}`, data);

export const deleteViolation = (id: string) =>
  api.delete(`/violations/${id}`);

// Cases
export const getCases = (params?: Record<string, unknown>) =>
  api.get('/cases', { params });

export const createCase = (data: Record<string, unknown>) =>
  api.post('/cases', data);

export const updateCase = (id: string, data: Record<string, unknown>) =>
  api.put(`/cases/${id}`, data);

export const deleteCase = (id: string) =>
  api.delete(`/cases/${id}`);

export const getCaseStats = (type: string) => api.get(`/cases/stats/${type}`);

// Actions
export const getActions = (params?: Record<string, unknown>) =>
  api.get('/actions', { params });

export const createAction = (data: Record<string, unknown>) =>
  api.post('/actions', data);

export const updateAction = (id: string, data: Record<string, unknown>) =>
  api.put(`/actions/${id}`, data);

export const deleteAction = (id: string) =>
  api.delete(`/actions/${id}`);

// Appeals
export const getAppeals = (params?: Record<string, unknown>) =>
  api.get('/appeals', { params });

export const submitAppeal = (data: Record<string, unknown>) =>
  api.post('/appeals', data);

export const updateAppeal = (id: string, data: Record<string, unknown>) =>
  api.put(`/appeals/${id}`, data);

export const deleteAppeal = (id: string) =>
  api.delete(`/appeals/${id}`);

// DSR
export const getDSRs = (params?: Record<string, unknown>) =>
  api.get('/dsr', { params });

export const getDSR = (id: string) => api.get(`/dsr/${id}`);

export const getDSRDocument = (id: string) => api.get(`/dsr/${id}/document`);

export const downloadDSRFile = (id: string) =>
  api.get(`/dsr/${id}/download`, { responseType: 'arraybuffer' });

export const getDSRDownloadUrl = (id: string) =>
  `${api.defaults.baseURL}/dsr/${id}/download`;

export const reparseDSR = (id: string) => api.post(`/dsr/${id}/reparse`);

export const uploadDSR = (formData: FormData) =>
  api.post('/dsr/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getDSRStats = () => api.get('/dsr/stats/summary');


export const updateDSR = (id: string, data: Record<string, unknown>) =>
  api.put(`/dsr/${id}`, data);

export const deleteDSR = (id: string) =>
  api.delete(`/dsr/${id}`);

// Memos
export const generateMemo = (data: { dsrId: string; caseId: string }) =>
  api.post('/memos/generate', data);

export const getMemos = (params?: Record<string, unknown>) =>
  api.get('/memos', { params });

export const getMemoCounts = (params?: Record<string, unknown>) =>
  api.get('/memos/counts', { params });

export const getMemo = (id: string) => api.get(`/memos/${id}`);

export const updateMemo = (id: string, data: Record<string, unknown>) =>
  api.put(`/memos/${id}`, data);

export const submitMemoForReview = (id: string) =>
  api.put(`/memos/${id}/submit`);

export const assignMemoRecipient = (id: string, data: { recipientType: string; recipientId: string }) =>
  api.put(`/memos/${id}/assign`, data);

export const approveMemo = (id: string) =>
  api.put(`/memos/${id}/approve`);

export const holdMemo = (id: string, remarks?: string) =>
  api.put(`/memos/${id}/hold`, { remarks });

export const rejectMemo = (id: string, remarks?: string) =>
  api.put(`/memos/${id}/reject`, { remarks });

export const deleteMemo = (id: string) =>
  api.delete(`/memos/${id}`);

export const getCaseOfficers = (psId: string) =>
  api.get(`/memos/case-officers/${psId}`);

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

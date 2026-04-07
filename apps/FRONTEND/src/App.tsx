import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './store';
import { fetchMe } from './store/authSlice';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Officers from './pages/Officers';
import OfficerDetail from './pages/OfficerDetail';
import DSRList from './pages/DSR/List';
import DSRUpload from './pages/DSR/Upload';
import DSRDetail from './pages/DSR/Detail';
import Cases from './pages/Cases';
import Violations from './pages/Violations';
import Actions from './pages/Actions';
import Appeals from './pages/Appeals';
import Reports from './pages/Reports';
import Mapping from './pages/Mapping';
import GIS from './pages/GIS';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useSelector((s: RootState) => s.auth);
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/officers" element={<Officers />} />
          <Route path="/officers/:id" element={<OfficerDetail />} />
          <Route path="/dsr" element={<DSRList />} />
          <Route path="/dsr/upload" element={<DSRUpload />} />
          <Route path="/dsr/:id" element={<DSRDetail />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/appeals" element={<Appeals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/mapping" element={<Mapping />} />
          <Route path="/gis" element={<GIS />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

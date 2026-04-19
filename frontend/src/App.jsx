import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchMe } from "./store/authSlice";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Officers from "./pages/Officers";
import OfficerDetail from "./pages/OfficerDetail";
import DSRList from "./pages/DSR/List";
import DSRUpload from "./pages/DSR/Upload";
import DSRDetail from "./pages/DSR/Detail";
import MemoList from "./pages/Memos/List";
import MemoEditorPage from "./pages/Memos/Editor";
import Actions from "./pages/Actions";
import Reports from "./pages/Reports";
import Mapping from "./pages/Mapping";
import GIS from "./pages/GIS";
import Review from "./pages/Review";
import OfficerTracker from "./pages/OfficerTracker";
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useSelector((s) => s.auth);
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
const CommissionerGuard = ({ children }) => {
  const user = useSelector((s) => s.auth.user);
  if (user?.rank === "COMMISSIONER") return <Navigate to="/review" replace />;
  return <>{children}</>;
};
const App = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);
  return <BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route
    element={<ProtectedRoute><Layout /></ProtectedRoute>}
  ><Route path="/" element={<CommissionerGuard><Dashboard /></CommissionerGuard>} /><Route path="/officers" element={<CommissionerGuard><Officers /></CommissionerGuard>} /><Route path="/officers/:id" element={<CommissionerGuard><OfficerDetail /></CommissionerGuard>} /><Route path="/officer-tracker" element={<CommissionerGuard><OfficerTracker /></CommissionerGuard>} /><Route path="/dsr" element={<CommissionerGuard><DSRList /></CommissionerGuard>} /><Route path="/dsr/upload" element={<CommissionerGuard><DSRUpload /></CommissionerGuard>} /><Route path="/dsr/:id" element={<CommissionerGuard><DSRDetail /></CommissionerGuard>} /><Route path="/memos" element={<CommissionerGuard><MemoList /></CommissionerGuard>} /><Route path="/memos/:id" element={<CommissionerGuard><MemoEditorPage /></CommissionerGuard>} /><Route path="/actions" element={<CommissionerGuard><Actions /></CommissionerGuard>} /><Route path="/reports" element={<CommissionerGuard><Reports /></CommissionerGuard>} /><Route path="/review" element={<Review />} /><Route path="/mapping" element={<CommissionerGuard><Mapping /></CommissionerGuard>} /><Route path="/gis" element={<CommissionerGuard><GIS /></CommissionerGuard>} /></Route></Routes></BrowserRouter>;
};
export default App;

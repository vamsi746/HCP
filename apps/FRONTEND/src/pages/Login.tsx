import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { login } from '../store/authSlice';
import { AppDispatch, RootState } from '../store';

const Login: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ badgeNumber, password }));
    if (login.fulfilled.match(result)) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="border border-slate-200 bg-white w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 pt-5 pb-4 border-l-4 border-amber-500">
          <div className="flex flex-col items-center">
            <Shield size={48} className="text-amber-400 mb-3" />
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">SHIELD — HCP</h1>
            <p className="text-[11px] text-blue-200 mt-1">Hyderabad City Police</p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 mb-4 text-sm border border-red-200">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Badge Number</label>
              <input
                type="text"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className="w-full border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="HCP-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 w-full text-white font-bold uppercase tracking-wider py-2.5 transition disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

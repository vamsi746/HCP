import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/authSlice';
import { AppDispatch, RootState } from '../store';
import policeLogo from '../public/policelogo.jpg';

const Login: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#003366] relative flex-col items-center justify-center px-12">
        {/* Diagonal accent */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 top-0 bottom-0 w-64 bg-[#002244] skew-x-[-6deg]" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#B8860B]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <img
            src={policeLogo}
            alt="Hyderabad City Police"
            className="w-32 h-32 rounded-full border-[5px] border-[#B8860B] shadow-2xl object-cover"
          />
          <h1 className="text-3xl font-extrabold text-white mt-6 tracking-tight">SHIELD</h1>
          <div className="w-12 h-1 bg-[#B8860B] rounded-full mt-3 mb-3" />
          <p className="text-lg text-blue-200 font-medium">Hyderabad City Police</p>
        </div>

        <p className="absolute bottom-5 text-blue-300/30 text-xs z-10">
          © {new Date().getFullYear()} Hyderabad City Police
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo (hidden on lg) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img
              src={policeLogo}
              alt="Hyderabad City Police"
              className="w-20 h-20 rounded-full border-4 border-[#B8860B] shadow-lg object-cover"
            />
            <h1 className="text-lg font-bold text-[#003366] mt-3">SHIELD — HCP</h1>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 mb-6 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] focus:outline-none transition placeholder:text-slate-400"
                placeholder="officer@hcp.gov.in"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] focus:outline-none transition placeholder:text-slate-400"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003366] hover:bg-[#00264d] text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

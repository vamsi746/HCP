import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { logout } from '../store/authSlice';
import { useNavigate } from 'react-router-dom';
import logoImg from '../public/default-logo.png';
import policeLogo from '../public/policelogo.jpg';

const Header: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <header className="bg-primary-500 text-white h-14 sm:h-16 md:h-20 flex items-center justify-between px-3 sm:px-4 shadow-lg">
      <div className="flex items-center gap-2 sm:gap-3">
        <img src={policeLogo} alt="Hyderabad City Police" className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full object-cover" />
        <span className="text-lg font-bold tracking-wide hidden sm:inline">SHIELD — HCP</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="hidden sm:flex items-center gap-2 border-r border-white/20 pr-4">
          <img src={logoImg} alt="Blue Cloud Softech Solutions" className="h-11 brightness-110 drop-shadow-[0_1px_3px_rgba(255,255,255,0.2)]" />
        </div>
        {user && (
          <span className="text-sm hidden sm:inline">
            {user.rank === 'COMMISSIONER' ? 'CP' : `${user.name} (${user.rank})`}
          </span>
        )}
        <button onClick={handleLogout} className="p-2 hover:bg-primary-600 rounded" title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;

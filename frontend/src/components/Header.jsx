import { useSelector, useDispatch } from "react-redux";
import { LogOut } from "lucide-react";
import { logout } from "../store/authSlice";
import { useNavigate } from "react-router-dom";
import logoImg from "../assets/default-logo.png";
import policeLogo from "../assets/policelogo.jpg";
const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };
  return (
    <header className="relative bg-primary-500 text-white h-14 sm:h-16 md:h-20 flex items-center justify-between px-3 sm:px-4 shadow-lg overflow-hidden isolate">
      <video
        className="absolute inset-0 w-full h-full object-cover -z-20 motion-reduce:hidden"
        src="/header-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-500/95 via-primary-500/70 to-primary-500/95 backdrop-blur-[1px]" aria-hidden="true" />
      <div className="flex items-center gap-2 sm:gap-3">
        <img src={policeLogo} alt="Hyderabad City Police" className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full object-cover" />
        <span className="text-lg font-bold tracking-wide hidden sm:inline drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Hyderabad City Police</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="hidden sm:flex items-center gap-2 border-r border-white/20 pr-4">
          <img src={logoImg} alt="Blue Cloud Softech Solutions" className="h-11 brightness-110 drop-shadow-[0_1px_3px_rgba(255,255,255,0.2)]" />
        </div>
        {user && <span className="text-sm hidden sm:inline drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{user.rank === "COMMISSIONER" ? "CP" : `${user.name} (${user.rank})`}</span>}
        <button onClick={handleLogout} className="p-2 hover:bg-primary-600/70 rounded" title="Logout"><LogOut size={18} /></button>
      </div>
    </header>
  );
};
export default Header;

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { getMemos } from '../services/endpoints';
import { RootState } from '../store';
import {
  LayoutDashboard,
  Users,
  FileText,
  Gavel,
  Map,
  ClipboardList,
  Eye,
  ShieldCheck,
  UserSearch,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600', text: 'text-blue-600' },
  { to: '/dsr', label: 'DSR & Memo Generation', icon: FileText, color: 'from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
  { to: '/memos', label: 'Memos', icon: ShieldCheck, color: 'from-teal-500 to-teal-600', text: 'text-teal-600' },
  { to: '/review', label: 'To be Reviewed by CP Sir', icon: Eye, color: 'from-indigo-500 to-indigo-600', text: 'text-indigo-600' },
  { to: '/officer-tracker', label: 'Memo Compliance', icon: UserSearch, color: 'from-rose-500 to-rose-600', text: 'text-rose-600' },
  //{ to: '/reports', label: 'Reports', icon: ClipboardList, color: 'from-orange-500 to-orange-600', text: 'text-orange-600' },
  { to: '/mapping', label: 'Mapping', icon: Map, color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600' },
  { to: '/officers', label: 'Officers', icon: Users, color: 'from-violet-500 to-violet-600', text: 'text-violet-600' },
];

const ICON_BASE = 38;
const ICON_MAX = 52;
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

const Dock: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((s: RootState) => s.auth.user);

  const visibleItems = useMemo(() => {
    if (user?.rank === 'COMMISSIONER') {
      return navItems.filter(i => i.to === '/review');
    }
    return navItems;
  }, [user?.rank]);

  const { data: pendingData } = useQuery({
    queryKey: ['memos-pending-count'],
    queryFn: async () => {
      const res = await getMemos({ status: 'PENDING_REVIEW', limit: 1 });
      return res.data;
    },
    refetchInterval: 30000,
  });
  const pendingCount = pendingData?.pagination?.total ?? 0;

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return ICON_MAX / ICON_BASE;
    if (distance === 1) return 1.25;
    if (distance === 2) return 1.1;
    return 1;
  };

  const getTranslateY = (index: number) => {
    if (hoveredIndex === null) return 0;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return -12;
    if (distance === 1) return -6;
    if (distance === 2) return -2;
    return 0;
  };

  return (
    <div className="shrink-0 flex justify-center py-1.5 bg-gray-50">
      <nav
        className="flex items-end px-3 py-1.5 bg-white/80 backdrop-blur-2xl border border-gray-200/50 rounded-2xl shadow-lg shadow-black/5"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {visibleItems.map(({ to, label, icon: Icon, color, text }, index) => {
          const scale = getScale(index);
          const ty = getTranslateY(index);
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <div
              key={to}
              onClick={() => navigate(to)}
              onMouseEnter={() => setHoveredIndex(index)}
              className="group flex flex-col items-center mx-0.5 cursor-pointer"
              style={{ width: 66 }}
            >
                <div
                  className="flex flex-col items-center"
                  style={{
                    transform: `translateY(${ty}px)`,
                    transition: `transform 0.3s ${SPRING}`,
                  }}
                >
                  <div className="relative">
                    <div
                      className={`flex items-center justify-center rounded-2xl ${
                        isActive
                          ? `bg-gradient-to-br ${color} text-white shadow-lg`
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                      }`}
                      style={{
                        width: ICON_BASE * scale,
                        height: ICON_BASE * scale,
                        transition: `width 0.3s ${SPRING}, height 0.3s ${SPRING}, box-shadow 0.2s ease`,
                      }}
                    >
                      <Icon
                        strokeWidth={isActive ? 2.2 : 1.8}
                        style={{
                          width: 18 * scale,
                          height: 18 * scale,
                          transition: `width 0.3s ${SPRING}, height 0.3s ${SPRING}`,
                      }}
                    />
                  </div>
                    {to === '/review' && pendingCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm border-2 border-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-0.5 font-medium text-center leading-tight min-h-[22px] flex items-start justify-center ${
                      isActive ? `${text} font-semibold` : 'text-gray-400'
                    }`}
                    style={{ fontSize: 9 }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" style={{ color: 'inherit' }} />
                  )}
                </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default Dock;

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Gavel,
  Map,
  ClipboardList,
  Eye,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600', text: 'text-blue-600' },
  { to: '/dsr', label: 'DSR & Memo Generation', icon: FileText, color: 'from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
  { to: '/review', label: 'To be Reviewed by CP Sir', icon: Eye, color: 'from-indigo-500 to-indigo-600', text: 'text-indigo-600' },
  { to: '/compliance', label: 'Memos & Compliance', icon: ShieldCheck, color: 'from-teal-500 to-teal-600', text: 'text-teal-600' },
  { to: '/reports', label: 'Reports', icon: ClipboardList, color: 'from-orange-500 to-orange-600', text: 'text-orange-600' },
  { to: '/mapping', label: 'Mapping', icon: Map, color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600' },
  { to: '/actions', label: 'Warnings', icon: Gavel, color: 'from-amber-500 to-amber-600', text: 'text-amber-600' },
  { to: '/officers', label: 'Officers', icon: Users, color: 'from-violet-500 to-violet-600', text: 'text-violet-600' },
];

const ICON_BASE = 38;
const ICON_MAX = 52;
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

const Dock: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
        {navItems.map(({ to, label, icon: Icon, color, text }, index) => {
          const scale = getScale(index);
          const ty = getTranslateY(index);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => setHoveredIndex(index)}
              className="group flex flex-col items-center mx-0.5"
              style={{ width: 66 }}
            >
              {({ isActive }) => (
                <div
                  className="flex flex-col items-center"
                  style={{
                    transform: `translateY(${ty}px)`,
                    transition: `transform 0.3s ${SPRING}`,
                  }}
                >
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
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default Dock;

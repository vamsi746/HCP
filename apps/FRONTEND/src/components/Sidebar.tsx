import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Gavel,
  Scale,
  Map,
  ClipboardList,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600', text: 'text-blue-600' },
  { to: '/mapping', label: 'Mapping', icon: Map, color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600' },
  { to: '/actions', label: 'Warnings', icon: Gavel, color: 'from-amber-500 to-amber-600', text: 'text-amber-600' },
  { to: '/officers', label: 'Officers', icon: Users, color: 'from-violet-500 to-violet-600', text: 'text-violet-600' },
  { to: '/dsr', label: 'DSR', icon: FileText, color: 'from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
  { to: '/appeals', label: 'Appeals', icon: Scale, color: 'from-rose-500 to-rose-600', text: 'text-rose-600' },
  { to: '/reports', label: 'Reports', icon: ClipboardList, color: 'from-orange-500 to-orange-600', text: 'text-orange-600' },
];

const Dock: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.35;
    if (distance === 1) return 1.15;
    if (distance === 2) return 1.05;
    return 1;
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <nav className="flex items-end gap-6 px-12 py-3 bg-white/80 backdrop-blur-2xl border border-gray-200/50 rounded-2xl shadow-xl shadow-black/8">
        {navItems.map(({ to, label, icon: Icon, color, text }, index) => {
          const scale = getScale(index);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative flex flex-col items-center"
              style={{
                transition: 'transform 0.2s cubic-bezier(.4,0,.2,1)',
              }}
            >
              {({ isActive }) => (
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center rounded-2xl transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-br ${color} text-white shadow-lg`
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }`}
                    style={{
                      width: 56 * scale,
                      height: 56 * scale,
                      transition: 'width 0.2s cubic-bezier(.4,0,.2,1), height 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s ease',
                    }}
                  >
                    <Icon
                      strokeWidth={isActive ? 2.2 : 1.8}
                      style={{
                        width: 24 * scale,
                        height: 24 * scale,
                        transition: 'width 0.2s cubic-bezier(.4,0,.2,1), height 0.2s cubic-bezier(.4,0,.2,1)',
                      }}
                    />
                  </div>
                  <span
                    className={`mt-1 font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive ? `${text} font-semibold` : 'text-gray-400'
                    }`}
                    style={{
                      fontSize: 10 * scale,
                      transition: 'font-size 0.2s cubic-bezier(.4,0,.2,1)',
                    }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current mt-0.5" style={{ color: 'inherit' }} />
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

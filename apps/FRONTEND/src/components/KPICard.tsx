import React, { type ElementType } from 'react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: ElementType;
  color?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, color = 'text-primary-500' }) => (
  <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
    <div className={`p-3 rounded-lg bg-gray-100 ${color}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  </div>
);
// --- IGNORE ---
export default KPICard;

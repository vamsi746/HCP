import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getZoneComparison, getTopPerformers } from '../services/endpoints';

const COLORS = ['#1a365d', '#d69e2e', '#e53e3e', '#38a169', '#805ad5', '#dd6b20', '#3182ce', '#d53f8c'];

const Reports: React.FC = () => {
  const { data: comparison } = useQuery({
    queryKey: ['zoneComparison'],
    queryFn: async () => {
      const res = await getZoneComparison();
      return res.data.data as { _id: string; count: number }[];
    },
  });

  const { data: topPerformers } = useQuery({
    queryKey: ['topPerformers'],
    queryFn: async () => {
      const res = await getTopPerformers();
      return res.data.data as { commendations: number; officer: { name: string; badgeNumber: string } }[];
    },
  });

  const barData = (comparison || []).map((d) => ({ name: d._id.replace(/_/g, ' '), count: d.count }));
  const pieData = (comparison || []).slice(0, 8).map((d) => ({ name: d._id.replace(/_/g, ' '), value: d.count }));

  return (
    <div>
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Reports & Analytics</h1>
        <p className="text-[11px] text-blue-200">Zone comparison, violation breakdown & top performers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Violations by Type</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1a365d" radius={[0, 0, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Violation Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} label dataKey="value" nameKey="name">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Top Performers (Commendations)</h2>
        {topPerformers && topPerformers.length > 0 ? (
          <table className="w-full text-sm border border-slate-200 bg-white">
            <thead>
              <tr className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white">
                <th className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 text-left">#</th>
                <th className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 text-left">Officer</th>
                <th className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 text-left">Badge</th>
                <th className="text-[11px] font-bold uppercase tracking-wider py-2 px-3 text-left">Commendations</th>
              </tr>
            </thead>
            <tbody>
              {topPerformers.map((item, i) => (
                <tr key={i} className={`border-b border-slate-200 hover:bg-blue-50/60 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="py-2 px-3">{i + 1}</td>
                  <td className="py-2 px-3">{item.officer.name}</td>
                  <td className="py-2 px-3">{item.officer.badgeNumber}</td>
                  <td className="py-2 px-3 font-semibold text-green-600">{item.commendations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-400">No commendations recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export default Reports;

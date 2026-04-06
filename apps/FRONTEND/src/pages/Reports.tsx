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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Violations by Type</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1a365d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Violation Distribution</h2>
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

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Top Performers (Commendations)</h2>
        {topPerformers && topPerformers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">#</th>
                <th className="pb-2">Officer</th>
                <th className="pb-2">Badge</th>
                <th className="pb-2">Commendations</th>
              </tr>
            </thead>
            <tbody>
              {topPerformers.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2">{item.officer.name}</td>
                  <td className="py-2">{item.officer.badgeNumber}</td>
                  <td className="py-2 font-semibold text-green-600">{item.commendations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400">No commendations recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export default Reports;

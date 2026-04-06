import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBottomPerformers } from '../services/endpoints';

const Dashboard: React.FC = () => {
  const { data: bottomPerformers } = useQuery({
    queryKey: ['bottomPerformers'],
    queryFn: async () => {
      const res = await getBottomPerformers();
      return res.data.data as { violationCount: number; officer: { name: string; badgeNumber: string; rank: string } }[];
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">SHIELD — Smart Hyderabad Integrated Enforcement & Law-enforcement Discipline</p>

      {/* Workflow explanation */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl p-5 mb-8">
        <h2 className="text-lg font-semibold text-primary-700 mb-3">How the System Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <p className="font-semibold text-gray-700">Task Force Detects Activity</p>
              <p className="text-gray-500">Illegal activity (betting, gambling, prostitution) found in a sector</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <p className="font-semibold text-gray-700">Warning Auto-Generated</p>
              <p className="text-gray-500">Warning letter with CP signature issued to responsible SI officer</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <p className="font-semibold text-gray-700">Track Violations</p>
              <p className="text-gray-500">System maintains complete history of each officer's violations</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div>
              <p className="font-semibold text-gray-700">3 Warnings → Suspension</p>
              <p className="text-gray-500">After 3 warnings, suspension order automatically triggered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Officers with most violations */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Officers with Most Violations</h2>
        {bottomPerformers && bottomPerformers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">#</th>
                <th className="pb-2">Officer</th>
                <th className="pb-2">Badge</th>
                <th className="pb-2">Rank</th>
                <th className="pb-2">Violations</th>
                <th className="pb-2">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {bottomPerformers.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2 font-medium">{item.officer.name}</td>
                  <td className="py-2 font-mono text-gray-500">{item.officer.badgeNumber}</td>
                  <td className="py-2">{item.officer.rank}</td>
                  <td className="py-2 font-semibold text-red-600">{item.violationCount}</td>
                  <td className="py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.violationCount >= 3
                        ? 'bg-red-100 text-red-700'
                        : item.violationCount >= 2
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {item.violationCount >= 3 ? 'SUSPENSION' : item.violationCount >= 2 ? 'HIGH' : 'LOW'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400">No violations recorded yet. Log a Task Force incident to start tracking.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

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
      {/* Official header */}
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Dashboard</h1>
        <p className="text-[11px] text-blue-200 mt-0.5">SHIELD — Smart Hyderabad Integrated Enforcement & Law-enforcement Discipline</p>
      </div>

      {/* Workflow explanation */}
      <div className="border border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 p-5 mb-6">
        <h2 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 border-b border-indigo-200 pb-2">How the System Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">1</div>
            <div>
              <p className="font-bold text-slate-800">Task Force Detects Activity</p>
              <p className="text-slate-500 mt-0.5">Illegal activity (betting, gambling, prostitution) found in a sector</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-amber-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">2</div>
            <div>
              <p className="font-bold text-slate-800">Warning Auto-Generated</p>
              <p className="text-slate-500 mt-0.5">Warning letter with CP signature issued to responsible SI officer</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">3</div>
            <div>
              <p className="font-bold text-slate-800">Track Violations</p>
              <p className="text-slate-500 mt-0.5">System maintains complete history of each officer's violations</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-red-600 text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">4</div>
            <div>
              <p className="font-bold text-slate-800">3 Warnings → Suspension</p>
              <p className="text-slate-500 mt-0.5">After 3 warnings, suspension order automatically triggered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Officers with most violations */}
      <div className="border border-slate-200 bg-white">
        <div className="bg-indigo-500 px-5 py-2.5">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Officers with Most Violations</h2>
        </div>
        {bottomPerformers && bottomPerformers.length > 0 ? (
          <table className="w-full text-[13px] table-fixed">
            <thead>
              <tr className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white text-left">
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider w-[50px] text-center">#</th>
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Officer</th>
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Badge</th>
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Rank</th>
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider w-[100px]">Violations</th>
                <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider w-[120px]">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {bottomPerformers.map((item, i) => (
                <tr key={i} className={`border-b border-slate-200 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-2.5 font-bold text-slate-500 text-center">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{item.officer.name}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{item.officer.badgeNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{item.officer.rank}</td>
                  <td className="px-4 py-2.5 font-bold text-red-600">{item.violationCount}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      item.violationCount >= 3
                        ? 'bg-red-600 text-white'
                        : item.violationCount >= 2
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                    }`}>
                      {item.violationCount >= 3 ? 'SUSPENSION' : item.violationCount >= 2 ? 'HIGH' : 'LOW'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-400 px-5 py-8 text-center text-sm">No violations recorded yet. Log a Task Force incident to start tracking.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

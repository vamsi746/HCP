import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDSRs } from '../../services/endpoints';
import StatusBadge from '../../components/StatusBadge';
import type { DSR } from '../../types';
import { format } from 'date-fns';

const DSRList: React.FC = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['dsrs', page],
    queryFn: async () => {
      const res = await getDSRs({ page, limit: 20 });
      return res.data;
    },
  });

  const dsrs: DSR[] = data?.data || [];
  const total: number = data?.total || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Daily Situation Reports</h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Content</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No DSRs found.</td></tr>
            ) : (
              dsrs.map((dsr) => (
                <tr key={dsr._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{format(new Date(dsr.date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3">{dsr.officer?.name || dsr.officerId}</td>
                  <td className="px-4 py-3"><StatusBadge status={dsr.status} /></td>
                  <td className="px-4 py-3 max-w-xs truncate">{dsr.content}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
};

export default DSRList;

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getViolations, exemptViolation } from '../services/endpoints';
import toast from 'react-hot-toast';
import type { Violation } from '../types';

const Violations: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['violations', page],
    queryFn: async () => {
      const res = await getViolations({ page, limit: 20 });
      return res.data;
    },
  });

  const exemptMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => exemptViolation(id, reason),
    onSuccess: () => {
      toast.success('Violation exempted');
      queryClient.invalidateQueries({ queryKey: ['violations'] });
    },
  });

  const handleExempt = (id: string) => {
    const reason = prompt('Exemption reason:');
    if (reason) exemptMutation.mutate({ id, reason });
  };

  const violations: Violation[] = data?.data || [];
  const pagination = data?.pagination || { total: 0 };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Violations</h1>
        <p className="text-sm text-gray-500 mt-1">Auto-generated when Task Force detects activity in an SI's assigned area</p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Officer</th>
              <th className="px-4 py-3 font-semibold">Badge #</th>
              <th className="px-4 py-3 font-semibold">Violation Type</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : violations.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No violations found.</td></tr>
            ) : (
              violations.map((v) => (
                <tr key={v._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(v.date || v.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-medium">{v.officer?.name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{v.officer?.badgeNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {v.violationType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityStyle(v.severity)}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-500">{v.description || '—'}</td>
                  <td className="px-4 py-3">
                    {v.isExempted ? (
                      <span className="text-green-600 text-xs font-medium">Exempted</span>
                    ) : (
                      <span className="text-red-600 text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!v.isExempted && (
                      <button onClick={() => handleExempt(v._id)} className="text-blue-600 hover:underline text-xs font-medium">
                        Exempt
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
          <button disabled={page * 20 >= pagination.total} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Next</button>
        </div>
      )}
    </div>
  );
};

export default Violations;

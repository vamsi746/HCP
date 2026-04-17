import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getViolations, exemptViolation, updateViolation, deleteViolation } from '../services/endpoints';
import toast from 'react-hot-toast';
import { Pencil, Trash2, X } from 'lucide-react';
import type { Violation } from '../types';

const VIOLATION_TYPES = ['MISSED_ACTION', 'INACTIVE_SI', 'DEFECTIVE_REGISTRATION', 'SUPERVISION_FAILURE', 'INSUBORDINATION'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const Violations: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState<Violation | null>(null);
  const [deleteItem, setDeleteItem] = useState<Violation | null>(null);
  const [editForm, setEditForm] = useState({ violationType: '', severity: '', description: '', isExempted: '' });

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateViolation(id, data),
    onSuccess: () => {
      toast.success('Violation updated');
      queryClient.invalidateQueries({ queryKey: ['violations'] });
      setEditItem(null);
    },
    onError: () => toast.error('Failed to update violation'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteViolation(id),
    onSuccess: () => {
      toast.success('Violation deleted');
      queryClient.invalidateQueries({ queryKey: ['violations'] });
      setDeleteItem(null);
    },
    onError: () => toast.error('Failed to delete violation'),
  });

  const handleExempt = (id: string) => {
    const reason = prompt('Exemption reason:');
    if (reason) exemptMutation.mutate({ id, reason });
  };

  const openEdit = (v: Violation) => {
    setEditForm({ violationType: v.violationType, severity: v.severity, description: v.description || '', isExempted: v.isExempted ? 'true' : 'false' });
    setEditItem(v);
  };

  const violations: Violation[] = data?.data || [];
  const pagination = data?.pagination || { total: 0 };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Violations</h1>
        <p className="text-[11px] text-blue-200 mt-1">Auto-generated when Task Force detects activity in an SI's assigned area</p>
      </div>

      <div className="border border-slate-200 bg-white shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f]">
            <tr className="text-left text-white">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Officer</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Badge #</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Violation Type</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Severity</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            ) : violations.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No violations found.</td></tr>
            ) : (
              violations.map((v, idx) => (
                <tr key={v._id} className={`border-t border-slate-200 hover:bg-blue-50/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-slate-600">{new Date(v.date || v.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-medium">{v.officer?.name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{v.officer?.badgeNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                      {v.violationType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${getSeverityStyle(v.severity)}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500">{v.description || '—'}</td>
                  <td className="px-4 py-3">
                    {v.isExempted ? (
                      <span className="text-green-600 text-xs font-medium">Exempted</span>
                    ) : (
                      <span className="text-red-600 text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!v.isExempted && (
                        <button onClick={() => handleExempt(v._id)} className="text-blue-600 hover:underline text-xs font-medium">
                          Exempt
                        </button>
                      )}
                      <button onClick={() => openEdit(v)} className="text-slate-500 hover:text-blue-600" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteItem(v)} className="text-slate-500 hover:text-red-600" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {pagination.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-300 disabled:opacity-50 text-sm">Prev</button>
          <span className="px-3 py-1 text-sm text-slate-500">Page {page}</span>
          <button disabled={page * 20 >= pagination.total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-300 disabled:opacity-50 text-sm">Next</button>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-[95vw] max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Edit Violation</h2>
              <button onClick={() => setEditItem(null)} className="text-blue-200 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Violation Type</label>
                <select value={editForm.violationType} onChange={(e) => setEditForm({ ...editForm, violationType: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  {VIOLATION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Severity</label>
                <select value={editForm.severity} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Status</label>
                <select value={editForm.isExempted} onChange={(e) => setEditForm({ ...editForm, isExempted: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  <option value="false">Active</option>
                  <option value="true">Exempted</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm h-20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={() => updateMutation.mutate({ id: editItem._id, data: { ...editForm, isExempted: editForm.isExempted === 'true' } })} disabled={updateMutation.isPending} className="flex-1 bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-[95vw] max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Delete Violation?</h3>
            </div>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <p className="text-sm text-slate-500 mb-5">
                This will permanently delete the {deleteItem.violationType.replace(/_/g, ' ')} violation for {deleteItem.officer?.name || 'this officer'}. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Violations;

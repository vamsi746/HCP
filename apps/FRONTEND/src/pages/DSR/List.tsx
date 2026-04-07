import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDSRs, updateDSR, deleteDSR } from '../../services/endpoints';
import StatusBadge from '../../components/StatusBadge';
import { Pencil, Trash2, X, Plus, ChevronRight, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { DSR, ForceType } from '../../types';
import { format } from 'date-fns';

const FORCE_LABELS: Record<ForceType, string> = {
  TASK_FORCE: 'Task Force',
  H_FAST: 'H-FAST',
  H_NEW: 'H-NEW',
};

const DSR_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW'];

const DSRList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterForce, setFilterForce] = useState<ForceType | ''>('');
  const [editItem, setEditItem] = useState<DSR | null>(null);
  const [deleteItem, setDeleteItem] = useState<DSR | null>(null);
  const [editForm, setEditForm] = useState({ processingStatus: '', qualityScore: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['dsrs', page, filterForce],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filterForce) params.forceType = filterForce;
      const res = await getDSRs(params);
      return res.data;
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateDSR(id, data),
    onSuccess: () => { toast.success('DSR updated'); queryClient.invalidateQueries({ queryKey: ['dsrs'] }); setEditItem(null); },
    onError: () => toast.error('Failed to update DSR'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDSR(id),
    onSuccess: () => { toast.success('DSR deleted'); queryClient.invalidateQueries({ queryKey: ['dsrs'] }); setDeleteItem(null); },
    onError: () => toast.error('Failed to delete DSR'),
  });

  const openEdit = (e: React.MouseEvent, dsr: DSR) => {
    e.stopPropagation();
    setEditForm({ processingStatus: dsr.processingStatus || 'PENDING', qualityScore: (dsr as any).qualityScore?.toString() || '' });
    setEditItem(dsr);
  };

  const openDelete = (e: React.MouseEvent, dsr: DSR) => {
    e.stopPropagation();
    setDeleteItem(dsr);
  };

  const handleEditSave = () => {
    if (!editItem) return;
    const payload: Record<string, unknown> = { processingStatus: editForm.processingStatus };
    if (editForm.qualityScore) payload.qualityScore = parseInt(editForm.qualityScore);
    editMutation.mutate({ id: editItem._id, data: payload });
  };

  const dsrs: DSR[] = data?.data || [];
  const total: number = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daily Situation Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Parsed DSR documents from special force units</p>
        </div>
        <button
          onClick={() => navigate('/dsr/upload')}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition"
        >
          <Plus size={18} />
          Upload DSR
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-gray-500">Force:</label>
        <select
          value={filterForce}
          onChange={(e) => { setFilterForce(e.target.value as ForceType | ''); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All Forces</option>
          {(Object.keys(FORCE_LABELS) as ForceType[]).map((ft) => (
            <option key={ft} value={ft}>{FORCE_LABELS[ft]}</option>
          ))}
        </select>
        {total > 0 && <span className="text-xs text-gray-400 ml-auto">{total} report{total !== 1 ? 's' : ''}</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Force</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3 text-center">Cases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No DSRs found. Upload one to get started.</td></tr>
            ) : (
              dsrs.map((dsr) => (
                <tr
                  key={dsr._id}
                  onClick={() => navigate(`/dsr/${dsr._id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{format(new Date(dsr.date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-gray-600">{FORCE_LABELS[dsr.forceType] || dsr.forceType}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate text-xs">{dsr.fileName || '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{dsr.totalCases || 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={dsr.processingStatus} /></td>
                  <td className="px-4 py-3 text-gray-500">{typeof dsr.uploadedBy === 'object' ? dsr.uploadedBy?.name : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/dsr/${dsr._id}`); }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title="View">
                        <Eye size={14} />
                      </button>
                      <button onClick={(e) => openEdit(e, dsr)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={(e) => openDelete(e, dsr)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Edit DSR</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Processing Status</label>
                <select value={editForm.processingStatus} onChange={(e) => setEditForm({ ...editForm, processingStatus: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {DSR_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quality Score (0–100)</label>
                <input type="number" min={0} max={100} value={editForm.qualityScore} onChange={(e) => setEditForm({ ...editForm, qualityScore: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleEditSave} disabled={editMutation.isPending} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                {editMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete DSR?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete the DSR dated <strong>{format(new Date(deleteItem.date), 'dd MMM yyyy')}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DSRList;

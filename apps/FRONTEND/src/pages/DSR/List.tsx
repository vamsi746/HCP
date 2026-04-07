import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDSRs, updateDSR, deleteDSR } from '../../services/endpoints';
import StatusBadge from '../../components/StatusBadge';
import { Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DSR } from '../../types';
import { format } from 'date-fns';

const DSR_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW'];

const DSRList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState<DSR | null>(null);
  const [deleteItem, setDeleteItem] = useState<DSR | null>(null);
  const [editForm, setEditForm] = useState({ processingStatus: '', qualityScore: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dsrs', page],
    queryFn: async () => {
      const res = await getDSRs({ page, limit: 20 });
      return res.data;
    },
  });

  const openEdit = (dsr: DSR) => {
    setEditForm({
      processingStatus: (dsr as any).processingStatus || dsr.status || 'PENDING',
      qualityScore: (dsr as any).qualityScore?.toString() || '',
    });
    setEditItem(dsr);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateDSR(id, data),
    onSuccess: () => {
      toast.success('DSR updated');
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      setEditItem(null);
    },
    onError: () => toast.error('Failed to update DSR'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDSR(id),
    onSuccess: () => {
      toast.success('DSR deleted');
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      setDeleteItem(null);
    },
    onError: () => toast.error('Failed to delete DSR'),
  });

  const handleEditSave = () => {
    if (!editItem) return;
    const payload: Record<string, unknown> = { processingStatus: editForm.processingStatus };
    if (editForm.qualityScore) payload.qualityScore = parseInt(editForm.qualityScore);
    editMutation.mutate({ id: editItem._id, data: payload });
  };

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
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No DSRs found.</td></tr>
            ) : (
              dsrs.map((dsr: any) => (
                <tr key={dsr._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{format(new Date(dsr.date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3">{dsr.uploadedBy?.name || dsr.officer?.name || dsr.officerId || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{dsr.fileName || dsr.content || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={dsr.processingStatus || dsr.status} /></td>
                  <td className="px-4 py-3">
                    {dsr.qualityScore != null ? (
                      <span className={`text-xs font-medium ${dsr.qualityScore >= 70 ? 'text-green-600' : dsr.qualityScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {dsr.qualityScore}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(dsr)} className="text-gray-500 hover:text-blue-600" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteItem(dsr)} className="text-gray-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
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

      {/* Edit DSR Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Edit DSR</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Processing Status</label>
                <select value={editForm.processingStatus} onChange={(e) => setEditForm({ ...editForm, processingStatus: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {DSR_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quality Score (0–100)</label>
                <input type="number" min={0} max={100} value={editForm.qualityScore} onChange={(e) => setEditForm({ ...editForm, qualityScore: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0–100" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleEditSave} disabled={editMutation.isPending} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {editMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete DSR?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete the DSR dated {format(new Date(deleteItem.date), 'dd MMM yyyy')}. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
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

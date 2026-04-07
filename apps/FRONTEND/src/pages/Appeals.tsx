import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppeals, updateAppeal, deleteAppeal } from '../services/endpoints';
import StatusBadge from '../components/StatusBadge';
import { Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Appeal } from '../types';

const APPEAL_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED'];

const Appeals: React.FC = () => {
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState<Appeal | null>(null);
  const [deleteItem, setDeleteItem] = useState<Appeal | null>(null);
  const [editForm, setEditForm] = useState({ status: '', reason: '', reviewNotes: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['appeals', page],
    queryFn: async () => {
      const res = await getAppeals({ page, limit: 20 });
      return res.data;
    },
  });

  const openEdit = (a: Appeal) => {
    setEditForm({ status: a.status, reason: a.reason || '', reviewNotes: a.reviewNotes || '' });
    setEditItem(a);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateAppeal(id, data),
    onSuccess: () => {
      toast.success('Appeal updated');
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
      setEditItem(null);
    },
    onError: () => toast.error('Failed to update appeal'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppeal(id),
    onSuccess: () => {
      toast.success('Appeal deleted');
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
      setDeleteItem(null);
    },
    onError: () => toast.error('Failed to delete appeal'),
  });

  const appeals: Appeal[] = data?.data || [];
  const total: number = data?.total || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Appeals</h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">SLA Deadline</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : appeals.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No appeals found.</td></tr>
            ) : (
              appeals.map((a) => (
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{a.officer?.name || a.officerId}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{a.reason}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">{format(new Date(a.slaDeadline), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(a)} className="text-gray-500 hover:text-blue-600" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteItem(a)} className="text-gray-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
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

      {/* Edit Appeal Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Edit Appeal</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {APPEAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-none" placeholder="Appeal reason…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                <textarea value={editForm.reviewNotes} onChange={(e) => setEditForm({ ...editForm, reviewNotes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-none" placeholder="Add review notes…" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => editMutation.mutate({ id: editItem._id, data: editForm })} disabled={editMutation.isPending} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Appeal?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete the appeal by {deleteItem.officer?.name || 'this officer'}. This action cannot be undone.
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

export default Appeals;

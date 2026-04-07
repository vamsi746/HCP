import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActions, updateAction, deleteAction } from '../services/endpoints';
import { FileText, AlertTriangle, Ban, Download, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DisciplinaryAction } from '../types';

const ACTION_TYPES = ['COUNSELING', 'WARNING', 'SHOW_CAUSE', 'ENQUIRY', 'SUSPENSION', 'COMMENDATION', 'TRANSFER_RECOMMENDATION'];
const ACTION_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'RESPONDED', 'CLOSED', 'APPEALED'];

const API_URL = import.meta.env.VITE_API_URL || '';

const Actions: React.FC = () => {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [editItem, setEditItem] = useState<DisciplinaryAction | null>(null);
  const [deleteItem, setDeleteItem] = useState<DisciplinaryAction | null>(null);
  const [editForm, setEditForm] = useState({ actionType: '', status: '', responseDeadline: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['actions', page, typeFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (typeFilter) params.actionType = typeFilter;
      const res = await getActions(params);
      return res.data;
    },
  });

  const openEdit = (a: DisciplinaryAction) => {
    setEditForm({ actionType: a.actionType, status: a.status, responseDeadline: a.responseDeadline ? new Date(a.responseDeadline).toISOString().split('T')[0] : '' });
    setEditItem(a);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateAction(id, data),
    onSuccess: () => {
      toast.success('Action updated');
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      setEditItem(null);
    },
    onError: () => toast.error('Failed to update action'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAction(id),
    onSuccess: () => {
      toast.success('Action deleted');
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      setDeleteItem(null);
    },
    onError: () => toast.error('Failed to delete action'),
  });

  const actions: DisciplinaryAction[] = data?.data || [];
  const pagination = data?.pagination || { total: 0 };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'WARNING': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENSION': return 'bg-red-100 text-red-800';
      case 'SHOW_CAUSE': return 'bg-orange-100 text-orange-800';
      case 'COMMENDATION': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'ACKNOWLEDGED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RESPONDED': return 'bg-green-50 text-green-700 border-green-200';
      case 'CLOSED': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'APPEALED': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Warnings & Disciplinary Actions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-generated warnings & suspension orders for officers who failed to act
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-yellow-600" size={24} />
          <div>
            <div className="text-2xl font-bold text-yellow-700">
              {actions.filter((a) => a.actionType === 'WARNING').length}
            </div>
            <div className="text-sm text-yellow-600">Warning Letters</div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Ban className="text-red-600" size={24} />
          <div>
            <div className="text-2xl font-bold text-red-700">
              {actions.filter((a) => a.actionType === 'SUSPENSION').length}
            </div>
            <div className="text-sm text-red-600">Suspension Orders</div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <FileText className="text-blue-600" size={24} />
          <div>
            <div className="text-2xl font-bold text-blue-700">
              {actions.filter((a) => a.status === 'PENDING').length}
            </div>
            <div className="text-sm text-blue-600">Pending Response</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'WARNING', 'SUSPENSION', 'SHOW_CAUSE', 'COUNSELING'].map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              typeFilter === t ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {t === '' ? 'All' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Officer</th>
              <th className="px-4 py-3 font-semibold">Badge #</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Deadline</th>
              <th className="px-4 py-3 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : actions.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No actions found. Warnings will appear here when incidents are logged.</td></tr>
            ) : (
              actions.map((a) => (
                <tr key={a._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(a.issuedAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-medium">{a.officer?.name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{a.officer?.badgeNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getTypeStyle(a.actionType)}`}>
                      {a.actionType === 'WARNING' && <AlertTriangle size={12} className="inline mr-1" />}
                      {a.actionType === 'SUSPENSION' && <Ban size={12} className="inline mr-1" />}
                      {a.actionType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-gray-700">{a.actionNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${getStatusStyle(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {a.responseDeadline ? new Date(a.responseDeadline).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {a.documentUrl ? (
                      <a
                        href={`${API_URL}${a.documentUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                      >
                        <Download size={12} /> PDF
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
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

      {pagination.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
          <button disabled={page * 20 >= pagination.total} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Next</button>
        </div>
      )}

      {/* Edit Action Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Edit Action</h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                <select value={editForm.actionType} onChange={(e) => setEditForm({ ...editForm, actionType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline</label>
                <input type="date" value={editForm.responseDeadline} onChange={(e) => setEditForm({ ...editForm, responseDeadline: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Action?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete {deleteItem.actionType.replace(/_/g, ' ')} #{deleteItem.actionNumber} for {deleteItem.officer?.name || 'this officer'}. This action cannot be undone.
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

export default Actions;

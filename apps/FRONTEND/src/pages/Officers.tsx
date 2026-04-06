import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOfficers, createOfficer, updateOfficer, deleteOfficer } from '../services/endpoints';
import StatusBadge from '../components/StatusBadge';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Officer, OfficerRank } from '../types';

const RANKS: OfficerRank[] = ['CONSTABLE', 'HEAD_CONSTABLE', 'ASI', 'SI', 'INSPECTOR', 'ACP', 'DCP', 'ADDL_CP', 'COMMISSIONER'];

const emptyForm = { name: '', badgeNumber: '', rank: 'CONSTABLE' as OfficerRank, phone: '', email: '', password: '' };

const Officers: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['officers', page, search],
    queryFn: async () => {
      const res = await getOfficers({ page, limit: 20, search: search || undefined });
      return res.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createOfficer(data),
    onSuccess: () => {
      toast.success('Officer added');
      queryClient.invalidateQueries({ queryKey: ['officers'] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add officer'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateOfficer(id, data),
    onSuccess: () => {
      toast.success('Officer updated');
      queryClient.invalidateQueries({ queryKey: ['officers'] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update officer'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteOfficer(id),
    onSuccess: () => {
      toast.success('Officer removed');
      queryClient.invalidateQueries({ queryKey: ['officers'] });
    },
    onError: () => toast.error('Failed to remove officer'),
  });

  const closeModal = () => {
    setShowModal(null);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showModal === 'edit' && editId) {
      const { password, ...rest } = form;
      const data: Record<string, unknown> = { ...rest };
      if (password) data.password = password;
      editMutation.mutate({ id: editId, data });
    } else {
      addMutation.mutate({ ...form });
    }
  };

  const handleEdit = (e: React.MouseEvent, officer: Officer) => {
    e.stopPropagation();
    setEditId(officer._id);
    setForm({
      name: officer.name,
      badgeNumber: officer.badgeNumber,
      rank: officer.rank,
      phone: officer.phone || '',
      email: officer.email || '',
      password: '',
    });
    setShowModal('edit');
  };

  const handleRemove = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Remove officer "${name}"? This cannot be undone.`)) {
      removeMutation.mutate(id);
    }
  };

  const officers: Officer[] = data?.data || [];
  const total: number = data?.pagination?.total || data?.total || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Officers</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name or badge…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-shield-gold focus:outline-none"
          />
          <button
            onClick={() => setShowModal('add')}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-600 transition"
          >
            <Plus size={16} /> Add Officer
          </button>
        </div>
      </div>

      {/* Add / Edit Officer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4">{showModal === 'edit' ? 'Edit Officer' : 'Add New Officer'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Badge Number *</label>
                  <input required value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })}
                    placeholder="HCP-XXX" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rank *</label>
                  <select required value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value as OfficerRank })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none">
                    {RANKS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={showModal === 'edit' ? 'Leave blank to keep current' : 'Default: Shield@123'}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-shield-gold focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addMutation.isPending || editMutation.isPending}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50">
                  {(addMutation.isPending || editMutation.isPending) ? 'Saving…' : showModal === 'edit' ? 'Save Changes' : 'Add Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Badge</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : officers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No officers found.</td></tr>
            ) : (
              officers.map((o) => (
                <tr
                  key={o._id}
                  onClick={() => navigate(`/officers/${o._id}`)}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono">{o.badgeNumber}</td>
                  <td className="px-4 py-3">{o.name}</td>
                  <td className="px-4 py-3">{o.rank}</td>
                  <td className="px-4 py-3">{o.phone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEdit(e, o)}
                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition"
                        title="Edit officer"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => handleRemove(e, o._id, o.name)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                        title="Remove officer"
                      >
                        <Trash2 size={16} />
                      </button>
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
          <span className="px-3 py-1 text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
};

export default Officers;

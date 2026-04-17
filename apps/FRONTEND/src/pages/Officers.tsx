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
      {/* Official header */}
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">Officers Register</h1>
          <p className="text-[11px] text-blue-200 mt-0.5">Manage police officers and personnel</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name or badge…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border border-slate-500 bg-white/10 text-white placeholder:text-blue-200/60 px-4 py-1.5 text-xs w-full sm:w-56 focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
          <button
            onClick={() => setShowModal('add')}
            className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition"
          >
            <Plus size={14} /> Add Officer
          </button>
        </div>
      </div>

      {/* Add / Edit Officer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-[95vw] max-w-lg">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">{showModal === 'edit' ? 'Edit Officer' : 'Add New Officer'}</h2>
              <button onClick={closeModal} className="text-blue-200 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Badge Number *</label>
                  <input required value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })}
                    placeholder="HCP-XXX" className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Rank *</label>
                  <select required value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value as OfficerRank })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                    {RANKS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={showModal === 'edit' ? 'Leave blank to keep current' : 'Default: Shield@123'}
                    className="w-full border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 text-sm font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={addMutation.isPending || editMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50">
                  {(addMutation.isPending || editMutation.isPending) ? 'Saving…' : showModal === 'edit' ? 'Save Changes' : 'Add Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-[13px] table-fixed min-w-[700px]">
          <thead>
            <tr className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white text-left">
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Badge</th>
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Name</th>
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Rank</th>
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Phone</th>
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : officers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No officers found.</td></tr>
            ) : (
              officers.map((o, idx) => (
                <tr
                  key={o._id}
                  onClick={() => navigate(`/officers/${o._id}`)}
                  className={`border-b border-slate-200 cursor-pointer hover:bg-blue-50/60 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="px-4 py-2.5 font-mono text-slate-600">{o.badgeNumber}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{o.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">{o.rank}</td>
                  <td className="px-4 py-2.5 text-slate-600">{o.phone}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEdit(e, o)}
                        className="text-indigo-500 hover:text-indigo-700 p-1 hover:bg-indigo-50 transition"
                        title="Edit officer"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => handleRemove(e, o._id, o.name)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 transition"
                        title="Remove officer"
                      >
                        <Trash2 size={15} />
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
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Officers;

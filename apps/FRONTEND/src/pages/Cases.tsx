import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCases, createCase, updateCase, deleteCase, getPoliceStations } from '../services/endpoints';
import { Plus, AlertTriangle, X, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Case } from '../types';

const CRIME_TYPES = [
  'BETTING', 'GAMBLING', 'ONLINE_BETTING', 'PROSTITUTION',
  'ILLICIT_LIQUOR', 'NDPS_PETTY', 'NDPS_MAJOR', 'EVE_TEASING',
  'THEFT', 'ROBBERY', 'BURGLARY', 'CHEATING', 'OTHER',
];

const HANDLER_TYPES = ['TASK_FORCE', 'SIT', 'SOT', 'ANTI_VICE', 'SECTOR_SI', 'CYBER_CELL', 'SPECIAL_BRANCH'];

const Cases: React.FC = () => {
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'taskforce' | 'missed'>('all');
  const queryClient = useQueryClient();

  const filterParams: Record<string, unknown> = { page, limit: 20 };
  if (filter === 'taskforce') filterParams.handledBy = 'TASK_FORCE';
  if (filter === 'missed') filterParams.isMissedBySI = 'true';

  const { data, isLoading } = useQuery({
    queryKey: ['cases', page, filter],
    queryFn: async () => {
      const res = await getCases(filterParams);
      return res.data;
    },
  });

  const { data: stationsRes } = useQuery({
    queryKey: ['policeStations'],
    queryFn: async () => {
      const res = await getPoliceStations();
      return res.data.data as { _id: string; name: string; code: string }[];
    },
  });

  const cases: Case[] = data?.data || [];
  const pagination = data?.pagination || { total: 0 };

  // Form state
  const [form, setForm] = useState({
    crimeType: 'BETTING',
    handledBy: 'TASK_FORCE',
    policeStationId: '',
    description: '',
    location: '',
    firNumber: '',
    taskForceUnit: '',
  });

  const addMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => createCase(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowModal(false);
      setForm({ crimeType: 'BETTING', handledBy: 'TASK_FORCE', policeStationId: '', description: '', location: '', firNumber: '', taskForceUnit: '' });
    },
  });

  // Edit / Delete state
  const [editItem, setEditItem] = useState<Case | null>(null);
  const [deleteItem, setDeleteItem] = useState<Case | null>(null);
  const [editForm, setEditForm] = useState({ crimeType: '', handledBy: '', policeStationId: '', description: '', location: '', firNumber: '', taskForceUnit: '', isMissedBySI: '' });

  const openEdit = (c: Case) => {
    setEditForm({
      crimeType: c.crimeType,
      handledBy: c.handledBy,
      policeStationId: typeof c.policeStationId === 'object' ? c.policeStationId?._id || '' : c.policeStationId || '',
      description: c.description || '',
      location: c.location || '',
      firNumber: c.firNumber || '',
      taskForceUnit: c.taskForceUnit || '',
      isMissedBySI: c.isMissedBySI ? 'true' : 'false',
    });
    setEditItem(c);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateCase(id, data),
    onSuccess: () => {
      toast.success('Case updated');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setEditItem(null);
    },
    onError: () => toast.error('Failed to update case'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCase(id),
    onSuccess: () => {
      toast.success('Case deleted');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setDeleteItem(null);
    },
    onError: () => toast.error('Failed to delete case'),
  });

  const handleSubmit = () => {
    if (!form.policeStationId) return alert('Select a police station');
    addMutation.mutate(form);
  };

  const getStationName = (ps: Case['policeStationId']) => {
    if (!ps) return '—';
    if (typeof ps === 'object') return ps.name;
    const found = stationsRes?.find((s) => s._id === ps);
    return found?.name || ps;
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Incidents & Cases</h1>
            <p className="text-[11px] text-blue-200 mt-1">
              Log Task Force detections to auto-generate warnings for responsible officers
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 transition"
          >
            <Plus size={16} /> Log Task Force Incident
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'taskforce', 'missed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition ${
              filter === f
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All Cases' : f === 'taskforce' ? 'Task Force Only' : 'Missed by SI'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] border-b">
            <tr className="text-left text-white">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">FIR #</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Crime Type</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Police Station</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Handled By</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Missed by SI</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No cases found.</td></tr>
            ) : (
              cases.map((c, idx) => (
                <tr key={c._id} className={`border-t hover:bg-blue-50/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-slate-600">{new Date(c.caseDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{c.firNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${
                      ['BETTING', 'GAMBLING', 'PROSTITUTION', 'ONLINE_BETTING'].includes(c.crimeType)
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {c.crimeType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStationName(c.policeStationId)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${
                      c.handledBy !== 'SECTOR_SI'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {c.handledBy.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.location || '—'}</td>
                  <td className="px-4 py-3">
                    {c.isMissedBySI ? (
                      <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <AlertTriangle size={14} /> Yes
                      </span>
                    ) : (
                      <span className="text-green-600">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-blue-600" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteItem(c)} className="text-slate-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
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
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Page {page}</span>
          <button disabled={page * 20 >= pagination.total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Log Incident Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Log Task Force Incident</h2>
              <button onClick={() => setShowModal(false)} className="text-blue-200 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
            <p className="text-sm text-red-600 bg-red-50 p-3 mb-4">
              <AlertTriangle size={14} className="inline mr-1" />
              Logging a Task Force incident will automatically generate a warning for the responsible Sector SI officers.
              After 3 warnings, a suspension order will be issued.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Crime Type *</label>
                <select
                  value={form.crimeType}
                  onChange={(e) => setForm({ ...form, crimeType: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                >
                  {CRIME_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{ct.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Police Station (where it occurred) *</label>
                <select
                  value={form.policeStationId}
                  onChange={(e) => setForm({ ...form, policeStationId: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select Police Station…</option>
                  {stationsRes?.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Detected By</label>
                <select
                  value={form.handledBy}
                  onChange={(e) => setForm({ ...form, handledBy: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                >
                  {HANDLER_TYPES.map((ht) => (
                    <option key={ht} value={ht}>{ht.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">FIR Number</label>
                  <input
                    type="text"
                    value={form.firNumber}
                    onChange={(e) => setForm({ ...form, firNumber: e.target.value })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. 123/2026"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Task Force Unit</label>
                  <input
                    type="text"
                    value={form.taskForceUnit}
                    onChange={(e) => setForm({ ...form, taskForceUnit: e.target.value })}
                    className="w-full border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. TF South"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Specific area/address"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-sm h-20 resize-none"
                  placeholder="Brief description of the incident…"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-sm font-bold uppercase tracking-wider hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={addMutation.isPending}
                className="flex-1 bg-indigo-600 text-white py-2 text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Submitting…' : 'Log Incident & Trigger Warnings'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Case Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Edit Case</h2>
              <button onClick={() => setEditItem(null)} className="text-blue-200 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Crime Type</label>
                <select value={editForm.crimeType} onChange={(e) => setEditForm({ ...editForm, crimeType: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  {CRIME_TYPES.map((ct) => <option key={ct} value={ct}>{ct.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Police Station</label>
                <select value={editForm.policeStationId} onChange={(e) => setEditForm({ ...editForm, policeStationId: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select Police Station…</option>
                  {stationsRes?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Handled By</label>
                <select value={editForm.handledBy} onChange={(e) => setEditForm({ ...editForm, handledBy: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                  {HANDLER_TYPES.map((ht) => <option key={ht} value={ht}>{ht.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">FIR Number</label>
                  <input type="text" value={editForm.firNumber} onChange={(e) => setEditForm({ ...editForm, firNumber: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Location</label>
                  <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Task Force Unit</label>
                  <input type="text" value={editForm.taskForceUnit} onChange={(e) => setEditForm({ ...editForm, taskForceUnit: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Missed by SI</label>
                  <select value={editForm.isMissedBySI} onChange={(e) => setEditForm({ ...editForm, isMissedBySI: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm h-20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-sm font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button>
              <button onClick={() => editMutation.mutate({ id: editItem._id, data: { ...editForm, isMissedBySI: editForm.isMissedBySI === 'true' } })} disabled={editMutation.isPending} className="flex-1 bg-indigo-600 text-white py-2 text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50">
                {editMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Delete Case?</h3>
            </div>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <p className="text-sm text-slate-500 mb-5">
                This will permanently delete case {deleteItem.firNumber || deleteItem._id}. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-sm font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white py-2 text-sm font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50">
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

export default Cases;

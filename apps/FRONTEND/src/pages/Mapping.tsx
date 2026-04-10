import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMappingHierarchy, createOfficer, updateOfficer, deleteOfficer, reassignOfficerSector } from '../services/endpoints';
import api from '../services/api';
import { X, MapPin, Users, Building2, Search, Download, GripHorizontal, Plus, Pencil, Trash2, Save, Ban } from 'lucide-react';
import type { MappingZone } from '../types';

interface FlatOfficer {
  _id: string;
  sectorId: string;
  stationName: string;
  shoName: string;
  sectorName: string;
  name: string;
  badgeNumber: string;
  recruitmentType: string;
  rank: string;
  phone: string;
  batch: number | string;
  remarks: string;
}

interface EditForm {
  name: string;
  recruitmentType: string;
  rank: string;
  phone: string;
  batch: string;
  remarks: string;
  sectorId: string;
}

const RANKS = ['CONSTABLE', 'HEAD_CONSTABLE', 'ASI', 'PSI', 'SI', 'WSI', 'CI', 'ACP', 'DCP', 'ADDL_CP', 'COMMISSIONER'];

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  CZ:   { bg: 'bg-red-600',    border: 'border-red-200',    text: 'text-red-700',    light: 'bg-red-50' },
  GKZ:  { bg: 'bg-amber-600',  border: 'border-amber-200',  text: 'text-amber-700',  light: 'bg-amber-50' },
  JHZ:  { bg: 'bg-emerald-600',border: 'border-emerald-200',text: 'text-emerald-700', light: 'bg-emerald-50' },
  KZ:   { bg: 'bg-blue-600',   border: 'border-blue-200',   text: 'text-blue-700',   light: 'bg-blue-50' },
  RJNR: { bg: 'bg-purple-600', border: 'border-purple-200', text: 'text-purple-700',  light: 'bg-purple-50' },
  SZ:   { bg: 'bg-cyan-600',   border: 'border-cyan-200',   text: 'text-cyan-700',   light: 'bg-cyan-50' },
  SMZ:  { bg: 'bg-orange-600', border: 'border-orange-200', text: 'text-orange-700',  light: 'bg-orange-50' },
};

const emptyForm: EditForm = { name: '', recruitmentType: 'DIRECT', rank: 'SI', phone: '', batch: '', remarks: '', sectorId: '' };

const Mapping: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mappingHierarchy'],
    queryFn: async () => {
      const res = await getMappingHierarchy();
      return res.data.data as MappingZone[];
    },
  });

  const [selectedZone, setSelectedZone] = useState<MappingZone | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [addingRow, setAddingRow] = useState(false);
  const [addForm, setAddForm] = useState<EditForm & { sectorId: string }>({ ...emptyForm, sectorId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Draggable modal state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const onMouseMove = (ev: MouseEvent) => {
      setPos({ x: ev.clientX - dragStart.current.x, y: ev.clientY - dragStart.current.y });
    };
    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pos]);

  // Mutations
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['mappingHierarchy'] });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Record<string, unknown> }) => updateOfficer(id, d),
    onSuccess: () => { refetch(); setEditingId(null); setSaving(false); },
    onError: () => setSaving(false),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOfficer(id),
    onSuccess: () => { refetch(); setDeleteConfirm(null); setSaving(false); },
    onError: () => setSaving(false),
  });

  const addMut = useMutation({
    mutationFn: async (form: EditForm & { sectorId: string }) => {
      const badge = `HCP-${Date.now().toString().slice(-4)}`;
      const res = await createOfficer({
        name: form.name,
        badgeNumber: badge,
        rank: form.rank,
        phone: form.phone,
        recruitmentType: form.recruitmentType,
        batch: form.batch ? parseInt(form.batch) : undefined,
        remarks: form.remarks,
        email: `${badge.toLowerCase()}@hcp.gov.in`,
      });
      const officerId = res.data.data._id;
      await api.post(`/officers/${officerId}/assign-sector`, { sectorId: form.sectorId, role: 'SI' });
      return res;
    },
    onSuccess: () => { refetch(); setAddingRow(false); setAddForm({ ...emptyForm, sectorId: '' }); setSaving(false); },
    onError: () => setSaving(false),
  });

  // Flatten zone — include IDs for CRUD
  const flatOfficers = useMemo((): FlatOfficer[] => {
    if (!selectedZone) return [];
    const rows: FlatOfficer[] = [];
    selectedZone.divisions.forEach((div) => {
      div.circles.forEach((circle) => {
        circle.stations.forEach((station) => {
          // Find SHO: officer whose remarks include 'admin'
          let shoName = '—';
          station.sectors.forEach((sector) => {
            sector.officers?.forEach((off) => {
              const role = (off.remarks || off.role || '').toLowerCase();
              if (role.includes('admin') && shoName === '—') {
                shoName = off.name;
              }
            });
          });

          station.sectors.forEach((sector) => {
            if (sector.officers && sector.officers.length > 0) {
              sector.officers.forEach((off) => {
                rows.push({
                  _id: off._id,
                  sectorId: sector._id,
                  stationName: station.name,
                  shoName,
                  sectorName: sector.name,
                  name: off.name,
                  badgeNumber: off.badgeNumber,
                  recruitmentType: off.recruitmentType || 'DIRECT',
                  rank: off.rank || 'SI',
                  phone: off.phone,
                  batch: off.batch || '',
                  remarks: off.remarks || off.role || '',
                });
              });
            }
          });
        });
      });
    });
    return rows;
  }, [selectedZone]);

  // Sectors for add dropdown
  const zoneSectors = useMemo(() => {
    if (!selectedZone) return [];
    const sectors: { id: string; label: string }[] = [];
    selectedZone.divisions.forEach((div) =>
      div.circles.forEach((circle) =>
        circle.stations.forEach((station) =>
          station.sectors.forEach((sec) => {
            sectors.push({ id: sec._id, label: `${station.name} — ${sec.name}` });
          })
        )
      )
    );
    return sectors;
  }, [selectedZone]);

  const filteredOfficers = useMemo(() => {
    if (!search) return flatOfficers;
    const q = search.toLowerCase();
    return flatOfficers.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.stationName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        String(o.remarks).toLowerCase().includes(q)
    );
  }, [flatOfficers, search]);

  // Download CSV
  const downloadCSV = useCallback(() => {
    if (!selectedZone || filteredOfficers.length === 0) return;
    const headers = ['S.No', 'Police Station', 'SHO Name', 'Sector', 'Officer Name', 'Rank', 'Phone Number', 'Batch'];
    const csvRows = [headers.join(',')];
    filteredOfficers.forEach((off, i) => {
      csvRows.push([
        i + 1, `"${off.stationName}"`, `"${off.shoName}"`,
        `"${off.remarks || off.sectorName}"`, `"${off.name}"`,   
        off.rank, off.phone, off.batch,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedZone.name.replace(/\s+/g, '_')}_SIs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedZone, filteredOfficers]);

  // Edit handlers
  const startEdit = (off: FlatOfficer) => {
    setEditingId(off._id);
    setEditForm({
      name: off.name,
      recruitmentType: off.recruitmentType,
      rank: off.rank,
      phone: off.phone,
      batch: String(off.batch),
      remarks: off.remarks,
      sectorId: off.sectorId,
    });
  };

  const reassignMut = useMutation({
    mutationFn: ({ id, sectorId }: { id: string; sectorId: string }) => reassignOfficerSector(id, sectorId),
    onSuccess: () => refetch(),
  });

  const saveEdit = () => {
    if (!editingId) return;
    setSaving(true);
    // Find original officer to check if sector changed
    const original = flatOfficers.find((o) => o._id === editingId);
    if (original && editForm.sectorId !== original.sectorId) {
      reassignMut.mutate({ id: editingId, sectorId: editForm.sectorId });
    }
    updateMut.mutate({
      id: editingId,
      data: {
        name: editForm.name,
        recruitmentType: editForm.recruitmentType,
        rank: editForm.rank,
        phone: editForm.phone,
        batch: editForm.batch ? parseInt(editForm.batch) : undefined,
        remarks: editForm.remarks,
      },
    });
  };

  const confirmDelete = (id: string) => {
    setSaving(true);
    deleteMut.mutate(id);
  };

  const saveAdd = () => {
    if (!addForm.name || !addForm.phone || !addForm.sectorId) return;
    setSaving(true);
    addMut.mutate(addForm);
  };

  // Zone stats
  const getZoneStats = (zone: MappingZone) => {
    let stations = 0, officers = 0;
    zone.divisions.forEach((d) =>
      d.circles.forEach((c) =>
        c.stations.forEach((s) => {
          stations++;
          s.sectors.forEach((sec) => { officers += sec.officers?.length || 0; });
        })
      )
    );
    return { stations, officers };
  };

  const openZone = (zone: MappingZone) => {
    setSelectedZone(zone);
    setSearch('');
    setPos({ x: 0, y: 0 });
    setEditingId(null);
    setAddingRow(false);
    setDeleteConfirm(null);
  };

  const inputCls = 'border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400';

  if (isLoading)
    return <div className="flex items-center justify-center p-12 text-gray-400">Loading zone data…</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Zone → Area → Officers Mapping</h1>
        <p className="text-sm text-gray-500 mt-1">Click on a zone to view, add, edit, or delete officers</p>
      </div>

      {/* Zone Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data?.map((zone) => {
          const stats = getZoneStats(zone);
          const color = ZONE_COLORS[zone.code] || ZONE_COLORS.CZ;
          return (
            <button
              key={zone._id}
              onClick={() => openZone(zone)}
              className={`relative overflow-hidden rounded-xl border-2 ${color.border} ${color.light} p-5 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className={`absolute top-0 right-0 w-20 h-20 ${color.bg} opacity-10 rounded-bl-full`} />
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${color.bg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                  {zone.code}
                </div>
                <div>
                  <h3 className={`font-bold ${color.text}`}>{zone.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Building2 size={12} />{stats.stations} Stations</span>
                    <span className="flex items-center gap-1"><Users size={12} />{stats.officers} Officers</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Draggable Modal */}
      {selectedZone && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedZone(null)}>
          <div
            className="absolute bg-white rounded-2xl shadow-2xl flex flex-col"
            style={{
              left: `calc(50% + ${pos.x}px)`,
              top: `calc(50% + ${pos.y}px)`,
              transform: 'translate(-50%, -50%)',
              width: 'min(95vw, 1200px)',
              maxHeight: '90vh',
              cursor: isDragging ? 'grabbing' : 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle + Header */}
            {(() => {
              const color = ZONE_COLORS[selectedZone.code] || ZONE_COLORS.CZ;
              return (
                <div className={`${color.bg} text-white rounded-t-2xl flex-shrink-0`}>
                  <div className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing select-none" onMouseDown={onMouseDown}>
                    <GripHorizontal size={18} className="opacity-50" />
                  </div>
                  <div className="px-6 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{selectedZone.name} SIs Information</h2>
                      <p className="text-sm opacity-80 mt-0.5">
                        {flatOfficers.length} Officers across {getZoneStats(selectedZone).stations} Police Stations
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
                        <input
                          type="text"
                          placeholder="Search…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="bg-white/20 border border-white/30 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 w-44"
                        />
                      </div>
                      <button onClick={() => { setAddingRow(true); setEditingId(null); }} className="p-1.5 rounded-lg hover:bg-white/20 transition" title="Add Officer">
                        <Plus size={18} />
                      </button>
                      <button onClick={downloadCSV} className="p-1.5 rounded-lg hover:bg-white/20 transition" title="Download CSV">
                        <Download size={18} />
                      </button>
                      <button onClick={() => setSelectedZone(null)} className="p-1.5 rounded-lg hover:bg-white/20 transition" title="Close">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">S.No</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Police Station</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">SHO Name</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Sector</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Officer Name</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Rank</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Phone Number</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Batch</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Add Row */}
                  {addingRow && (
                    <tr className="bg-green-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">NEW</td>
                      <td className="px-3 py-2">
                        <select value={addForm.sectorId} onChange={(e) => setAddForm({ ...addForm, sectorId: e.target.value })} className={inputCls}>
                          <option value="">Select station / sector…</option>
                          {zoneSectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">Auto</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">Auto</td>
                      <td className="px-3 py-2"><input className={inputCls} placeholder="Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></td>
                      <td className="px-3 py-2">
                        <select className={inputCls} value={addForm.rank} onChange={(e) => setAddForm({ ...addForm, rank: e.target.value })}>
                          {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input className={inputCls} placeholder="Phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} /></td>
                      <td className="px-3 py-2"><input className={inputCls} placeholder="Batch" value={addForm.batch} onChange={(e) => setAddForm({ ...addForm, batch: e.target.value })} /></td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={saveAdd} disabled={saving || !addForm.name || !addForm.phone || !addForm.sectorId} className="p-1 rounded hover:bg-green-200 text-green-700 disabled:opacity-40" title="Save">
                            <Save size={15} />
                          </button>
                          <button onClick={() => { setAddingRow(false); setAddForm({ ...emptyForm, sectorId: '' }); }} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Cancel">
                            <Ban size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredOfficers.length === 0 && !addingRow ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        {search ? 'No matching officers found' : 'No officers in this zone'}
                      </td>
                    </tr>
                  ) : (
                    filteredOfficers.map((off, idx) => {
                      const isEditing = editingId === off._id;
                      const isDeleting = deleteConfirm === off._id;

                      if (isEditing) {
                        return (
                          <tr key={off._id} className="bg-blue-50">
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{idx + 1}</td>
                            <td colSpan={3} className="px-3 py-2">
                              <select className={inputCls} value={editForm.sectorId} onChange={(e) => setEditForm({ ...editForm, sectorId: e.target.value })}>
                                {zoneSectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input className={inputCls} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                            <td className="px-3 py-2">
                              <select className={inputCls} value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })}>
                                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input className={inputCls} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                            <td className="px-3 py-2"><input className={inputCls} value={editForm.batch} onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })} /></td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-green-200 text-green-700 disabled:opacity-40" title="Save">
                                  <Save size={15} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Cancel">
                                  <Ban size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      if (isDeleting) {
                        return (
                          <tr key={off._id} className="bg-red-50">
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{idx + 1}</td>
                            <td colSpan={7} className="px-3 py-2">
                              <span className="text-red-700 font-medium">Delete <strong>{off.name}</strong> ({off.badgeNumber})? This cannot be undone.</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => confirmDelete(off._id)} disabled={saving} className="px-2 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40">
                                  Yes, Delete
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300">
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const isHighlighted = off.rank === 'WSI' || String(off.remarks).toLowerCase().includes('admin');

                      return (
                        <tr key={off._id} className={`hover:bg-blue-50/50 transition-colors ${isHighlighted ? 'bg-yellow-50' : ''}`}>
                          <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={12} className="text-red-400 flex-shrink-0" />
                              <span className="font-medium text-gray-700">{off.stationName}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">{off.shoName}</td>
                          <td className="px-3 py-2.5">
                            {(() => {
                              const r = (off.remarks || '').toLowerCase();
                              const cls = r.includes('admin') ? 'bg-yellow-100 text-yellow-800' :
                                r.includes('dsi') ? 'bg-orange-100 text-orange-700' :
                                r.includes('maternity') || r.includes('sick') ? 'bg-red-100 text-red-600' :
                                r.includes('crime') || r.includes('general') ? 'bg-purple-100 text-purple-700' :
                                'bg-blue-100 text-blue-700';
                              return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{off.remarks || off.sectorName}</span>;
                            })()}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{off.name}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              off.rank === 'WSI' ? 'bg-pink-100 text-pink-700' :
                              off.rank === 'PSI' ? 'bg-teal-100 text-teal-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {off.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{off.phone}</td>
                          <td className="px-3 py-2.5 text-gray-600">{off.batch || '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => startEdit(off)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { setDeleteConfirm(off._id); setEditingId(null); }} className="p-1 rounded hover:bg-red-100 text-red-500" title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="border-t px-6 py-3 flex items-center justify-between text-sm text-gray-500 flex-shrink-0">
              <span>
                {search ? `${filteredOfficers.length} of ${flatOfficers.length} officers` : `Total: ${flatOfficers.length} officers`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAddingRow(true); setEditingId(null); }}
                  className="px-4 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Officer
                </button>
                <button
                  onClick={downloadCSV}
                  className="px-4 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition flex items-center gap-1.5"
                >
                  <Download size={14} /> Download CSV
                </button>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="px-4 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mapping;

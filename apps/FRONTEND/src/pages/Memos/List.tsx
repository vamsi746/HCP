import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, deleteMemo, getHierarchy, getMemoCounts } from '../../services/endpoints';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Eye, Send, CheckCircle2, Clock, Edit3, ChevronLeft, ChevronRight, Filter, RotateCcw, Shield, MapPin, Calendar } from 'lucide-react';
import FilterDropdown from '../../components/FilterDropdown';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo, MemoStatus } from '../../types';

type MemoListStatusFilter = MemoStatus | '' | 'APPROVED,ON_HOLD,REJECTED';

const STATUS_TABS: { key: MemoListStatusFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_REVIEW', label: 'Pending Review' },
  { key: 'APPROVED,ON_HOLD,REJECTED', label: 'Reviewed' },
  { key: 'SENT', label: 'Sent' },
];

const STATUS_CONFIG: Record<MemoStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-amber-600', text: 'text-white', label: 'DRAFT' },
  PENDING_REVIEW: { bg: 'bg-blue-700', text: 'text-white', label: 'PENDING' },
  REVIEWED: { bg: 'bg-indigo-700', text: 'text-white', label: 'REVIEWED' },
  ON_HOLD: { bg: 'bg-orange-600', text: 'text-white', label: 'ON HOLD' },
  REJECTED: { bg: 'bg-red-700', text: 'text-white', label: 'REJECTED' },
  APPROVED: { bg: 'bg-emerald-700', text: 'text-white', label: 'APPROVED' },
  SENT: { bg: 'bg-slate-700', text: 'text-white', label: 'SENT' },
};

const MemoList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MemoListStatusFilter>('');
  const [page, setPage] = useState(1);
  const [deleteItem, setDeleteItem] = useState<Memo | null>(null);

  // Filter state
  const [filterZoneId, setFilterZoneId] = useState('');
  const [filterPsId, setFilterPsId] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Hierarchy for cascading dropdowns
  const { data: hierarchyData } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: async () => { const res = await getHierarchy(); return res.data.data; },
    staleTime: 5 * 60 * 1000,
  });

  const allStations = useMemo(() => {
    if (!hierarchyData) return [];
    const stations: { _id: string; name: string; zoneId: string }[] = [];
    for (const zone of hierarchyData) {
      for (const div of zone.divisions || []) {
        for (const circle of div.circles || []) {
          for (const station of circle.stations || []) {
            stations.push({ _id: station._id, name: station.name, zoneId: zone._id });
          }
        }
      }
    }
    return stations;
  }, [hierarchyData]);

  const filteredStations = filterZoneId ? allStations.filter((s) => s.zoneId === filterZoneId) : allStations;

  const allSectors = useMemo(() => {
    if (!hierarchyData) return [];
    const sectors: { _id: string; name: string; psId: string; zoneId: string }[] = [];
    for (const zone of hierarchyData) {
      for (const div of zone.divisions || []) {
        for (const circle of div.circles || []) {
          for (const station of circle.stations || []) {
            for (const sec of station.sectors || []) {
              if (sec.name && sec.name !== 'Sector 0') {
                sectors.push({ _id: sec._id, name: sec.name, psId: station._id, zoneId: zone._id });
              }
            }
          }
        }
      }
    }
    return sectors;
  }, [hierarchyData]);

  const sectorList = useMemo(() => {
    let sectors = allSectors;
    if (filterPsId) sectors = allSectors.filter((s) => s.psId === filterPsId);
    else if (filterZoneId) sectors = allSectors.filter((s) => s.zoneId === filterZoneId);
    // Deduplicate by name
    const seen = new Set<string>();
    return sectors.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [allSectors, filterPsId, filterZoneId]);

  const hasActiveFilters = filterZoneId || filterPsId || filterSector || filterDateFrom || filterDateTo;

  const onZoneChange = (v: string) => {
    setFilterZoneId(v);
    if (v && filterPsId) {
      const ps = allStations.find((s) => s._id === filterPsId);
      if (ps && ps.zoneId !== v) { setFilterPsId(''); setFilterSector(''); }
    }
    setPage(1);
  };

  const onPsChange = (v: string) => {
    setFilterPsId(v);
    if (v) {
      const ps = allStations.find((s) => s._id === v);
      if (ps && !filterZoneId) setFilterZoneId(ps.zoneId);
      if (ps && filterZoneId && ps.zoneId !== filterZoneId) setFilterZoneId(ps.zoneId);
    }
    setPage(1);
  };

  const clearFilters = () => {
    setFilterZoneId('');
    setFilterPsId('');
    setFilterSector('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['memos', statusFilter, page, filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      const res = await getMemos(params);
      return res.data;
    },
  });

  // Live counts for all tabs
  const { data: countsData } = useQuery({
    queryKey: ['memos-counts', filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      const res = await getMemoCounts(params);
      return res.data.data as Record<string, number>;
    },
  });

  const getTabCount = (tabKey: string): number => {
    if (!countsData) return 0;
    if (tabKey === '') return Object.values(countsData).reduce((sum, c) => sum + c, 0);
    const statuses = tabKey.split(',');
    return statuses.reduce((sum, s) => sum + (countsData[s] || 0), 0);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMemo(id),
    onSuccess: () => { toast.success('Memo deleted'); queryClient.invalidateQueries({ queryKey: ['memos'] }); queryClient.invalidateQueries({ queryKey: ['memos-counts'] }); setDeleteItem(null); },
    onError: () => toast.error('Failed to delete memo'),
  });

  const memos: Memo[] = data?.data || [];
  const total: number = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Official header */}
      <div className="bg-[#003366] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-b-2 border-[#B8860B]">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Memos & Compliance Register</h1>
        <p className="text-[11px] text-neutral-400 mt-0.5">Hyderabad City Police — Commissioner's Task Force</p>
      </div>

      {/* Status filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider mr-1">Status:</span>
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = getTabCount(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider border transition-all ${
                isActive
                  ? 'bg-[#003366] text-white border-[#003366]'
                  : 'bg-white text-[#4A5568] border-[#D9DEE4] hover:bg-[#F4F5F7] hover:border-[#003366]/30'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 font-bold rounded-sm ${
                isActive ? 'bg-white/20 text-white' : 'bg-[#718096] text-white'
              }`}>{count}</span>
            </button>
          );
        })}
        
      </div>

      {/* Zone / PS / Sector / Date filters */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <FilterDropdown
          icon={<Filter size={13} />}
          placeholder="All Zones"
          value={filterZoneId}
          onChange={onZoneChange}
          options={(hierarchyData || []).map((z: any) => ({ value: z._id, label: z.name }))}
        />
        <FilterDropdown
          icon={<Shield size={13} />}
          placeholder="All Stations"
          value={filterPsId}
          onChange={onPsChange}
          options={filteredStations.map((s) => ({ value: s._id, label: s.name }))}
          searchable
        />
        <FilterDropdown
          icon={<MapPin size={13} />}
          placeholder="All Sectors"
          value={filterSector}
          onChange={(v) => { setFilterSector(v); setPage(1); }}
          options={sectorList.map((s: any) => ({ value: s.name, label: s.name }))}
        />
        <div className="w-px h-6 bg-[#D9DEE4] mx-1" />
        <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
          <Calendar size={13} className="flex-shrink-0 opacity-50" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[115px]"
          />
        </div>
        <span className="text-[11px] text-[#718096] font-semibold">to</span>
        <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
          <Calendar size={13} className="flex-shrink-0 opacity-50" />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[115px]"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(155,44,44,0.12)] border border-[#9B2C2C]/15 text-[#9B2C2C] pl-2.5 pr-3 py-[7px] rounded-lg text-[12px] font-semibold hover:bg-[#9B2C2C]/5 hover:shadow-[0_2px_6px_rgba(155,44,44,0.18)] transition-all"
          >
            <RotateCcw size={12} />
            Clear All
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-300 bg-white">
        <table className="w-full text-[13px] table-fixed">
          <thead>
            <tr className="bg-[#003366] text-white text-left">
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[50px] text-center">S.No</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[100px]">Status</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[100px]">Date</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[18%]">Zone / PS</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[90px]">Cr. No</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[20%]">Sections</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[15%]">Issued To</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[13%]">Generated By</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[80px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium">Loading records…</td></tr>
            ) : memos.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13px] font-semibold text-slate-500">No memos found</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Generate a memo from a DSR case to get started.</p>
                </td>
              </tr>
            ) : (
              memos.map((memo, idx) => {
                const cfg = STATUS_CONFIG[memo.status];
                const generatedBy = typeof memo.generatedBy === 'object' ? memo.generatedBy : null;
                const sNo = (page - 1) * 20 + idx + 1;
                return (
                  <tr
                    key={memo._id}
                    onClick={() => navigate(`/compliance/${memo._id}`)}
                    className={`border-b border-slate-200 cursor-pointer transition-colors hover:bg-blue-50/60 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-500 text-center">{sNo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium tabular-nums">
                      {format(new Date(memo.date), 'dd-MM-yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{memo.zone ? `${memo.zone} Zone` : '—'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{memo.policeStation || '—'} PS</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{memo.crimeNo || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                      <span className="line-clamp-2 text-[12px]" title={memo.sections ? `u/s ${memo.sections}` : ''}>
                        {memo.sections ? `u/s ${memo.sections}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {memo.recipientName ? (
                        <div>
                          <div className="font-semibold text-slate-700">{memo.recipientName}</div>
                          <div className="text-[11px] text-slate-400">{memo.recipientDesignation || memo.recipientType || ''}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {generatedBy ? (
                        <div>
                          <div className="font-medium text-slate-700 text-[12px]">{generatedBy.name}</div>
                          <div className="text-[11px] text-slate-400">{generatedBy.rank}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/compliance/${memo._id}`); }}
                          className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="View / Edit"
                        >
                          <Eye size={15} />
                        </button>
                        {memo.status === 'DRAFT' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteItem(memo); }}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteItem(null)}>
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-700" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-1">Delete Memo?</h3>
            <p className="text-[13px] text-slate-500 mb-5">This action is permanent and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-700 text-white py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-red-800 disabled:opacity-50 transition-colors">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoList;

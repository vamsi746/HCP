import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOfficerMemoTracker, getOfficerMemos, getHierarchy } from '../services/endpoints';
import FilterDropdown from '../components/FilterDropdown';
import {
  Filter, Shield, MapPin, Search, ChevronDown, ChevronRight,
  FileText, Calendar, RotateCcw, AlertTriangle, UserCheck,
  Eye, AlertOctagon, Users, TriangleAlert,
} from 'lucide-react';
import { format } from 'date-fns';

interface TrackerRow {
  officerId: string;
  name: string;
  badgeNumber: string;
  rank: string;
  phone: string;
  remarks: string;
  sector: string;
  sectorId: string;
  policeStation: string;
  psId: string;
  zone: string;
  zoneId: string;
  role: string;
  memoCount: number;
}

interface OfficerMemo {
  _id: string;
  memoNumber: string;
  crimeNo: string;
  policeStation: string;
  zone: string;
  sections: string;
  date: string;
  status: string;
  subject: string;
}

const RANK_LABELS: Record<string, string> = {
  COMMISSIONER: 'CP',
  ADDL_CP: 'Addl. CP',
  DCP: 'DCP',
  ACP: 'ACP',
  CI: 'CI',
  SI: 'SI',
  WSI: 'WSI',
  PSI: 'PSI',
  ASI: 'ASI',
  HEAD_CONSTABLE: 'HC',
  CONSTABLE: 'Const.',
};

type ViewMode = 'all' | 'with-memos' | 'action-required';

const OfficerTracker: React.FC = () => {
  const navigate = useNavigate();
  const [filterZoneId, setFilterZoneId] = useState('');
  const [filterPsId, setFilterPsId] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [search, setSearch] = useState('');
  const [expandedOfficer, setExpandedOfficer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('with-memos');

  // Hierarchy for dropdown options
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
    const seen = new Set<string>();
    return sectors.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [allSectors, filterPsId, filterZoneId]);

  const hasActiveFilters = filterZoneId || filterPsId || filterSector || search;

  const onZoneChange = (v: string) => {
    setFilterZoneId(v);
    if (v && filterPsId) {
      const ps = allStations.find((s) => s._id === filterPsId);
      if (ps && ps.zoneId !== v) { setFilterPsId(''); setFilterSector(''); }
    }
  };

  const onPsChange = (v: string) => {
    setFilterPsId(v);
    if (v) {
      const ps = allStations.find((s) => s._id === v);
      if (ps && !filterZoneId) setFilterZoneId(ps.zoneId);
      if (ps && filterZoneId && ps.zoneId !== filterZoneId) setFilterZoneId(ps.zoneId);
    }
  };

  const clearFilters = () => {
    setFilterZoneId('');
    setFilterPsId('');
    setFilterSector('');
    setSearch('');
  };

  // Fetch tracker data
  const { data: trackerData, isLoading } = useQuery({
    queryKey: ['officer-memo-tracker', filterZoneId, filterPsId, filterSector, search],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (search.trim()) params.search = search.trim();
      const res = await getOfficerMemoTracker(params);
      return res.data.data as TrackerRow[];
    },
  });

  const allRows = trackerData || [];

  // Filter by view mode
  const rows = useMemo(() => {
    if (viewMode === 'with-memos') return allRows.filter((r) => r.memoCount > 0);
    if (viewMode === 'action-required') return allRows.filter((r) => r.memoCount >= 3);
    return allRows;
  }, [allRows, viewMode]);

  // Stats (always from allRows)
  const totalOfficers = allRows.length;
  const officersWithMemos = allRows.filter((r) => r.memoCount > 0).length;
  const totalMemos = allRows.reduce((sum, r) => sum + r.memoCount, 0);
  const actionRequired = allRows.filter((r) => r.memoCount >= 3).length;

  const getWarningLevel = (count: number) => {
    if (count === 0) return { label: 'Clean', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
    if (count === 1) return { label: '1st Warning', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    if (count === 2) return { label: '2nd Warning', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    if (count === 3) return { label: '3rd Warning', color: 'bg-red-100 text-red-700 border-red-300' };
    return { label: 'Action Due', color: 'bg-red-600 text-white border-red-700' };
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-[#003366] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-b-2 border-[#B8860B]">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Officer Wise Memo Tracker</h1>
        <p className="text-[11px] text-neutral-400 mt-0.5">Track warning memos issued to officers — 3 warnings trigger punishable action</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setViewMode('all')}
          className={`border rounded-lg px-4 py-3 flex items-center gap-3 text-left transition-all ${
            viewMode === 'all' ? 'ring-2 ring-[#003366] border-[#003366] bg-blue-50' : 'bg-blue-50 border-blue-200 hover:border-blue-300'
          }`}
        >
          <Users size={22} className="text-[#003366]" />
          <div>
            <p className="text-xl font-bold text-slate-800">{totalOfficers}</p>
            <p className="text-[11px] text-slate-500 font-medium">Total Officers</p>
          </div>
        </button>
        <button
          onClick={() => setViewMode('with-memos')}
          className={`border rounded-lg px-4 py-3 flex items-center gap-3 text-left transition-all ${
            viewMode === 'with-memos' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50' : 'bg-amber-50 border-amber-200 hover:border-amber-300'
          }`}
        >
          <AlertTriangle size={22} className="text-amber-600" />
          <div>
            <p className="text-xl font-bold text-slate-800">{officersWithMemos}</p>
            <p className="text-[11px] text-slate-500 font-medium">Officers With Warnings</p>
          </div>
        </button>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <FileText size={22} className="text-blue-600" />
          <div>
            <p className="text-xl font-bold text-slate-800">{totalMemos}</p>
            <p className="text-[11px] text-slate-500 font-medium">Total Memos Issued</p>
          </div>
        </div>
        <button
          onClick={() => setViewMode('action-required')}
          className={`border rounded-lg px-4 py-3 flex items-center gap-3 text-left transition-all ${
            viewMode === 'action-required' ? 'ring-2 ring-red-500 border-red-500 bg-red-50' : 'bg-red-50 border-red-200 hover:border-red-300'
          }`}
        >
          <AlertOctagon size={22} className="text-red-600" />
          <div>
            <p className="text-xl font-bold text-slate-800">{actionRequired}</p>
            <p className="text-[11px] text-red-600 font-bold">Action Required (3+ Memos)</p>
          </div>
        </button>
      </div>

      {/* Filters */}
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
          onChange={(v) => setFilterSector(v)}
          options={sectorList.map((s) => ({ value: s.name, label: s.name }))}
        />
        <div className="w-px h-6 bg-[#D9DEE4] mx-1" />
        <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
          <Search size={13} className="flex-shrink-0 opacity-50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search officer name"
            className="text-[12px] font-semibold bg-transparent focus:outline-none text-[#1C2334] w-[180px] placeholder:text-slate-400"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(155,44,44,0.12)] border border-[#9B2C2C]/15 text-[#9B2C2C] pl-2.5 pr-3 py-[7px] rounded-lg text-[12px] font-semibold hover:bg-[#9B2C2C]/5 hover:shadow-[0_2px_6px_rgba(155,44,44,0.18)] transition-all"
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-300 bg-white rounded-sm overflow-hidden">
        <table className="w-full text-[13px] table-fixed">
          <thead>
            <tr className="bg-[#003366] text-white text-left">
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[46px] text-center">Sl.</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[13%]">Zone</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[15%]">Police Station</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[9%]">Sector</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[18%]">Officer Name</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[7%]">Rank</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[10%]">Role</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[8%] text-center">Memos</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[14%] text-center">Warning Level</th>
              <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-[40px] text-center"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="px-4 py-16 text-center text-slate-400 font-medium">Loading officers…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <UserCheck size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13px] font-semibold text-slate-500">
                    {viewMode === 'with-memos' ? 'No officers with warning memos' :
                     viewMode === 'action-required' ? 'No officers require punishable action' :
                     'No officers found'}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Adjust your filters to see results.</p>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isExpanded = expandedOfficer === row.officerId;
                const warning = getWarningLevel(row.memoCount);
                return (
                  <React.Fragment key={`${row.officerId}-${row.sectorId}-${idx}`}>
                    <tr
                      onClick={() => row.memoCount > 0 ? setExpandedOfficer(isExpanded ? null : row.officerId) : undefined}
                      className={`border-b border-slate-100 transition-colors ${
                        row.memoCount > 0 ? 'cursor-pointer hover:bg-blue-50/60' : ''
                      } ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${
                        isExpanded ? '!bg-blue-50' : ''
                      } ${row.memoCount >= 3 ? 'border-l-[3px] border-l-red-500' : ''}`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-slate-400 text-[12px]">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 truncate">{row.zone}</td>
                      <td className="px-3 py-2.5 text-slate-700 truncate">{row.policeStation}</td>
                      <td className="px-3 py-2.5 text-slate-600 truncate">{row.sector}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800 truncate">{row.name}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-bold text-[#003366] bg-[#003366]/10 px-1.5 py-0.5 rounded">
                          {RANK_LABELS[row.rank] || row.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-500 truncate">{row.role.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[13px] font-bold text-slate-800">{row.memoCount}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider rounded border ${warning.color}`}>
                          {warning.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.memoCount > 0 && (
                          isExpanded
                            ? <ChevronDown size={14} className="text-[#003366] mx-auto" />
                            : <ChevronRight size={14} className="text-slate-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="px-0 py-0 bg-slate-50/80">
                          <ExpandedMemos
                            officerId={row.officerId}
                            officerName={row.name}
                            memoCount={row.memoCount}
                            onViewMemo={(memoId) => navigate(`/memos/${memoId}`)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!isLoading && rows.length > 0 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
            Showing {rows.length} of {totalOfficers} officers
            {viewMode === 'with-memos' && ' (with warnings)'}
            {viewMode === 'action-required' && ' (action required)'}
          </span>
        </div>
      )}
    </div>
  );
};

// Expanded memo list for an officer
const ExpandedMemos: React.FC<{
  officerId: string;
  officerName: string;
  memoCount: number;
  onViewMemo: (memoId: string) => void;
}> = ({ officerId, officerName, memoCount, onViewMemo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['officer-memos', officerId],
    queryFn: async () => {
      const res = await getOfficerMemos(officerId);
      return res.data.data as OfficerMemo[];
    },
  });

  const memos = data || [];

  return (
    <div className="px-8 py-4">
      {/* Header with warning progress */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-[#003366] uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={12} />
          Warning Memos — {officerName}
        </p>
        <div className="flex items-center gap-2">
          {/* Warning progress dots */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  memoCount >= i
                    ? i === 3 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  {i}
                </div>
                {i < 3 && <div className={`w-4 h-0.5 ${memoCount >= i + 1 ? 'bg-amber-400' : 'bg-slate-200'}`} />}
              </div>
            ))}
            <span className="text-[10px] font-bold text-slate-400 ml-1">/ 3</span>
          </div>
          {memoCount >= 3 && (
            <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              <TriangleAlert size={10} />
              PUNISHABLE ACTION DUE
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-[12px] text-slate-400 py-3">Loading memos…</p>
      ) : memos.length === 0 ? (
        <p className="text-[12px] text-slate-400 py-3">No memos found.</p>
      ) : (
        <table className="w-full text-[12px] border border-slate-200 rounded overflow-hidden bg-white">
          <thead>
            <tr className="bg-[#003366]/5 text-left">
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider w-[60px]">Warning</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider w-[100px]">Date</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider w-[90px]">Cr. No</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider">Police Station</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider">Sections</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider w-[80px]">Status</th>
              <th className="px-3 py-2 font-bold text-[10px] text-[#003366] uppercase tracking-wider w-[70px] text-center">View</th>
            </tr>
          </thead>
          <tbody>
            {memos.map((m, i) => {
              const warningNum = memos.length - i; // oldest memo = 1st warning
              return (
                <tr key={m._id} className={`border-t border-slate-100 ${i % 2 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/40 transition-colors`}>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-full text-[10px] font-bold ${
                      warningNum >= 3 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {warningNum}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 font-medium tabular-nums">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-slate-400" />
                      {format(new Date(m.date), 'dd MMM yyyy')}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-slate-700">{m.crimeNo || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{m.policeStation || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    <span className="line-clamp-1" title={m.sections || ''}>
                      {m.sections ? `u/s ${m.sections}` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider rounded ${
                      m.status === 'SENT' ? 'bg-slate-700 text-white' :
                      m.status === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-blue-700 text-white'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewMemo(m._id); }}
                      className="inline-flex items-center gap-1 text-[#003366] hover:text-[#B8860B] font-bold text-[11px] transition-colors"
                      title="View Memo"
                    >
                      <Eye size={13} />
                      <span className="underline">View</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OfficerTracker;

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDSRs, getDSR, updateDSR, deleteDSR, generateMemo } from '../../services/endpoints';
import StatusBadge from '../../components/StatusBadge';
import { Pencil, Trash2, X, Plus, Eye, ChevronDown, FileSignature, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { DSR, ForceType, ParsedCase } from '../../types';
import { format } from 'date-fns';

const FORCE_LABELS: Record<ForceType, string> = {
  CHARMINAR_GOLCONDA: 'Charminar & Golconda',
  RAJENDRANAGAR_SHAMSHABAD: 'Rajendra Nagar & Shamshabad',
  KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS: 'Khairatabad, Secunderabad & Jubilee Hills',
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
  const [expandedDSR, setExpandedDSR] = useState<string | null>(null);
  const [expandedCases, setExpandedCases] = useState<Record<string, ParsedCase[]>>({});
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [generatingMemoId, setGeneratingMemoId] = useState<string | null>(null);

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

  const handleGenerateMemo = async (e: React.MouseEvent, dsrId: string, caseId: string) => {
    e.stopPropagation();
    setGeneratingMemoId(caseId);
    try {
      const res = await generateMemo({ dsrId, caseId });
      const memo = res.data.data;
      toast.success(res.data.message || 'Memo generated');
      navigate(`/compliance/${memo._id}`);
    } catch {
      toast.error('Failed to generate memo');
    } finally {
      setGeneratingMemoId(null);
    }
  };

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

  const toggleExpand = async (dsrId: string) => {
    if (expandedDSR === dsrId) {
      setExpandedDSR(null);
      setExpandedCaseId(null);
      return;
    }
    setExpandedDSR(dsrId);
    setExpandedCaseId(null);
    if (!expandedCases[dsrId]) {
      try {
        const res = await getDSR(dsrId);
        const dsr = res.data.data as DSR;
        setExpandedCases((prev) => ({ ...prev, [dsrId]: dsr.parsedCases || [] }));
      } catch {
        toast.error('Failed to load cases');
      }
    }
  };

  const dsrs: DSR[] = data?.data || [];
  const total: number = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">DSR & Memo Generation</h1>
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
        <label className="text-sm text-gray-500">Zone Group:</label>
        <select
          value={filterForce}
          onChange={(e) => { setFilterForce(e.target.value as ForceType | ''); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">All Zone Groups</option>
          {(Object.keys(FORCE_LABELS) as ForceType[]).map((ft) => (
            <option key={ft} value={ft}>{FORCE_LABELS[ft]}</option>
          ))}
        </select>
        {total > 0 && <span className="text-xs text-gray-400 ml-auto">{total} report{total !== 1 ? 's' : ''}</span>}
      </div>

      {/* DSR List */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Zone Group</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3 text-center">Cases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Raided By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No DSRs found. Upload one to get started.</td></tr>
            ) : (
              dsrs.map((dsr) => {
                const isExpanded = expandedDSR === dsr._id;
                const cases = expandedCases[dsr._id] || [];

                return (
                  <React.Fragment key={dsr._id}>
                    <tr
                      onClick={() => toggleExpand(dsr._id)}
                      className={`cursor-pointer transition-all duration-200 ${isExpanded ? 'bg-slate-50 shadow-[inset_3px_0_0_theme(colors.blue.500)]' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown size={14} className={isExpanded ? 'text-blue-500' : 'text-gray-400'} />
                          </span>
                          {format(new Date(dsr.date), 'dd MMM yyyy')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{FORCE_LABELS[dsr.forceType] || dsr.forceType}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate text-xs">{dsr.fileName || '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{dsr.totalCases || 0}</td>
                      <td className="px-4 py-3"><StatusBadge status={dsr.processingStatus} /></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{dsr.raidedBy || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); toggleExpand(dsr._id); }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title="View Detail">
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

                    {/* Expanded: parsed cases */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0 bg-gradient-to-b from-slate-100 via-slate-50 to-white">
                          <div className="px-5 pt-3 pb-4">
                            {/* Elevated card container */}
                            <div className="rounded-xl bg-white border border-gray-200/80 shadow-lg shadow-gray-200/50 ring-1 ring-black/[0.03] overflow-hidden">
                              {/* Inner header bar */}
                              <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-2.5 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wider">Parsed Cases — {cases.length} records</span>
                                <span className="text-[10px] text-white/50">{dsr.fileName}</span>
                              </div>

                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-gray-100">
                                    <th className="px-4 py-2.5 bg-slate-50/80">S.No</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Zone</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Social Vice Type</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Cr. No</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">PS</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Sector</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Action Taken By</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Responsible SI</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80">Action</th>
                                    <th className="px-4 py-2.5 bg-slate-50/80 w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cases.length === 0 ? (
                                    <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Loading cases…</td></tr>
                                  ) : (
                                    cases.map((c, cIdx) => {
                                      const matchedOfficer = typeof c.matchedOfficerId === 'object' ? c.matchedOfficerId : null;
                                      const matchedSHO = typeof c.matchedSHOId === 'object' ? c.matchedSHOId : null;
                                      const isCaseExpanded = expandedCaseId === c._id;

                                      return (
                                        <React.Fragment key={c._id}>
                                          <tr
                                            className={`cursor-pointer transition-all duration-150 border-b border-gray-100 last:border-b-0 ${
                                              isCaseExpanded
                                                ? 'bg-blue-50/70 shadow-[inset_3px_0_0_theme(colors.blue.400)]'
                                                : cIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-gray-50/40 hover:bg-slate-50'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); setExpandedCaseId(isCaseExpanded ? null : c._id); }}
                                          >
                                            <td className="px-4 py-2.5 font-bold text-slate-500 w-10">{c.slNo}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{c.zone || '—'}</td>
                                            <td className="px-4 py-2.5">
                                              {c.socialViceType && c.socialViceType !== 'None' ? (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{c.socialViceType}</span>
                                              ) : (
                                                <span className="text-gray-400">None</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 font-mono font-medium">{c.crNo || '—'}</td>
                                            <td className="px-4 py-2.5 text-gray-700 font-medium">{c.policeStation || '—'}</td>
                                            <td className="px-4 py-2.5">
                                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">{c.sector || '—'}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">{c.actionTakenBy || 'Task Force'}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              {matchedOfficer ? (
                                                <span className="text-blue-700 font-semibold">{matchedOfficer.name}</span>
                                              ) : (
                                                <span className="text-gray-400">—</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleGenerateMemo(e, dsr._id, c._id); }}
                                                disabled={generatingMemoId === c._id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-sm transition-all disabled:opacity-50"
                                              >
                                                {generatingMemoId === c._id ? (
                                                  <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                  <FileText size={12} />
                                                )}
                                                {generatingMemoId === c._id ? 'Generating…' : 'Generate Memo'}
                                              </button>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-400">
                                              <span className={`inline-block transition-transform duration-200 ${isCaseExpanded ? 'rotate-180' : ''}`}>
                                                <ChevronDown size={12} />
                                              </span>
                                            </td>
                                          </tr>

                                          {/* Case detail — nested depth card */}
                                          {isCaseExpanded && (
                                            <tr>
                                              <td colSpan={10} className="p-0">
                                                <div className="mx-4 my-2 mb-3">
                                                  {/* Stacked card effect with shadow layers */}
                                                  <div className="relative">
                                                    <div className="absolute inset-x-2 -bottom-1 h-2 bg-slate-200/60 rounded-b-xl" />
                                                    <div className="absolute inset-x-1 -bottom-0.5 h-1 bg-slate-100/80 rounded-b-lg" />
                                                    <div className="relative bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                                                      {/* Blue accent top bar */}
                                                      <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />

                                                      {/* ── Section 1: Case Identity ── */}
                                                      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2 mb-3">
                                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Case Identity</span>
                                                          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                                                          {c.warningGenerated && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600 uppercase">Warning Generated</span>
                                                          )}
                                                        </div>
                                                        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-xs">
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">S.No</span>
                                                            <span className="text-slate-800 font-bold text-sm">{c.slNo}</span>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Zone</span>
                                                            <span className="text-gray-800 font-medium">{c.zone || '—'}</span>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Police Station</span>
                                                            <span className="text-gray-800 font-medium">{c.policeStation || '—'}</span>
                                                          </div>
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Sector</span>
                                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">{c.sector || '—'}</span>
                                                          </div>
                                                          <div className={`rounded-lg p-2.5 border ${matchedSHO ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60' : 'bg-gray-50 border-gray-200'}`}>
                                                            <span className="block text-[10px] text-amber-500 uppercase font-semibold mb-0.5">SHO</span>
                                                            {matchedSHO ? (
                                                              <>
                                                                <span className="text-amber-800 font-bold text-xs block leading-tight">{matchedSHO.name}</span>
                                                                <span className="text-[10px] text-amber-600">{matchedSHO.rank}</span>
                                                              </>
                                                            ) : (
                                                              <span className="text-gray-400 text-[10px]">—</span>
                                                            )}
                                                          </div>
                                                          <div className={`rounded-lg p-2.5 border ${matchedOfficer ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60' : 'bg-gray-50 border-gray-200'}`}>
                                                            <span className="block text-[10px] text-blue-500 uppercase font-semibold mb-0.5">Responsible SI</span>
                                                            {matchedOfficer ? (
                                                              <>
                                                                <span className="text-blue-800 font-bold text-xs block leading-tight">{matchedOfficer.name}</span>
                                                                <span className="text-[10px] text-blue-600">{matchedOfficer.rank}</span>
                                                              </>
                                                            ) : (
                                                              <span className="text-gray-400 text-[10px]">—</span>
                                                            )}
                                                          </div>
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Social Vice Type</span>
                                                            {c.socialViceType && c.socialViceType !== 'None' ? (
                                                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{c.socialViceType}</span>
                                                            ) : (
                                                              <span className="text-gray-400">None</span>
                                                            )}
                                                          </div>
                                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                                            <span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Nature of Case</span>
                                                            <span className="text-gray-800 font-medium leading-snug">{c.natureOfCase || c.crimeHead || '—'}</span>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* ── Section 2: Name of the P.S., Cr. No, U/Sec & D.O.R ── */}
                                                      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2 mb-2">
                                                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Name of the P.S., Cr. No, U/Sec & D.O.R</span>
                                                          <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                                                        </div>
                                                        <div className="text-xs text-gray-800 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 leading-relaxed">
                                                          {c.psWithCrDetails || `${c.policeStation || '—'} PS Cr.No. ${c.crNo || '—'} U/s ${c.sections || '—'} DOR: ${c.dor || '—'}`}
                                                        </div>
                                                      </div>

                                                      {/* ── Section 3: Details of Accused ── */}
                                                      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2 mb-2">
                                                          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Details of Accused (Name, S/o, Age, R/o & Contact No.)</span>
                                                          <div className="flex-1 h-px bg-gradient-to-r from-orange-200 to-transparent" />
                                                          <div className="flex gap-2">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{c.numAccused || 0} Accused</span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{c.numCases || 0} Cases</span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">{c.abscondingAccused || 0} Absconding</span>
                                                          </div>
                                                        </div>
                                                        <div className="text-xs text-gray-800 bg-orange-50/50 p-3 rounded-lg border border-orange-100 leading-relaxed">
                                                          {c.accusedParticulars || c.accusedDetails || '—'}
                                                        </div>
                                                      </div>

                                                      {/* ── Section 4: BRIEF FACTS ── */}
                                                      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2 mb-2">
                                                          <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider">Brief Facts</span>
                                                          <div className="flex-1 h-px bg-gradient-to-r from-teal-200 to-transparent" />
                                                        </div>
                                                        <div className="text-xs text-gray-800 bg-teal-50/50 p-3 rounded-lg border border-teal-100 leading-relaxed">
                                                          {c.briefFacts || <span className="text-gray-400 italic">No brief facts extracted</span>}
                                                        </div>
                                                      </div>

                                                      {/* ── Section 5: Seized Property ── */}
                                                      {(c.seizedProperty || c.seizedWorth) && (
                                                        <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                                                          <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Property Seized & Worth</span>
                                                            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                                                            {c.seizedWorth && (
                                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">{c.seizedWorth}</span>
                                                            )}
                                                          </div>
                                                          {c.seizedProperty && (
                                                            <div className="text-xs text-gray-800 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                                                              {c.seizedProperty}
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}

                                                      {/* ── Section 4: Extracted Locations ── */}
                                                      {c.extractedLocations && c.extractedLocations.length > 0 && (
                                                        <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                                                          <div className="flex items-center gap-2 mb-3">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Extracted Locations</span>
                                                            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                                                          </div>
                                                          <div className="flex flex-wrap gap-2">
                                                            {c.extractedLocations.map((loc, li) => (
                                                              <span key={li} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                                                                loc.type === 'ps_reference' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                                                loc.type === 'residential' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                                'bg-orange-50 text-orange-700 border-orange-200'
                                                              }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                                  loc.type === 'ps_reference' ? 'bg-violet-400' :
                                                                  loc.type === 'residential' ? 'bg-teal-400' : 'bg-orange-400'
                                                                }`} />
                                                                {loc.rawText}
                                                                {loc.psName && loc.type === 'ps_reference' && (
                                                                  <span className="text-[9px] opacity-60">({loc.psName})</span>
                                                                )}
                                                              </span>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}


                                                      {/* ── Generate Memo Button ── */}
                                                      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white flex justify-end">
                                                        <button
                                                          onClick={(e) => handleGenerateMemo(e, dsr._id, c._id)}
                                                          disabled={generatingMemoId === c._id}
                                                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                                                        >
                                                          {generatingMemoId === c._id ? (
                                                            <>
                                                              <Loader2 size={14} className="animate-spin" />
                                                              Generating…
                                                            </>
                                                          ) : (
                                                            <>
                                                              <FileSignature size={14} />
                                                              Generate Memo
                                                            </>
                                                          )}
                                                        </button>
                                                      </div>

                                                    </div>
                                                  </div>
                                                </div>
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
                          </div>
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

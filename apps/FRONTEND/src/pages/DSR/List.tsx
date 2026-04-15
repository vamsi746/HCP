import React, { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDSRs, getDSR, deleteDSR, generateMemo, downloadDSRFile, getDSRDocument, reparseDSR } from '../../services/endpoints';
import { Trash2, X, Plus, Eye, ChevronDown, FileSignature, Loader2, FileText, ExternalLink, CheckCircle2, MapPin, RotateCcw, ZoomIn, ZoomOut, Scan, Shield, FileBarChart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { DSR, ForceType, DSRCategory, ParsedCase } from '../../types';
import { format } from 'date-fns';
import { renderAsync } from 'docx-preview';
import FilterDropdown from '../../components/FilterDropdown';

const FORCE_LABELS: Record<ForceType, string> = {
  CHARMINAR_GOLCONDA: 'Charminar & Golconda',
  RAJENDRANAGAR_SHAMSHABAD: 'Rajendra Nagar & Shamshabad',
  KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS: 'Khairatabad, Secunderabad & Jubilee Hills',
};

const DSRList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterForce, setFilterForce] = useState<ForceType | ''>('');
  const [filterCategory, setFilterCategory] = useState<DSRCategory | ''>('');
  const [deleteItem, setDeleteItem] = useState<DSR | null>(null);
  const [expandedDSR, setExpandedDSR] = useState<string | null>(null);
  const [expandedCases, setExpandedCases] = useState<Record<string, ParsedCase[]>>({});
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [generatingMemoId, setGeneratingMemoId] = useState<string | null>(null);
  const [docViewer, setDocViewer] = useState<{ fileName: string; fallbackHtml?: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const docContainerRef = useRef<HTMLDivElement>(null);
  const [docZoom, setDocZoom] = useState(0.6);

  const openDocumentViewer = async (e: React.MouseEvent, dsrId: string, fileName?: string) => {
    e.stopPropagation();
    const name = fileName || 'document';

    setDocLoading(true);
    setDocViewer({ fileName: name });

    // Always try docx-preview first (backend converts .doc → .docx on upload)
    try {
      const res = await downloadDSRFile(dsrId);
      requestAnimationFrame(() => {
        if (docContainerRef.current) {
          renderAsync(res.data, docContainerRef.current, undefined, {
            className: 'dsr-docx-preview',
            inWrapper: true,
            ignoreWidth: true,
            ignoreHeight: true,
            ignoreFonts: false,
            breakPages: false,
            renderHeaders: false,
            renderFooters: false,
            renderFootnotes: true,
          }).then(() => {
            // Strip ALL inline dimension/spacing styles so CSS controls layout
            if (docContainerRef.current) {
              docContainerRef.current.querySelectorAll('*').forEach(el => {
                const s = (el as HTMLElement).style;
                s.width = '';
                s.minWidth = '';
                s.maxWidth = '';
                s.height = '';
                s.minHeight = '';
                s.maxHeight = '';
              });
              // Specifically fix sections
              docContainerRef.current.querySelectorAll('section').forEach(sec => {
                const s = (sec as HTMLElement).style;
                s.padding = '0';
                s.margin = '0';
                s.height = 'auto';
                s.minHeight = '0';
              });
              // Hide empty trailing sections
              const sections = docContainerRef.current.querySelectorAll('section.docx');
              for (let i = sections.length - 1; i >= 0; i--) {
                const text = (sections[i].textContent || '').trim();
                if (!text) (sections[i] as HTMLElement).style.display = 'none';
                else break;
              }
            }
          }).catch(async () => {
            // docx-preview failed → fallback to stored HTML
            try {
              const htmlRes = await getDSRDocument(dsrId);
              const { documentHtml } = htmlRes.data.data;
              if (documentHtml) {
                setDocViewer({ fileName: name, fallbackHtml: documentHtml });
              } else {
                toast.error('Unable to render this document format');
                setDocViewer(null);
              }
            } catch {
              toast.error('Failed to render document');
              setDocViewer(null);
            }
          }).finally(() => {
            setDocLoading(false);
          });
        }
      });
    } catch {
      toast.error('Failed to load document');
      setDocViewer(null);
      setDocLoading(false);
      setDocZoom(0.6);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['dsrs', page, filterForce, filterCategory],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filterForce) params.forceType = filterForce;
      if (filterCategory) params.dsrCategory = filterCategory;
      const res = await getDSRs(params);
      return res.data;
    },
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
      // Refresh cases to show memo status
      const dsrRes = await getDSR(dsrId);
      setExpandedCases(prev => ({ ...prev, [dsrId]: dsrRes.data.data.parsedCases || [] }));
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      // Navigate to memo editor
      navigate(`/memos/${memo._id}`);
    } catch {
      toast.error('Failed to generate memo');
    } finally {
      setGeneratingMemoId(null);
    }
  };

  const openMemoViewer = (e: React.MouseEvent, memoId: string) => {
    e.stopPropagation();
    navigate(`/memos/${memoId}`);
  };

  const openDelete = (e: React.MouseEvent, dsr: DSR) => {
    e.stopPropagation();
    setDeleteItem(dsr);
  };

  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const handleReparse = async (id: string) => {
    setReparsingId(id);
    try {
      await reparseDSR(id);
      toast.success('Document re-parsed successfully');
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
    } catch {
      toast.error('Re-parse failed');
    } finally {
      setReparsingId(null);
    }
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
      {/* Official header */}
      <div className="bg-slate-800 -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-wide">DSR & MEMO GENERATION</h1>
          <p className="text-slate-400 text-[12px] mt-0.5 font-medium tracking-wider uppercase">Hyderabad City Police — Commissioner's Task Force</p>
        </div>
        <button
          onClick={() => navigate('/dsr/upload')}
          className="flex items-center gap-2 bg-white text-slate-800 px-4 py-2 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-100 transition"
        >
          <Plus size={14} />
          Upload DSR
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        {/* Category toggle */}
        <div className="flex border border-slate-300 bg-white">
          <button
            onClick={() => { setFilterCategory(''); setPage(1); }}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filterCategory === '' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilterCategory('SPECIAL_WINGS'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border-l border-slate-300 transition-colors ${
              filterCategory === 'SPECIAL_WINGS' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Shield size={12} /> Special Wings
          </button>
          <button
            onClick={() => { setFilterCategory('NORMAL'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border-l border-slate-300 transition-colors ${
              filterCategory === 'NORMAL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <FileBarChart size={12} /> Normal Cases
          </button>
        </div>
        <FilterDropdown
          icon={<MapPin size={13} />}
          placeholder="All Zones"
          value={filterForce}
          onChange={(v) => { setFilterForce(v as ForceType | ''); setPage(1); }}
          options={(Object.keys(FORCE_LABELS) as ForceType[]).map((ft) => ({ value: ft, label: FORCE_LABELS[ft] }))}
        />
        {total > 0 && <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-auto">Total: {total} Record{total !== 1 ? 's' : ''}</span>}
      </div>

      {/* DSR Table */}
      <div className="border border-slate-300 bg-white">
        <table className="w-full text-[13px] table-fixed">
          <thead>
            <tr className="bg-slate-700 text-white text-left">
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[50px] text-center">S.No</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[110px]">Date</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[28%]">Zones</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[70px] text-center">Cases</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[20%]">Memo Status</th>
              <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[100px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">Loading records…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 font-medium">No DSRs found. Upload one to get started.</td></tr>
            ) : (
              dsrs.map((dsr, idx) => {
                const isExpanded = expandedDSR === dsr._id;
                const cases = expandedCases[dsr._id] || [];
                const sNo = (page - 1) * 20 + idx + 1;

                return (
                  <React.Fragment key={dsr._id}>
                    <tr
                      onClick={() => toggleExpand(dsr._id)}
                      className={`border-b border-slate-200 cursor-pointer transition-colors ${
                        isExpanded
                          ? 'bg-blue-50 shadow-[inset_3px_0_0_theme(colors.slate.700)]'
                          : idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-500 text-center">{sNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 tabular-nums">
                        {format(new Date(dsr.date), 'dd-MM-yyyy')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {dsr.dsrCategory === 'NORMAL'
                          ? <span className="text-slate-500 font-medium">Normal Cases DSR</span>
                          : (FORCE_LABELS[dsr.forceType] || dsr.forceType)
                        }
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">{dsr.totalCases || 0}</td>
                      <td className="px-4 py-3">
                        {dsr.dsrCategory === 'NORMAL' ? (
                          <span className="inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider bg-slate-200 text-slate-500">
                            PENDING TEMPLATE
                          </span>
                        ) : (dsr.totalCases || 0) > 0 ? (
                          <span className={`inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider ${
                            (dsr.memoGeneratedCount || 0) === (dsr.totalCases || 0)
                              ? 'bg-emerald-700 text-white'
                              : (dsr.memoGeneratedCount || 0) > 0
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                          }`}>
                            {dsr.memoGeneratedCount || 0} OF {dsr.totalCases || 0} GENERATED
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleReparse(dsr._id); }} className="p-1.5 text-slate-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors" title="Re-parse document" disabled={reparsingId === dsr._id}>
                            {reparsingId === dsr._id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                          </button>
                          <button onClick={(e) => openDelete(e, dsr)} className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 size={15} />
                          </button>
                          <span className={`inline-block ml-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown size={14} className={isExpanded ? 'text-slate-700' : 'text-slate-400'} />
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded: parsed cases — hierarchy view */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-0 border-b border-slate-300">
                          {dsr.dsrCategory === 'NORMAL' ? (
                            /* Normal DSR — document view only, no parsed cases */
                            <div className="bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-4">
                              <div className="border border-slate-300 bg-white overflow-hidden">
                                <div className="bg-slate-600 px-4 py-2.5 flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                    Normal Cases DSR — Document Uploaded
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={(e) => openDocumentViewer(e, dsr._id, dsr.fileName)}
                                      disabled={docLoading}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-300 hover:text-white uppercase tracking-wider transition-colors"
                                    >
                                      <ExternalLink size={12} />
                                      {docLoading ? 'Loading…' : 'View Full Document'}
                                    </button>
                                    <span className="text-[10px] text-white/50">{dsr.fileName}</span>
                                  </div>
                                </div>
                                <div className="px-5 py-6 text-center">
                                  <FileBarChart size={36} className="mx-auto text-slate-300 mb-3" />
                                  <p className="text-[13px] font-bold text-slate-700 mb-1">Normal Cases DSR</p>
                                  <p className="text-[12px] text-slate-500 max-w-md mx-auto leading-relaxed">
                                    Parsing and memo generation for normal cases DSRs will be enabled once the DSR template and memo format are configured.
                                    You can view the uploaded document using the button above.
                                  </p>
                                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                                    Awaiting Template Configuration
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                          /* Special Wings DSR — hierarchy view with parsed cases */
                          <div className="relative bg-gradient-to-b from-slate-100 to-slate-50">
                            {/* Left hierarchy rail */}
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-300" />

                            {/* Inner header bar */}
                            <div className="ml-10 mr-4 mt-3">
                              <div className="flex items-center gap-3 mb-3">
                                {/* Connector dot */}
                                <div className="absolute left-[19px] w-3 h-3 rounded-full bg-slate-600 border-2 border-white shadow-sm" />
                                <div className="flex-1 flex items-center justify-between bg-slate-700 px-4 py-2.5">
                                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                    Parsed Cases — {cases.length} Record{cases.length !== 1 ? 's' : ''}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={(e) => openDocumentViewer(e, dsr._id, dsr.fileName)}
                                      disabled={docLoading}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-300 hover:text-white uppercase tracking-wider transition-colors"
                                    >
                                      <ExternalLink size={12} />
                                      {docLoading ? 'Loading…' : 'View Full Document'}
                                    </button>
                                    <span className="text-[10px] text-white/50">{dsr.fileName}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Cases list */}
                            <div className="ml-10 mr-4 pb-4 space-y-2">
                              {cases.length === 0 ? (
                                <div className="relative">
                                  <div className="absolute -left-[17px] top-4 w-3 h-px bg-slate-300" />
                                  <div className="px-4 py-6 text-center text-gray-400 bg-white border border-slate-200">
                                    <Loader2 size={16} className="animate-spin inline mr-2" />
                                    Loading cases…
                                  </div>
                                </div>
                              ) : (
                                cases.map((c, cIdx) => {
                                  const matchedOfficer = typeof c.matchedOfficerId === 'object' ? c.matchedOfficerId : null;
                                  const matchedSHO = typeof c.matchedSHOId === 'object' ? c.matchedSHOId : null;
                                  const isCaseExpanded = expandedCaseId === c._id;
                                  const isLast = cIdx === cases.length - 1;

                                  return (
                                    <div key={c._id} className="relative">
                                      {/* Horizontal branch connector */}
                                      <div className="absolute -left-[17px] top-5 w-4 h-px bg-slate-300" />
                                      {/* Node dot */}
                                      <div className={`absolute -left-[21px] top-[14px] w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${
                                        isCaseExpanded ? 'bg-blue-600' : c.memoId ? 'bg-emerald-600' : 'bg-slate-400'
                                      }`} />
                                      {/* Hide rail below last item */}
                                      {isLast && <div className="absolute -left-[17px] top-5 bottom-0 w-px bg-gradient-to-b from-transparent to-slate-50" style={{ left: '-17px', background: 'linear-gradient(to bottom, transparent, var(--tw-gradient-to, #f8fafc))' }} />}

                                      {/* Case card */}
                                      <div
                                        onClick={(e) => { e.stopPropagation(); setExpandedCaseId(isCaseExpanded ? null : c._id); }}
                                        className={`cursor-pointer border transition-all duration-200 ${
                                          isCaseExpanded
                                            ? 'border-blue-300 bg-blue-50/50 shadow-md ring-1 ring-blue-200'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                        }`}
                                      >
                                        {/* Case summary row */}
                                        <div className="flex items-center px-4 py-2.5 gap-4">
                                          {/* S.No */}
                                          <span className="text-[13px] font-bold text-slate-400 w-8 shrink-0 text-center">{c.slNo}</span>

                                          {/* Zone + PS */}
                                          <div className="w-[18%] shrink-0">
                                            <div className="text-[12px] font-bold text-slate-800 truncate">{c.zone || '—'}</div>
                                            <div className="text-[11px] text-slate-500 truncate">{c.policeStation || '—'}</div>
                                          </div>

                                          {/* Vice Type */}
                                          <div className="w-[10%] shrink-0">
                                            {c.socialViceType && c.socialViceType !== 'None' ? (
                                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-600 text-white">{c.socialViceType}</span>
                                            ) : (
                                              <span className="text-[12px] text-slate-400">—</span>
                                            )}
                                          </div>

                                          {/* Cr. No */}
                                          <span className="w-[8%] shrink-0 text-[12px] text-slate-700 font-mono font-bold">{c.crNo || '—'}</span>

                                          {/* SHO */}
                                          <div className="w-[16%] shrink-0">
                                            {matchedSHO ? (
                                              <>
                                                <div className="text-[11px] text-slate-500">SHO</div>
                                                <div className="text-[12px] font-semibold text-slate-700 truncate">{matchedSHO.name}</div>
                                              </>
                                            ) : <span className="text-[12px] text-slate-400">—</span>}
                                          </div>

                                          {/* Sector & SI */}
                                          <div className="w-[16%] shrink-0">
                                            <div className="text-[11px] text-slate-500">{c.sector || '—'}</div>
                                            {matchedOfficer && (
                                              <div className="text-[12px] font-semibold text-blue-700 truncate">{matchedOfficer.name}</div>
                                            )}
                                          </div>

                                          {/* Action Taken By */}
                                          <div className="w-[10%] shrink-0">
                                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-700 text-white">{c.actionTakenBy || 'Task Force'}</span>
                                          </div>

                                          {/* Action + Expand */}
                                          <div className="flex-1 flex items-center justify-end gap-2">
                                            {c.memoId ? (
                                              <>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-700 text-white">
                                                  <CheckCircle2 size={11} />
                                                  GENERATED
                                                </span>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); openMemoViewer(e, c.memoId!); }}
                                                  className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                  title="View Memo"
                                                >
                                                  <Eye size={13} />
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleGenerateMemo(e, dsr._id, c._id); }}
                                                disabled={generatingMemoId === c._id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-900 transition-all disabled:opacity-50"
                                              >
                                                {generatingMemoId === c._id ? (
                                                  <Loader2 size={11} className="animate-spin" />
                                                ) : (
                                                  <FileText size={11} />
                                                )}
                                                {generatingMemoId === c._id ? 'Generating…' : 'Generate'}
                                              </button>
                                            )}
                                            <span className={`text-slate-400 transition-transform duration-200 ${isCaseExpanded ? 'rotate-180' : ''}`}>
                                              <ChevronDown size={13} />
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Expanded case detail — depth level 3 */}
                                      {isCaseExpanded && (
                                        <div className="relative ml-6 mt-1 mb-1">
                                          {/* Vertical connector from parent case */}
                                          <div className="absolute -left-3 top-0 bottom-0 w-px bg-blue-200" />
                                          <div className="absolute -left-3 top-4 w-3 h-px bg-blue-200" />

                                          <div className="border border-blue-200 bg-white overflow-hidden shadow-sm">
                                            {/* Top accent bar */}
                                            <div className="h-0.5 bg-gradient-to-r from-slate-700 via-blue-600 to-slate-700" />

                                            {/* ── Nature of Case ── */}
                                            <div className="px-4 pt-4 pb-3 border-b border-slate-200">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nature of Case</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                                {c.warningGenerated && (
                                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-700 text-white uppercase">Warning Generated</span>
                                                )}
                                              </div>
                                              <div className="text-[13px] text-slate-800 font-medium">{c.natureOfCase || c.crimeHead || '—'}</div>
                                            </div>

                                            {/* ── P.S., Cr. No, U/Sec & D.O.R ── */}
                                            <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name of the P.S., Cr. No, U/Sec & D.O.R</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                              </div>
                                              <div className="text-[12px] text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed">
                                                {c.psWithCrDetails || `${c.policeStation || '—'} PS Cr.No. ${c.crNo || '—'} U/s ${c.sections || '—'} DOR: ${c.dor || '—'}`}
                                              </div>
                                            </div>

                                            {/* ── Details of Accused ── */}
                                            <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Details of Accused (Name, S/o, Age, R/o & Contact No.)</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <div className="flex gap-2">
                                                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-700 text-white">{c.numAccused || 0} Accused</span>
                                                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-blue-700 text-white">{c.numCases || 0} Cases</span>
                                                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-red-700 text-white">{c.abscondingAccused || 0} Absconding</span>
                                                </div>
                                              </div>
                                              <div className="text-[12px] text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed">
                                                {c.accusedParticulars || c.accusedDetails || '—'}
                                              </div>
                                            </div>

                                            {/* ── BRIEF FACTS ── */}
                                            <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Brief Facts</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                              </div>
                                              <div className="text-[12px] text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed">
                                                {c.briefFacts || <span className="text-slate-400 italic">No brief facts extracted</span>}
                                              </div>
                                            </div>

                                            {/* ── Seized Property ── */}
                                            {(c.seizedProperty || c.seizedWorth) && (
                                              <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Property Seized & Worth</span>
                                                  <div className="flex-1 h-px bg-slate-200" />
                                                  {c.seizedWorth && (
                                                    <span className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-600 text-white">{c.seizedWorth}</span>
                                                  )}
                                                </div>
                                                {c.seizedProperty && (
                                                  <div className="text-[12px] text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed">
                                                    {c.seizedProperty}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {/* ── Generate / View Memo Button ── */}
                                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                                              {c.memoId ? (
                                                <>
                                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-emerald-700 text-white uppercase tracking-wider">
                                                    <CheckCircle2 size={14} />
                                                    Memo Generated
                                                  </span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); openMemoViewer(e, c.memoId!); }}
                                                    className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all"
                                                  >
                                                    <Eye size={14} />
                                                    View Memo
                                                  </button>
                                                </>
                                              ) : (
                                                <button
                                                  onClick={(e) => handleGenerateMemo(e, dsr._id, c._id)}
                                                  disabled={generatingMemoId === c._id}
                                                  className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-900 transition-all disabled:opacity-50"
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
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          )}
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
              <ChevronDown size={13} className="rotate-90" /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronDown size={13} className="-rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteItem(null)}>
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-700" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-1">Delete DSR?</h3>
            <p className="text-[13px] text-slate-500 mb-5">
              This will permanently delete the DSR dated <strong>{format(new Date(deleteItem.date), 'dd-MM-yyyy')}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-700 text-white py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-red-800 disabled:opacity-50 transition-colors">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document Viewer Modal */}
      {docViewer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDocViewer(null)}>
          <div className="bg-white border border-slate-300 shadow-2xl w-[96vw] h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-300 bg-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-slate-400" />
                <div>
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Full Document</h2>
                  <p className="text-[11px] text-slate-400">{docViewer.fileName}</p>
                </div>
              </div>
              <button onClick={() => setDocViewer(null)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X size={18} />
              </button>
            </div>
            {/* Zoom toolbar */}
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
              <button onClick={() => setDocZoom(z => Math.max(0.25, z - 0.1))} className="p-1 rounded hover:bg-slate-200 text-slate-600" title="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span className="text-[12px] font-medium text-slate-500 w-12 text-center select-none">{Math.round(docZoom * 100)}%</span>
              <button onClick={() => setDocZoom(z => Math.min(2, z + 0.1))} className="p-1 rounded hover:bg-slate-200 text-slate-600" title="Zoom in">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => setDocZoom(0.6)} className="p-1 rounded hover:bg-slate-200 text-slate-600 ml-1" title="Fit width">
                <Scan size={16} />
              </button>
            </div>
            {/* Document Content */}
            <div className="flex-1 overflow-auto bg-gray-100">
              {docLoading && (
                <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Rendering document…</span>
                </div>
              )}
              {/* .docx → docx-preview renders here */}
              {!docViewer.fallbackHtml && <div ref={docContainerRef} className="dsr-docx-container" style={{ zoom: docZoom }} />}
              {/* .doc / .txt → HTML fallback */}
              {docViewer.fallbackHtml && (
                <div className="flex justify-center py-5">
                  <div
                    className="dsr-document-view bg-white shadow-lg"
                    style={{ width: '210mm', minHeight: '297mm', padding: '25mm 20mm', fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', lineHeight: 1.6, color: '#000', zoom: docZoom }}
                    dangerouslySetInnerHTML={{ __html: docViewer.fallbackHtml }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DSRList;

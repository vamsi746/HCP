import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, getMemo, approveMemo, holdMemo, rejectMemo, assignMemoRecipient, getCaseOfficers, getHierarchy, getMemoCounts, getDSRCaseRows, downloadComplianceDocument } from '../services/endpoints';
import MemoEditor from '../components/MemoEditor';
import FilterDropdown from '../components/FilterDropdown';
import { Fullscreen, CheckCircle2, UserCheck, ArrowLeft, Loader2, FileText, X, Clock, Ban, MapPin, Calendar, Shield, Maximize2, AlertTriangle, Users, Briefcase, Scale, Filter, RotateCcw, Minimize2, Columns2, FileSpreadsheet, ZoomIn, ZoomOut, Scan, Eye, MessageSquareText, Download, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo, MemoStatus } from '../types';
import MemoPrintButton from '../components/MemoPrintButton';
import { renderAsync } from 'docx-preview';

const TABS: { key: string; label: string; disabled?: boolean }[] = [
  { key: 'PENDING_REVIEW', label: 'Pending' },
  { key: 'APPROVED,ON_HOLD,REJECTED', label: 'Reviewed' },
  { key: 'COMPLIED', label: 'Complied' },
];

type PanelMode = 'hidden' | 'split' | 'popup';

const Review: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>('PENDING_REVIEW');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memoDetail, setMemoDetail] = useState<Memo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assignModal, setAssignModal] = useState<Memo | null>(null);
  const [officers, setOfficers] = useState<{ si: any; sho: any } | null>(null);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [casePopup, setCasePopup] = useState<Memo | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('hidden');
  const [dialog, setDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    showCancel: boolean;
    onConfirm?: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'OK',
    showCancel: false,
  });
  const [popupSize, setPopupSize] = useState({ width: 520, height: 500 });
  const [popupPos, setPopupPos] = useState({ x: -1, y: -1 });
  const interacting = useRef<'drag' | 'resize' | null>(null);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  // Compliance doc preview
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; blob?: Blob } | null>(null);

  // Compliance split view: memo left + compliance doc right
  const [complianceSplitOpen, setComplianceSplitOpen] = useState(false);
  const [complianceDocUrl, setComplianceDocUrl] = useState<string | null>(null);
  const [complianceDocName, setComplianceDocName] = useState<string>('');
  const [complianceDocLoading, setComplianceDocLoading] = useState(false);
  const [complianceDocBlob, setComplianceDocBlob] = useState<Blob | null>(null);

  // Docx preview refs
  const splitDocxRef = useRef<HTMLDivElement>(null);
  const modalDocxRef = useRef<HTMLDivElement>(null);

  // Resizable split state (percentage of viewport width for the LEFT panel)
  const [splitPercent, setSplitPercent] = useState(55);
  const isDraggingSplit = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Right panel view toggle: extracted details vs case-specific DSR rows
  const [rightPanelView, setRightPanelView] = useState<'details' | 'document'>('details');
  const [caseRowsHtml, setCaseRowsHtml] = useState<string>('');
  const [dsrDocLoading, setDsrDocLoading] = useState(false);
  const [docZoom, setDocZoom] = useState(0.5);
  const docScrollRef = useRef<HTMLDivElement>(null);

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

  const allStations = React.useMemo(() => {
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

  const allSectors = React.useMemo(() => {
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

  const sectorList = React.useMemo(() => {
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

  const hasActiveFilters = filterZoneId || filterPsId || filterSector || filterDateFrom || filterDateTo;

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
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    interacting.current = 'drag';
    startRef.current = { mx: e.clientX, my: e.clientY, x: popupPos.x, y: popupPos.y, w: 0, h: 0 };
    const onMove = (ev: MouseEvent) => {
      if (interacting.current !== 'drag') return;
      setPopupPos({
        x: startRef.current.x + (ev.clientX - startRef.current.mx),
        y: startRef.current.y + (ev.clientY - startRef.current.my),
      });
    };
    const onUp = () => { interacting.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [popupPos]);

  const onResizeStart = useCallback((dir: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    interacting.current = 'resize';
    startRef.current = { mx: e.clientX, my: e.clientY, x: popupPos.x, y: popupPos.y, w: popupSize.width, h: popupSize.height };
    const onMove = (ev: MouseEvent) => {
      if (interacting.current !== 'resize') return;
      const dx = ev.clientX - startRef.current.mx;
      const dy = ev.clientY - startRef.current.my;
      let { x, y, w, h } = { x: startRef.current.x, y: startRef.current.y, w: startRef.current.w, h: startRef.current.h };
      if (dir.includes('r')) w = Math.max(320, w + dx);
      if (dir.includes('b')) h = Math.max(200, h + dy);
      if (dir.includes('l')) { const nw = Math.max(320, w - dx); x = x + (w - nw); w = nw; }
      if (dir.includes('t')) { const nh = Math.max(200, h - dy); y = y + (h - nh); h = nh; }
      setPopupSize({ width: w, height: h });
      setPopupPos({ x, y });
    };
    const onUp = () => { interacting.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [popupSize, popupPos]);

  /* ─── Panel controls ─── */
  const openCasePopup = useCallback((memo: Memo) => {
    setCasePopup(memo);
    setPanelMode('split');
    setRightPanelView('details');
    setCaseRowsHtml('');
  }, []);

  const minimizePanel = useCallback(() => {
    const cx = window.innerWidth - popupSize.width - 24;
    const maxY = window.innerHeight - popupSize.height - 100; // 100px clearance for dock
    setPopupPos({ x: Math.max(8, cx), y: Math.min(80, Math.max(8, maxY)) });
    setPanelMode('popup');
  }, [popupSize]);

  const maximizePanel = useCallback(() => {
    setPanelMode('split');
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode('hidden');
    setCasePopup(null);
    setRightPanelView('details');
    setCaseRowsHtml('');
  }, []);

  // Toggle right panel between extracted details and case-specific DSR rows
  const toggleDocumentView = useCallback((memo: Memo) => {
    if (rightPanelView === 'document') {
      setRightPanelView('details');
      return;
    }
    if (!memo.dsrId) {
      toast.error('No DSR document linked to this memo');
      return;
    }
    setRightPanelView('document');
  }, [rightPanelView]);

  // Load case-specific rows when switching to document view
  React.useEffect(() => {
    if (rightPanelView !== 'document') return;
    if (caseRowsHtml) return; // already loaded

    const dsrId = casePopup?.dsrId;
    const caseId = casePopup?.caseId;
    if (!dsrId || !caseId) return;

    setDsrDocLoading(true);
    (async () => {
      try {
        const res = await getDSRCaseRows(dsrId, caseId);
        const html = res.data?.data?.html || '';
        setCaseRowsHtml(html || '<p style="padding:20px;color:#666;">Could not extract case rows from document.</p>');
      } catch {
        setCaseRowsHtml('<p style="padding:20px;color:#c00;">Failed to load case rows.</p>');
      } finally {
        setDsrDocLoading(false);
      }
    })();
  }, [rightPanelView, caseRowsHtml, casePopup?.dsrId, casePopup?.caseId]);

  // Draggable split divider handler
  const splitRaf = useRef<number>(0);
  const onSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // Add overlay to prevent iframes from capturing mouse events
    const overlay = document.createElement('div');
    overlay.id = 'split-drag-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize;';
    document.body.appendChild(overlay);
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSplit.current) return;
      cancelAnimationFrame(splitRaf.current);
      splitRaf.current = requestAnimationFrame(() => {
        const container = splitContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const pct = ((ev.clientX - rect.left) / rect.width) * 100;
        setSplitPercent(Math.min(80, Math.max(25, pct)));
      });
    };
    const onUp = () => {
      isDraggingSplit.current = false;
      cancelAnimationFrame(splitRaf.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.getElementById('split-drag-overlay')?.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  /* ─── Data queries ─── */
  const { data, isLoading } = useQuery({
    queryKey: ['memos-review', tab, filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (tab === 'COMPLIED') {
        params.complianceView = 'true';
        params.complianceStatus = 'COMPLIED';
      } else {
        params.status = tab;
      }
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      const res = await getMemos(params);
      return res.data;
    },
  });

  const { data: countsData } = useQuery({
    queryKey: ['memos-review-counts', filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
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
    if (tabKey === 'COMPLIED') return countsData['compliance_COMPLIED'] || 0;
    const statuses = tabKey.split(',');
    return statuses.reduce((sum, s) => sum + (countsData[s] || 0), 0);
  };

  /* ─── Mutations ─── */
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveMemo(id),
    onSuccess: () => {
      toast.success('Memo approved');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
      queryClient.invalidateQueries({ queryKey: ['memos-pending-count'] });
      setMemoDetail(null);
      setSelectedId(null);
    },
    onError: () => toast.error('Failed to approve'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, recipientType, recipientId }: { id: string; recipientType: string; recipientId: string }) =>
      assignMemoRecipient(id, { recipientType, recipientId }),
    onSuccess: (res) => {
      toast.success('Memo issued successfully');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
      queryClient.invalidateQueries({ queryKey: ['memos-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      queryClient.invalidateQueries({ queryKey: ['memo'] });
      setAssignModal(null);
      setOfficers(null);
      if (res?.data?.data) {
        setMemoDetail(res.data.data);
      }
    },
    onError: () => toast.error('Failed to issue'),
  });

  const holdMutation = useMutation({
    mutationFn: (id: string) => holdMemo(id),
    onSuccess: () => {
      toast.success('Memo put on hold');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
      queryClient.invalidateQueries({ queryKey: ['memos-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      setMemoDetail(null);
      setSelectedId(null);
    },
    onError: () => toast.error('Failed to hold memo'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectMemo(id),
    onSuccess: () => {
      toast.success('Memo rejected');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
      queryClient.invalidateQueries({ queryKey: ['memos-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      setMemoDetail(null);
      setSelectedId(null);
    },
    onError: () => toast.error('Failed to reject memo'),
  });

  /* ─── Dialog helpers ─── */
  const openDialog = (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    showCancel?: boolean;
    onConfirm?: () => void;
  }) => {
    setDialog({
      open: true,
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel || 'OK',
      showCancel: config.showCancel ?? false,
      onConfirm: config.onConfirm,
    });
  };

  const closeDialog = () => {
    setDialog((prev) => ({ ...prev, open: false, onConfirm: undefined }));
  };

  const confirmDialogAction = () => {
    const action = dialog.onConfirm;
    closeDialog();
    action?.();
  };

  const confirmApprove = (id: string) => {
    if (!memoDetail?.recipientId && !memoDetail?.recipientName) {
      openDialog({
        title: 'Action Required',
        message: 'Kindly assign the memorandum to SI/SHO by selecting Issue To before proceeding.',
      });
      return;
    }
    openDialog({
      title: 'Confirm Approval',
      message: 'Are you sure you want to approve this memorandum?',
      confirmLabel: 'Approve',
      showCancel: true,
      onConfirm: () => approveMutation.mutate(id),
    });
  };

  const confirmHold = (id: string) => {
    openDialog({
      title: 'Confirm Hold',
      message: 'Are you sure you want to place this memorandum on hold?',
      confirmLabel: 'Put On Hold',
      showCancel: true,
      onConfirm: () => holdMutation.mutate(id),
    });
  };

  const confirmReject = (id: string) => {
    openDialog({
      title: 'Confirm Rejection',
      message: 'Are you sure you want to reject this memorandum?',
      confirmLabel: 'Reject',
      showCancel: true,
      onConfirm: () => rejectMutation.mutate(id),
    });
  };

  const openDetail = async (memo: Memo) => {
    setSelectedId(memo._id);
    setLoadingDetail(true);
    try {
      const res = await getMemo(memo._id);
      setMemoDetail(res.data.data);
    } catch {
      toast.error('Failed to load memo');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openAssign = async (memo: Memo) => {
    setAssignModal(memo);
    setLoadingOfficers(true);
    try {
      const psId = typeof memo.psId === 'object' ? memo.psId._id : memo.psId;
      if (psId) {
        const res = await getCaseOfficers(psId);
        setOfficers(res.data.data);
      } else {
        setOfficers({ si: null, sho: null });
      }
    } catch {
      setOfficers({ si: null, sho: null });
    } finally {
      setLoadingOfficers(false);
    }
  };

  const memos: Memo[] = data?.data || [];

  const isCompliedTab = tab === 'COMPLIED';

  const openComplianceReview = async (memo: Memo) => {
    setSelectedId(memo._id);
    setLoadingDetail(true);
    setComplianceSplitOpen(true);
    setComplianceDocUrl(null);
    setComplianceDocBlob(null);
    setComplianceDocName(memo.complianceDocumentName || 'Compliance Document');
    try {
      const res = await getMemo(memo._id);
      setMemoDetail(res.data.data);
      // Load compliance doc for right panel
      if (memo.complianceDocumentPath) {
        setComplianceDocLoading(true);
        try {
          const docRes = await downloadComplianceDocument(memo._id);
          const blob = new Blob([docRes.data], { type: docRes.headers['content-type'] || 'application/octet-stream' });
          setComplianceDocUrl(window.URL.createObjectURL(blob));
          setComplianceDocBlob(blob);
        } catch {
          toast.error('Failed to load compliance document');
        } finally {
          setComplianceDocLoading(false);
        }
      }
    } catch {
      toast.error('Failed to load memo');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleViewComplianceDoc = async (memo: Memo) => {
    try {
      const res = await downloadComplianceDocument(memo._id);
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      setPreviewDoc({ url, name: memo.complianceDocumentName || 'Compliance Document', blob });
    } catch {
      toast.error('Failed to load document');
    }
  };

  const isDocxFile = (name: string) => /\.(docx?|DOC|DOCX)$/i.test(name);

  const stripDocxInlineStyles = (container: HTMLDivElement) => {
    container.querySelectorAll('*').forEach(el => {
      const s = (el as HTMLElement).style;
      s.width = '';
      s.minWidth = '';
      s.maxWidth = '';
      s.height = '';
      s.minHeight = '';
      s.maxHeight = '';
    });
    container.querySelectorAll('section').forEach(sec => {
      const s = (sec as HTMLElement).style;
      s.padding = '0';
      s.margin = '0';
      s.height = 'auto';
      s.minHeight = '0';
    });
    // Hide empty trailing sections
    const sections = container.querySelectorAll('section.docx');
    for (let i = sections.length - 1; i >= 0; i--) {
      if (!(sections[i].textContent || '').trim()) (sections[i] as HTMLElement).style.display = 'none';
      else break;
    }
  };

  // Render docx in split view right panel
  useEffect(() => {
    if (splitDocxRef.current && complianceDocBlob && isDocxFile(complianceDocName) && !complianceDocLoading) {
      splitDocxRef.current.innerHTML = '';
      renderAsync(complianceDocBlob, splitDocxRef.current, undefined, {
        className: 'compliance-docx-preview',
        inWrapper: false,
        ignoreWidth: true,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false,
      }).then(() => {
        if (splitDocxRef.current) stripDocxInlineStyles(splitDocxRef.current);
      }).catch(() => {});
    }
  }, [complianceDocBlob, complianceDocName, complianceDocLoading]);

  // Render docx in preview modal
  useEffect(() => {
    if (modalDocxRef.current && previewDoc?.blob && isDocxFile(previewDoc.name)) {
      modalDocxRef.current.innerHTML = '';
      renderAsync(previewDoc.blob, modalDocxRef.current, undefined, {
        className: 'compliance-docx-preview',
        inWrapper: false,
        ignoreWidth: true,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false,
      }).then(() => {
        if (modalDocxRef.current) stripDocxInlineStyles(modalDocxRef.current);
      }).catch(() => {});
    }
  }, [previewDoc]);

  /* ═══════════════════════════════════════════════════════════
     SHARED RENDER HELPERS
     ═══════════════════════════════════════════════════════════ */

  // Case detail body — shared by split panel and floating popup
  const renderCaseDetailBody = (memo: Memo) => (
    <div className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-4 bg-[#F4F5F7]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent' }}>
      <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
        <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Nature of Case</legend>
        <p className="text-sm text-[#4A5568]">{memo.caseDetails?.natureOfCase || '—'}</p>
      </fieldset>
      <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
        <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Name of the P.S., Cr. No, U/Sec & D.O.R</legend>
        <p className="text-sm text-[#4A5568]">
          {memo.caseDetails?.psWithCrDetails || `${memo.policeStation || ''} PS Cr.No. ${memo.crimeNo || ''} U/s ${memo.sections || ''} ${memo.caseDetails?.dor ? `DOR.${memo.caseDetails.dor}` : ''}`}
        </p>
      </fieldset>
      <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
        <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Details of Accused</legend>
        <div className="flex items-center gap-2 mb-2">
          {(memo.caseDetails?.numAccused ?? 0) > 0 && (
            <span className="text-[10px] font-bold bg-[#1B6B46] text-white px-2 py-0.5 rounded-sm">{memo.caseDetails!.numAccused} Accused</span>
          )}
          {(memo.caseDetails?.numCases ?? 0) > 0 && (
            <span className="text-[10px] font-bold bg-[#003366] text-white px-2 py-0.5 rounded-sm">{memo.caseDetails!.numCases} Cases</span>
          )}
          <span className="text-[10px] font-bold bg-[#9B2C2C] text-white px-2 py-0.5 rounded-sm">{memo.caseDetails?.abscondingAccused ?? 0} Absconding</span>
        </div>
        <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{memo.caseDetails?.accusedParticulars || '—'}</p>
      </fieldset>
      <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
        <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Brief Facts</legend>
        <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{memo.caseDetails?.briefFacts || memo.briefFacts || '—'}</p>
      </fieldset>
      {(memo.caseDetails?.seizedProperty || memo.caseDetails?.seizedWorth) && (
        <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
          <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Property Seized & Worth</legend>
          {memo.caseDetails?.seizedWorth && (
            <span className="inline-block text-[10px] font-bold bg-[#A66914] text-white px-2 py-0.5 mb-2 rounded-sm">Rs. {memo.caseDetails.seizedWorth}</span>
          )}
          <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{memo.caseDetails?.seizedProperty || '—'}</p>
        </fieldset>
      )}
      {/* Case info */}
      <div className="border border-[#D9DEE4] bg-white px-4 py-3 rounded-sm space-y-2">
        <p className="text-[11px] font-bold text-[#003366] uppercase tracking-wider">Case Info</p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div><span className="text-slate-400">PS</span> <span className="ml-2 font-bold text-slate-700">{memo.policeStation || '—'}</span></div>
          <div><span className="text-slate-400">SHO</span> <span className="ml-2 font-bold text-slate-700">{memo.caseDetails?.sho?.name || '—'}</span></div>
          <div><span className="text-slate-400">Sector</span> <span className="ml-2 font-bold text-slate-700">{memo.caseDetails?.sector || '—'}</span></div>
          <div><span className="text-slate-400">SI</span> <span className="ml-2 font-bold text-slate-700">{memo.caseDetails?.si?.name || '—'}</span></div>
          <div><span className="text-slate-400">Date</span> <span className="ml-2 font-bold text-slate-700">{memo.raidedDate ? format(new Date(memo.raidedDate), 'dd MMM yyyy') : format(new Date(memo.date), 'dd MMM yyyy')}</span></div>
        </div>
      </div>
    </div>
  );

  // Panel header with minimize / maximize / close
  const renderPanelHeader = (memo: Memo, mode: 'split' | 'popup') => (
    <div
      className={`bg-[#003366] px-5 py-3 flex items-center justify-between flex-shrink-0 border-b-2 border-[#B8860B] ${mode === 'popup' ? 'cursor-move select-none rounded-t-sm' : ''}`}
      onMouseDown={mode === 'popup' ? onDragStart : undefined}
    >
      <h2 className="text-sm font-bold text-white uppercase tracking-wider truncate mr-2">
        {memo.zone || 'Unknown'} Zone — Cr.No. {memo.crimeNo || '—'}
      </h2>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => toggleDocumentView(memo)}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition border bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:text-white"
          title={rightPanelView === 'document' ? 'Show extracted details' : 'Show case rows from DSR'}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <FileSpreadsheet size={12} />
          {rightPanelView === 'document' ? 'Details' : 'DSR'}
        </button>
        {mode === 'split' && (
          <button onClick={minimizePanel} className="text-white/50 hover:text-white p-0.5 transition" title="Minimize to popup" onMouseDown={(e) => e.stopPropagation()}>
            <Minimize2 size={14} />
          </button>
        )}
        {mode === 'popup' && (
          <button onClick={maximizePanel} className="text-white/50 hover:text-white p-0.5 transition" title="Maximize to split screen" onMouseDown={(e) => e.stopPropagation()}>
            <Columns2 size={14} />
          </button>
        )}
        <button onClick={closePanel} className="text-white/50 hover:text-white p-0.5 transition" title="Close" onMouseDown={(e) => e.stopPropagation()}>
          <X size={16} />
        </button>
      </div>
    </div>
  );

  // Document view — renders the full original DSR document via docx-preview
  const renderDocumentView = () => (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Zoom toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
        <button onClick={() => setDocZoom(z => Math.max(0.25, +(z - 0.1).toFixed(1)))} className="p-1 rounded hover:bg-slate-200 text-slate-600" title="Zoom out">
          <ZoomOut size={15} />
        </button>
        <span className="text-[11px] font-medium text-slate-500 w-10 text-center select-none">{Math.round(docZoom * 100)}%</span>
        <button onClick={() => setDocZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} className="p-1 rounded hover:bg-slate-200 text-slate-600" title="Zoom in">
          <ZoomIn size={15} />
        </button>
        <button onClick={() => setDocZoom(0.5)} className="p-1 rounded hover:bg-slate-200 text-slate-600 ml-1" title="Fit width">
          <Scan size={15} />
        </button>
      </div>
      {/* Scrollable document area */}
      <div ref={docScrollRef} className="flex-1 overflow-auto bg-white" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent', minWidth: 0 }}>
        {dsrDocLoading && (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading case rows…
          </div>
        )}
        {caseRowsHtml && (
          <div
            className="dsr-case-rows-view p-2"
            style={{ fontSize: '11pt', lineHeight: 1.4, zoom: docZoom }}
          >
            <style>{`
              .dsr-case-rows-view table { border-collapse: collapse; width: 100%; font-family: serif; }
              .dsr-case-rows-view table td, .dsr-case-rows-view table th { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
              .dsr-case-rows-view table tr:first-child td, .dsr-case-rows-view table tr:first-child th { background: #f3f4f6; font-weight: bold; }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: caseRowsHtml }} />
          </div>
        )}
      </div>
    </div>
  );

  // Right panel body — toggles between extracted details and document view
  const renderRightPanelBody = (memo: Memo) => (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      <div style={{ display: rightPanelView === 'details' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {renderCaseDetailBody(memo)}
      </div>
      <div style={{ display: rightPanelView === 'document' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
        {renderDocumentView()}
      </div>
    </div>
  );

  // Split panel is now rendered inline via the split layout, not as a fixed overlay
  const renderSplitPanel = () => null;

  // Floating popup (minimized mode)
  const renderFloatingPopup = () => {
    if (panelMode !== 'popup' || !casePopup) return null;
    return (
      <div
        className="fixed bg-white border border-[#D9DEE4] shadow-2xl flex flex-col rounded-sm z-50"
        style={{ left: popupPos.x, top: popupPos.y, width: popupSize.width, height: popupSize.height, maxWidth: '90vw', maxHeight: 'calc(100vh - 100px)' }}
      >
        {renderPanelHeader(casePopup, 'popup')}
        {renderRightPanelBody(casePopup)}
        {/* Resize edges & corners */}
        <div onMouseDown={onResizeStart('t')} className="absolute top-0 left-2 right-2 h-1 cursor-n-resize" />
        <div onMouseDown={onResizeStart('b')} className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize" />
        <div onMouseDown={onResizeStart('l')} className="absolute left-0 top-2 bottom-2 w-1 cursor-w-resize" />
        <div onMouseDown={onResizeStart('r')} className="absolute right-0 top-2 bottom-2 w-1 cursor-e-resize" />
        <div onMouseDown={onResizeStart('tl')} className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize" />
        <div onMouseDown={onResizeStart('tr')} className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize" />
        <div onMouseDown={onResizeStart('bl')} className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize" />
        <div onMouseDown={onResizeStart('br')} className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize" />
      </div>
    );
  };

  // Assign modal
  const renderAssignModal = () => {
    if (!assignModal) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setAssignModal(null); setOfficers(null); }}>
        <div className="bg-white shadow-2xl w-[95vw] max-w-md border border-neutral-200 rounded-sm" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#003366] px-5 py-3 flex items-center justify-between rounded-t-sm">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Issue To</h2>
            <button onClick={() => { setAssignModal(null); setOfficers(null); }} className="text-white/50 hover:text-white"><X size={18} /></button>
          </div>
          <div className="p-5">
            <p className="text-sm text-neutral-600 mb-4">
              Assign memo to officer at <strong className="text-[#1C2334]">{assignModal.policeStation} PS</strong>
            </p>
            {loadingOfficers ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-neutral-400" /></div>
            ) : (
              <div className="space-y-2">
                {officers?.sho && (
                  <button
                    onClick={() => assignMutation.mutate({ id: assignModal._id, recipientType: 'SHO', recipientId: officers.sho._id })}
                    disabled={assignMutation.isPending}
                    className="w-full text-left p-4 border border-[#D9DEE4] bg-white hover:bg-[#EBF0F5] hover:border-[#003366]/30 transition rounded-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#003366] uppercase tracking-wider">SHO</span>
                        <p className="font-bold text-[#1C2334]">{officers.sho.name}</p>
                        <p className="text-xs text-[#718096]">{officers.sho.rank} • {officers.sho.badgeNumber}</p>
                      </div>
                      <UserCheck size={20} className="text-[#003366]" />
                    </div>
                  </button>
                )}
                {officers?.si && (
                  <button
                    onClick={() => assignMutation.mutate({ id: assignModal._id, recipientType: 'SI', recipientId: officers.si._id })}
                    disabled={assignMutation.isPending}
                    className="w-full text-left p-4 border border-[#D9DEE4] bg-white hover:bg-[#EBF0F5] hover:border-[#003366]/30 transition rounded-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#4A5568] uppercase tracking-wider">SI</span>
                        <p className="font-bold text-[#1C2334]">{officers.si.name}</p>
                        <p className="text-xs text-[#718096]">{officers.si.rank} • {officers.si.badgeNumber}</p>
                      </div>
                      <UserCheck size={20} className="text-neutral-400" />
                    </div>
                  </button>
                )}
                {!officers?.sho && !officers?.si && (
                  <p className="text-sm text-neutral-500 text-center py-4">No officers found for this police station.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Action dialog
  const renderDialog = () => {
    if (!dialog.open) return null;
    return (
      <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center" onClick={closeDialog}>
        <div className="w-[95vw] max-w-md bg-white border border-[#D9DEE4] shadow-2xl rounded-sm" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#003366] px-5 py-3 rounded-t-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{dialog.title}</h3>
          </div>
          <div className="p-5">
            <p className="text-sm text-[#4A5568] leading-relaxed">{dialog.message}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              {dialog.showCancel && (
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-[#D9DEE4] text-[#4A5568] hover:bg-[#F4F5F7] rounded-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={confirmDialogAction}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#003366] text-white hover:bg-[#004480] rounded-sm"
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     MEMO DETAIL VIEW (when a memo is selected for review)
     ═══════════════════════════════════════════════════════════ */
  if (selectedId && memoDetail) {
    const isSplit = panelMode === 'split' && !!casePopup;
    const isComplianceSplit = complianceSplitOpen;

    const closeComplianceView = () => {
      setSelectedId(null);
      setMemoDetail(null);
      setComplianceSplitOpen(false);
      if (complianceDocUrl) {
        window.URL.revokeObjectURL(complianceDocUrl);
        setComplianceDocUrl(null);
      }
      setComplianceDocBlob(null);
      setComplianceDocName('');
    };

    const leftContent = (
      <div className="flex flex-col h-full bg-[#F4F5F7] overflow-hidden">
        {/* Header bar */}
        <div className="bg-[#003366] px-5 py-3 flex items-center justify-between border-b-2 border-[#B8860B] flex-shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={isComplianceSplit ? closeComplianceView : () => { setSelectedId(null); setMemoDetail(null); }} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-sm font-bold text-white uppercase tracking-wider truncate">
                  {memoDetail.policeStation || 'Unknown'} PS — Cr.No. {memoDetail.crimeNo || '—'}
                </h1>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm flex-shrink-0 ${
                  memoDetail.status === 'PENDING_REVIEW' ? 'bg-amber-500 text-white' :
                  memoDetail.status === 'REVIEWED' ? 'bg-[#1B6B46] text-white' :
                  memoDetail.status === 'ON_HOLD' ? 'bg-[#A66914] text-white' :
                  memoDetail.status === 'REJECTED' ? 'bg-[#9B2C2C] text-white' :
                  'bg-[#1B6B46] text-white'
                }`}>
                  {memoDetail.status === 'PENDING_REVIEW' ? 'PENDING' : memoDetail.status === 'APPROVED' ? 'APPROVED' : memoDetail.status === 'ON_HOLD' ? 'ON HOLD' : memoDetail.status}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{memoDetail.reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {panelMode === 'hidden' && (
              <button
                onClick={() => openCasePopup(memoDetail)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white border border-white/20 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition rounded-sm"
              >
                <Columns2 size={13} />
                Case Details
              </button>
            )}
            <MemoPrintButton
              content={memoDetail.content}
              title={`Memo - ${memoDetail.policeStation} PS - Cr.No. ${memoDetail.crimeNo}`}
            />
            {(memoDetail.status === 'PENDING_REVIEW' || memoDetail.status === 'REVIEWED' || memoDetail.status === 'ON_HOLD' || memoDetail.status === 'REJECTED') && (
              <button
                onClick={() => openAssign(memoDetail)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-[#003366] border border-white/40 text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition rounded-sm"
              >
                <UserCheck size={13} />
                Issue To
              </button>
            )}
            {(memoDetail.status === 'REVIEWED' || memoDetail.status === 'PENDING_REVIEW' || memoDetail.status === 'ON_HOLD') && (
              <>
                <button
                  onClick={() => confirmApprove(memoDetail._id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1B6B46] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#155A38] disabled:opacity-50 transition rounded-sm"
                >
                  <CheckCircle2 size={13} />
                  {approveMutation.isPending ? 'Approving…' : 'Approve'}
                </button>
                <button className="flex items-center gap-1.5 px-4 py-1.5 bg-[#A66914] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#8C5810] disabled:opacity-50 transition rounded-sm"
                  onClick={() => confirmHold(memoDetail._id)}
                  disabled={holdMutation.isPending}
                >
                  <Clock size={13} />
                  {holdMutation.isPending ? 'Holding…' : 'Hold'}
                </button>
                <button className="flex items-center gap-1.5 px-4 py-1.5 bg-[#9B2C2C] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#832424] disabled:opacity-50 transition rounded-sm"
                  onClick={() => confirmReject(memoDetail._id)}
                  disabled={rejectMutation.isPending}
                >
                  <Ban size={13} />
                  {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Memo content */}
        <div className="flex-1 overflow-y-auto scroll-smooth min-w-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent' }}>
          <div className={`bg-white min-w-0 ${(panelMode === 'split' || isComplianceSplit) ? 'memo-viewer-responsive' : ''}`}>
            <MemoEditor content={memoDetail.content} onUpdate={() => {}} editable={false} />
          </div>
        </div>
      </div>
    );

    return (
      <>
        {isComplianceSplit ? (
          /* Compliance split: memo left + compliance document right */
          <div ref={splitContainerRef} className="flex -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)]" style={{ height: 'calc(100vh - 80px - 82px)' }}>
            {/* Left: Memo */}
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${splitPercent}%` }}>
              {leftContent}
            </div>
            {/* Draggable divider */}
            <div
              className="h-full w-[5px] bg-[#D9DEE4] hover:bg-[#003366] active:bg-[#003366] cursor-col-resize flex-shrink-0 relative group transition-colors duration-150"
              onMouseDown={onSplitDragStart}
            >
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[3px] h-10 rounded-full bg-[#A0AEC0] group-hover:bg-white group-active:bg-white transition-colors" />
            </div>
            {/* Right: Compliance Document */}
            <div className="h-full flex flex-col min-w-0" style={{ width: `${100 - splitPercent}%` }}>
              <div className="bg-[#003366] px-5 py-3 flex items-center justify-between flex-shrink-0 border-b-2 border-[#B8860B]">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider truncate mr-2">Compliance Document</h2>
                <div className="flex items-center gap-2">
                  {complianceDocUrl && (
                    <a
                      href={complianceDocUrl}
                      download={complianceDocName}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20 hover:bg-white/20 rounded-sm transition"
                    >
                      <Download size={11} /> Download
                    </a>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-white">
                {complianceDocLoading ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <Loader2 size={24} className="animate-spin mr-2" />
                    <span className="text-sm">Loading document…</span>
                  </div>
                ) : complianceDocUrl ? (
                  complianceDocName.toLowerCase().endsWith('.pdf') ? (
                    <iframe src={`${complianceDocUrl}#navpanes=0`} className="w-full h-full border-0" title="Compliance Document" />
                  ) : isDocxFile(complianceDocName) ? (
                    <div ref={splitDocxRef} className="w-full h-full overflow-auto bg-white" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent' }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                      <FileText size={48} className="text-slate-300" />
                      <p className="text-sm font-semibold">{complianceDocName}</p>
                      <p className="text-[12px] text-slate-400">Preview not available for this file type</p>
                      <a
                        href={complianceDocUrl}
                        download={complianceDocName}
                        className="px-4 py-2 bg-[#003366] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#004480] transition rounded-sm"
                      >
                        Download File
                      </a>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <FileText size={40} className="text-slate-300" />
                    <p className="text-sm font-semibold">No compliance document attached</p>
                    {memoDetail.complianceRemarks && (
                      <div className="mt-4 max-w-md bg-slate-50 border border-slate-200 p-4 rounded-sm">
                        <p className="text-[11px] font-bold text-[#003366] uppercase tracking-wider mb-1.5">Compliance Remarks</p>
                        <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{memoDetail.complianceRemarks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : isSplit ? (
          <div ref={splitContainerRef} className="flex -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)]" style={{ height: 'calc(100vh - 80px - 82px)' }}>
            {/* Left panel */}
            <div className="h-full flex flex-col overflow-hidden" style={{ width: `${splitPercent}%` }}>
              {leftContent}
            </div>
            {/* Draggable divider */}
            <div
              className="h-full w-[5px] bg-[#D9DEE4] hover:bg-[#003366] active:bg-[#003366] cursor-col-resize flex-shrink-0 relative group transition-colors duration-150"
              onMouseDown={onSplitDragStart}
            >
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[3px] h-10 rounded-full bg-[#A0AEC0] group-hover:bg-white group-active:bg-white transition-colors" />
            </div>
            {/* Right panel */}
            <div className="h-full flex flex-col min-w-0" style={{ width: `${100 - splitPercent}%` }}>
              {renderPanelHeader(casePopup!, 'split')}
              {renderRightPanelBody(casePopup!)}
            </div>
          </div>
        ) : (
          <div className="-m-3 sm:-m-4 md:-m-6 overflow-hidden w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)]" style={{ height: 'calc(100vh - 80px - 82px)' }}>
            {leftContent}
          </div>
        )}

        {/* Modals & panels */}
        {renderAssignModal()}
        {renderDialog()}
        {renderFloatingPopup()}
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     CARD LIST VIEW (grid of memo cards)
     ═══════════════════════════════════════════════════════════ */
  const isSplitList = panelMode === 'split' && !!casePopup;

  const listContent = (
    <div className="flex flex-col h-full">
      {/* Page header — sticky */}
      <div className="bg-[#003366] px-5 py-3 border-b-2 border-[#B8860B] flex-shrink-0 sticky top-0 z-10">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">To Be Reviewed by CP Sir</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-smooth p-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent' }}>
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-0 mb-5 border-b border-neutral-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-[3px] transition-all ${
                tab === t.key
                  ? 'border-[#003366] text-[#003366] bg-[#003366]/5'
                  : 'border-transparent text-[#718096] hover:text-[#4A5568] hover:border-[#D9DEE4]'
              }`}
            >
              {t.label}
              <span className={`ml-2 text-white text-[10px] px-1.5 py-0.5 font-bold rounded-sm ${
                tab === t.key ? 'bg-[#003366]' : 'bg-[#718096]'
              }`}>{getTabCount(t.key)}</span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
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
            onChange={setFilterSector}
            options={sectorList.map((s: any) => ({ value: s.name, label: s.name }))}
          />
          <div className="w-px h-6 bg-[#D9DEE4] mx-1" />
          <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
            <Calendar size={13} className="flex-shrink-0 opacity-50" />
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[100px] sm:w-[115px]"
            />
          </div>
          <span className="text-[11px] text-[#718096] font-semibold">to</span>
          <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
            <Calendar size={13} className="flex-shrink-0 opacity-50" />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[100px] sm:w-[115px]"
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

        {/* Cards grid */}
        {isLoading ? (
          <div className="bg-white border border-neutral-200 rounded-sm p-16 text-center text-neutral-400">
            <Loader2 size={28} className="animate-spin mx-auto mb-2" />
            <p className="text-xs uppercase tracking-wider font-semibold">Loading memos…</p>
          </div>
        ) : memos.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-sm p-16 text-center">
            <FileText size={40} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500 font-semibold">No memos in this category.</p>
          </div>
        ) : (
          <div className={`grid gap-3 p-1 ${isSplitList ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
            {memos.map((memo) => {
              const isActive = casePopup?._id === memo._id;
              return (
              <div key={memo._id} className={`bg-white border-2 rounded-sm transition-all duration-200 ${isActive ? 'border-[#003366] shadow-[0_0_16px_rgba(0,51,102,0.35)] scale-[1.02]' : 'border-[#D9DEE4] shadow-sm hover:shadow-md hover:border-[#003366]/30'}`}>
                {/* Card header */}
                <div className="bg-[#003366] px-3 py-2 flex items-center justify-between rounded-t-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                      {memo.zone || 'Unknown'} Zone
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 flex-shrink-0 rounded-sm ${
                    isCompliedTab ? 'bg-emerald-700 text-white' :
                    memo.status === 'PENDING_REVIEW' ? 'bg-amber-500 text-white' :
                    memo.status === 'REVIEWED' ? 'bg-[#1B6B46] text-white' :
                    memo.status === 'ON_HOLD' ? 'bg-[#A66914] text-white' :
                    memo.status === 'REJECTED' ? 'bg-[#9B2C2C] text-white' :
                    'bg-[#1B6B46] text-white'
                  }`}>
                    {isCompliedTab ? 'COMPLIED' : memo.status === 'PENDING_REVIEW' ? 'PENDING' : memo.status === 'ON_HOLD' ? 'ON HOLD' : memo.status}
                  </span>
                </div>

                {/* Card body — Case details */}
                <div className="flex flex-col bg-[#F0F2F5]" style={{ height: 280 }}>
                  <div className="flex-shrink-0 px-3 pt-2">
                    <p className="text-[11px] font-bold text-[#003366] uppercase tracking-wider mb-1 border-b border-[#003366]/20 pb-1">Case Details</p>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d4d4d4 transparent' }}>
                    <table className="w-full text-[13px] border-collapse">
                      <tbody>
                        {([
                          ['Cr.No', memo.crimeNo || '—'],
                          ['Date', memo.raidedDate ? format(new Date(memo.raidedDate), 'dd MMM yyyy') : format(new Date(memo.date), 'dd MMM yyyy')],
                          ['Nature', memo.caseDetails?.natureOfCase || '—'],
                          ['Zone', memo.zone || '—'],
                          ['PS', memo.policeStation || '—'],
                          ['Sector', memo.caseDetails?.sector || '—'],
                        ] as [string, string][]).map(([k, v]) => (
                          <tr key={k} className="border-b border-neutral-200 last:border-0">
                            <td className="font-semibold py-1.5 pr-1 whitespace-nowrap align-top text-[#4A5568]" style={{ width: '60px' }}>{k}</td>
                            <td className="py-1.5 align-top text-[#A0AEC0]" style={{ width: '10px' }}>:</td>
                            <td className="py-1.5 pl-1.5 font-bold text-[#1C2334]">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex-shrink-0 flex items-center border-t border-[#D9DEE4] w-full">
                    {isCompliedTab ? (
                      <>
                        <button
                          onClick={() => openDetail(memo)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-[#003366] font-bold uppercase tracking-wider px-2 py-2.5 hover:bg-[#EBF0F5] transition border-r border-[#D9DEE4]"
                        >
                          <Eye size={12} className="flex-shrink-0" />
                          Memo
                        </button>
                        <button
                          onClick={() => openComplianceReview(memo)}
                          className="flex items-center justify-center text-[#003366] px-3 py-2.5 hover:bg-[#EBF0F5] transition border-r border-[#D9DEE4]"
                          title="Open Split View"
                        >
                          <BookOpen size={14} />
                        </button>
                        <button
                          onClick={() => handleViewComplianceDoc(memo)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-[#003366] font-bold uppercase tracking-wider px-2 py-2.5 hover:bg-[#EBF0F5] transition"
                        >
                          <Eye size={12} className="flex-shrink-0" />
                          Compliance
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openDetail(memo)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-[#003366] text-white font-bold uppercase tracking-wider px-3 py-2.5 hover:bg-[#004480] transition border-r border-[#D9DEE4]"
                        >
                          <FileText size={12} />
                          Review
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openCasePopup(memo); }}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] text-[#003366] font-bold hover:text-[#004480] hover:bg-[#EBF0F5] px-3 py-2.5 transition"
                        >
                          <Maximize2 size={10} />
                          View Full Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isSplitList ? (
        <div ref={splitContainerRef} className="flex -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)]" style={{ height: 'calc(100vh - 80px - 82px)' }}>
          {/* Left panel */}
          <div className="h-full flex flex-col overflow-hidden" style={{ width: `${splitPercent}%` }}>
            {listContent}
          </div>
          {/* Draggable divider */}
          <div
            className="h-full w-[5px] bg-[#D9DEE4] hover:bg-[#003366] active:bg-[#003366] cursor-col-resize flex-shrink-0 relative group transition-colors duration-150"
            onMouseDown={onSplitDragStart}
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[3px] h-10 rounded-full bg-[#A0AEC0] group-hover:bg-white group-active:bg-white transition-colors" />
          </div>
          {/* Right panel */}
          <div className="h-full flex flex-col min-w-0" style={{ width: `${100 - splitPercent}%` }}>
            {renderPanelHeader(casePopup!, 'split')}
            {renderRightPanelBody(casePopup!)}
          </div>
        </div>
      ) : (
        <div className="-m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)]" style={{ height: 'calc(100vh - 80px - 82px)' }}>
          {listContent}
        </div>
      )}

      {/* Modals */}
      {renderDialog()}
      {renderFloatingPopup()}

      {/* Compliance document preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80]" onClick={() => { window.URL.revokeObjectURL(previewDoc.url); setPreviewDoc(null); }}>
          <div className="bg-white shadow-2xl flex flex-col w-[95vw] max-w-7xl h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#003366] px-5 py-3 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">{previewDoc.name}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20 hover:bg-white/20 rounded-sm transition"
                >
                  <Download size={11} /> Download
                </a>
                <button onClick={() => { window.URL.revokeObjectURL(previewDoc.url); setPreviewDoc(null); }} className="text-white/50 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {previewDoc.name.toLowerCase().endsWith('.pdf') || previewDoc.url.includes('application/pdf') ? (
                <iframe src={previewDoc.url} className="w-full h-full border-0" title="Document Preview" />
              ) : isDocxFile(previewDoc.name) ? (
                <div ref={modalDocxRef} className="w-full h-full overflow-auto bg-white" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c1c7cf transparent' }} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                  <FileText size={48} className="text-slate-300" />
                  <p className="text-sm font-semibold">Preview not available for this file type</p>
                  <a
                    href={previewDoc.url}
                    download={previewDoc.name}
                    className="px-4 py-2 bg-[#003366] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#004480] transition rounded-sm"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Review;

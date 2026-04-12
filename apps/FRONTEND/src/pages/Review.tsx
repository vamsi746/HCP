import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, getMemo, approveMemo, holdMemo, rejectMemo, assignMemoRecipient, getCaseOfficers, getHierarchy, getMemoCounts } from '../services/endpoints';
import MemoEditor from '../components/MemoEditor';
import FilterDropdown from '../components/FilterDropdown';
import { Fullscreen, CheckCircle2, UserCheck, ArrowLeft, Loader2, FileText, X, Clock, Ban, MapPin, Calendar, Shield, Maximize2, AlertTriangle, Users, Briefcase, Scale, Filter, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo, MemoStatus } from '../types';
import MemoPrintButton from '../components/MemoPrintButton';

const TABS: { key: string; label: string; disabled?: boolean }[] = [
  { key: 'PENDING_REVIEW', label: 'Pending' },
  { key: 'APPROVED,ON_HOLD,REJECTED', label: 'Reviewed' },
  { key: 'COMPLIED', label: 'Complied' },
];

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
  const [popupSize, setPopupSize] = useState({ width: 420, height: 340 });
  const [popupPos, setPopupPos] = useState({ x: -1, y: -1 });
  const interacting = useRef<'drag' | 'resize' | null>(null);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

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

  // Derive PS and sector lists from hierarchy
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

  const openCasePopup = useCallback((memo: Memo) => {
    const cx = window.innerWidth - popupSize.width - 24;
    const cy = 80;
    setPopupPos({ x: cx, y: cy });
    setCasePopup(memo);
  }, [popupSize]);

  const { data, isLoading } = useQuery({
    queryKey: ['memos-review', tab, filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
    queryFn: async () => {
      if (tab === 'COMPLIED') {
        return { data: [], pagination: { page: 1, limit: 50, total: 0 } };
      }
      const params: Record<string, unknown> = { status: tab, limit: 50 };
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
    const statuses = tabKey.split(',');
    return statuses.reduce((sum, s) => sum + (countsData[s] || 0), 0);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveMemo(id),
    onSuccess: () => {
      toast.success('Memo approved');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
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
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      setMemoDetail(null);
      setSelectedId(null);
    },
    onError: () => toast.error('Failed to reject memo'),
  });

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

  // Full memo detail view
  if (selectedId && memoDetail) {
    return (
      <>
      <div className="min-h-screen bg-[#F4F5F7]">
        {/* Header bar */}
        <div className="bg-[#003366] px-5 py-3.5 flex items-center justify-between border-b-2 border-[#B8860B]">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedId(null); setMemoDetail(null); }} className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                  {memoDetail.policeStation || 'Unknown'} PS — Cr.No. {memoDetail.crimeNo || '—'}
                </h1>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm ${
                  memoDetail.status === 'PENDING_REVIEW' ? 'bg-amber-500 text-white' :
                  memoDetail.status === 'REVIEWED' ? 'bg-[#1B6B46] text-white' :
                  memoDetail.status === 'ON_HOLD' ? 'bg-[#A66914] text-white' :
                  memoDetail.status === 'REJECTED' ? 'bg-[#9B2C2C] text-white' :
                  'bg-[#1B6B46] text-white'
                }`}>
                  {memoDetail.status === 'PENDING_REVIEW' ? 'PENDING' : memoDetail.status === 'APPROVED' ? 'APPROVED' : memoDetail.status === 'ON_HOLD' ? 'ON HOLD' : memoDetail.status}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">{memoDetail.reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Info strip */}
        <div className="bg-white border-b border-[#D9DEE4] px-5 py-2.5 flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 bg-[#EBF0F5] text-[#1C2334] px-3 py-1 border border-[#D9DEE4] rounded-sm font-medium"><MapPin size={12} className="text-[#003366]" />{memoDetail.zone || '—'}</span>
          <span className="inline-flex items-center gap-1.5 bg-[#EBF0F5] text-[#1C2334] px-3 py-1 border border-[#D9DEE4] rounded-sm font-medium"><Shield size={12} className="text-[#003366]" />{memoDetail.policeStation || '—'} PS</span>
          <span className="inline-flex items-center gap-1.5 bg-[#EBF0F5] text-[#1C2334] px-3 py-1 border border-[#D9DEE4] rounded-sm font-medium"><Scale size={12} className="text-[#003366]" />u/s {memoDetail.sections || '—'}</span>
          <span className="inline-flex items-center gap-1.5 bg-[#EBF0F5] text-[#1C2334] px-3 py-1 border border-[#D9DEE4] rounded-sm font-medium"><Calendar size={12} className="text-[#003366]" />{format(new Date(memoDetail.date), 'dd MMM yyyy')}</span>
          {memoDetail.recipientName && (
            <span className="inline-flex items-center gap-1.5 bg-[#E8F5E9] text-[#155A38] px-3 py-1 border border-[#1B6B46]/20 rounded-sm font-bold">
              <UserCheck size={12} />Issued To: {memoDetail.recipientDesignation}, {memoDetail.recipientName}
            </span>
          )}
        </div>

        {/* Memo content */}
        <div className="mt-5 mx-4 mb-4 bg-white border border-neutral-200 shadow-sm rounded-sm">
          <div className="bg-[#003366] px-4 py-1.5 rounded-t-sm">
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Memorandum Document</p>
          </div>
          <div className="p-2">
            <MemoEditor content={memoDetail.content} onUpdate={() => {}} editable={false} />
          </div>
        </div>

        {/* Assign modal */}
        {assignModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setAssignModal(null); setOfficers(null); }}>
            <div className="bg-white shadow-2xl w-full max-w-md border border-neutral-200 rounded-sm" onClick={(e) => e.stopPropagation()}>
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
        )}

        {/* Action dialog */}
        {dialog.open && (
          <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center" onClick={closeDialog}>
            <div className="w-full max-w-md bg-white border border-[#D9DEE4] shadow-2xl rounded-sm" onClick={(e) => e.stopPropagation()}>
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
        )}
      </div>

      {/* ─── Floating Case Detail Popup (persists across views) ─── */}
      {casePopup && (
          <div
            className="fixed bg-white border border-[#D9DEE4] shadow-2xl flex flex-col rounded-sm z-50"
            style={{ left: popupPos.x, top: popupPos.y, width: popupSize.width, height: popupSize.height, maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <div
              className="bg-[#003366] px-4 py-2.5 flex items-center justify-between flex-shrink-0 cursor-move select-none rounded-t-sm"
              onMouseDown={onDragStart}
            >
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                {casePopup.zone || 'Unknown'} Zone — Cr.No. {casePopup.crimeNo || '—'}
              </h2>
              <button onClick={() => setCasePopup(null)} className="text-white/50 hover:text-white" onMouseDown={(e) => e.stopPropagation()}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F4F5F7]">
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Nature of Case</legend>
                <p className="text-sm text-[#4A5568]">{casePopup.caseDetails?.natureOfCase || '—'}</p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Name of the P.S., Cr. No, U/Sec & D.O.R</legend>
                <p className="text-sm text-[#4A5568]">
                  {casePopup.caseDetails?.psWithCrDetails || `${casePopup.policeStation || ''} PS Cr.No. ${casePopup.crimeNo || ''} U/s ${casePopup.sections || ''} ${casePopup.caseDetails?.dor ? `DOR.${casePopup.caseDetails.dor}` : ''}`}
                </p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Details of Accused</legend>
                <div className="flex items-center gap-2 mb-2">
                  {(casePopup.caseDetails?.numAccused ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-[#1B6B46] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails!.numAccused} Accused</span>
                  )}
                  {(casePopup.caseDetails?.numCases ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-[#003366] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails!.numCases} Cases</span>
                  )}
                  <span className="text-[10px] font-bold bg-[#9B2C2C] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails?.abscondingAccused ?? 0} Absconding</span>
                </div>
                <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.accusedParticulars || '—'}</p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Brief Facts</legend>
                <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.briefFacts || casePopup.briefFacts || '—'}</p>
              </fieldset>
              {(casePopup.caseDetails?.seizedProperty || casePopup.caseDetails?.seizedWorth) && (
                <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                  <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Property Seized & Worth</legend>
                  {casePopup.caseDetails?.seizedWorth && (
                    <span className="inline-block text-[10px] font-bold bg-[#A66914] text-white px-2 py-0.5 mb-2 rounded-sm">Rs. {casePopup.caseDetails.seizedWorth}</span>
                  )}
                  <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.seizedProperty || '—'}</p>
                </fieldset>
              )}
            </div>
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
      )}
      </>
    );
  }

  /* ─── Grid card list view ─── */
  return (
    <>
    <div>
      {/* Page header */}
      <div className="bg-[#003366] px-5 py-3 mb-5 border-b-2 border-[#B8860B]">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">To Be Reviewed by CP Sir</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-5 border-b border-neutral-200">
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
            className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[115px]"
          />
        </div>
        <span className="text-[11px] text-[#718096] font-semibold">to</span>
        <div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all">
          <Calendar size={13} className="flex-shrink-0 opacity-50" />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {memos.map((memo) => (
            <div key={memo._id} className="bg-white border border-[#D9DEE4] rounded-sm shadow-sm hover:shadow-md hover:border-[#003366]/30 transition-all duration-200">
              {/* Card header */}
              <div className="bg-[#003366] px-3 py-2 flex items-center justify-between rounded-t-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                    {memo.zone || 'Unknown'} Zone
                  </span>
                  <span className="text-neutral-500 text-[9px]">|</span>
                  <span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap">Cr.No. {memo.crimeNo || '—'}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 flex-shrink-0 rounded-sm ${
                  memo.status === 'PENDING_REVIEW' ? 'bg-amber-500 text-white' :
                  memo.status === 'REVIEWED' ? 'bg-[#1B6B46] text-white' :
                  memo.status === 'ON_HOLD' ? 'bg-[#A66914] text-white' :
                  memo.status === 'REJECTED' ? 'bg-[#9B2C2C] text-white' :
                  'bg-[#1B6B46] text-white'
                }`}>
                  {memo.status === 'PENDING_REVIEW' ? 'PENDING' : memo.status === 'ON_HOLD' ? 'ON HOLD' : memo.status}
                </span>
              </div>

              {/* Card body — 50/50 split */}
              <div className="flex" style={{ height: '280px' }}>
                {/* LEFT 50% — Memo preview */}
                <div className="w-1/2 p-0.5 flex flex-col overflow-hidden border-r border-neutral-100">
                  <div className="flex-1 border border-neutral-100 bg-white overflow-hidden relative">
                    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin" style={{ zoom: 0.3, scrollbarWidth: 'thin', scrollbarColor: '#d4d4d4 transparent' }}>
                      <div className="p-4 [&_.ProseMirror]:!max-w-full [&_.ProseMirror]:!overflow-hidden [&_table]:!w-full [&_table]:!table-fixed [&_*]:!max-w-full [&_img]:!max-w-full [&_.tiptap-footer]:!overflow-hidden">
                        <MemoEditor content={memo.content} onUpdate={() => {}} editable={false} />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openDetail(memo)}
                    className="w-full flex-shrink-0 text-[#003366] text-[10px] font-bold uppercase tracking-wider py-1.5 hover:text-[#004480] transition flex items-center justify-center gap-1 mt-1.5"
                  >
                    <FileText size={11} />
                    <span className="underline">Review</span>
                  </button>
                </div>

                {/* RIGHT 50% — Case details */}
                <div className="w-1/2 flex flex-col bg-[#F0F2F5]">
                  <div className="flex-1 px-3 pt-1.5 pb-1 overflow-y-auto scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d4d4d4 transparent' }}>
                    <p className="text-[10px] font-bold text-[#003366] uppercase tracking-wider mb-1 border-b border-[#003366]/20 pb-0.5">Case Details</p>
                    <table className="w-full text-[11px] border-collapse">
                      <tbody>
                        {([
                          ['Cr.No', memo.crimeNo || '—'],
                          ['Nature', memo.caseDetails?.natureOfCase || '—'],
                          ['Zone', memo.zone || '—'],
                          ['PS', memo.policeStation || '—'],
                          ['SHO', memo.caseDetails?.sho?.name || '—'],
                          ['Sector', memo.caseDetails?.sector || '—'],
                          ['SI', memo.caseDetails?.si?.name || '—'],
                          ['Date', memo.raidedDate ? format(new Date(memo.raidedDate), 'dd MMM yyyy') : format(new Date(memo.date), 'dd MMM yyyy')],
                        ] as [string, string][]).map(([k, v]) => (
                          <tr key={k} className="border-b border-neutral-100 last:border-0">
                            <td className="font-bold py-1 pr-1 whitespace-nowrap align-top text-[#1C2334]" style={{ width: '55px' }}>{k}</td>
                            <td className="py-1 align-top text-[#A0AEC0]" style={{ width: '10px' }}>:</td>
                            <td className="py-1 pl-1 font-bold text-[#1C2334]">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex-shrink-0 flex items-center border-t border-[#D9DEE4] w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); openCasePopup(memo); }}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] text-[#003366] font-bold hover:text-[#004480] hover:bg-[#EBF0F5] px-3 py-2 transition"
                    >
                      <Maximize2 size={10} />
                      View Full Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action dialog */}
      {dialog.open && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center" onClick={closeDialog}>
          <div className="w-full max-w-md bg-white border border-[#D9DEE4] shadow-2xl rounded-sm" onClick={(e) => e.stopPropagation()}>
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
      )}
    </div>

      {/* ─── Floating Case Detail Popup (persists across views) ─── */}
      {casePopup && (
          <div
            className="fixed bg-white border border-[#D9DEE4] shadow-2xl flex flex-col rounded-sm z-50"
            style={{ left: popupPos.x, top: popupPos.y, width: popupSize.width, height: popupSize.height, maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <div
              className="bg-[#003366] px-4 py-2.5 flex items-center justify-between flex-shrink-0 cursor-move select-none rounded-t-sm"
              onMouseDown={onDragStart}
            >
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                {casePopup.zone || 'Unknown'} Zone — Cr.No. {casePopup.crimeNo || '—'}
              </h2>
              <button onClick={() => setCasePopup(null)} className="text-white/50 hover:text-white" onMouseDown={(e) => e.stopPropagation()}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F4F5F7]">
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Nature of Case</legend>
                <p className="text-sm text-[#4A5568]">{casePopup.caseDetails?.natureOfCase || '—'}</p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Name of the P.S., Cr. No, U/Sec & D.O.R</legend>
                <p className="text-sm text-[#4A5568]">
                  {casePopup.caseDetails?.psWithCrDetails || `${casePopup.policeStation || ''} PS Cr.No. ${casePopup.crimeNo || ''} U/s ${casePopup.sections || ''} ${casePopup.caseDetails?.dor ? `DOR.${casePopup.caseDetails.dor}` : ''}`}
                </p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Details of Accused</legend>
                <div className="flex items-center gap-2 mb-2">
                  {(casePopup.caseDetails?.numAccused ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-[#1B6B46] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails!.numAccused} Accused</span>
                  )}
                  {(casePopup.caseDetails?.numCases ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-[#003366] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails!.numCases} Cases</span>
                  )}
                  <span className="text-[10px] font-bold bg-[#9B2C2C] text-white px-2 py-0.5 rounded-sm">{casePopup.caseDetails?.abscondingAccused ?? 0} Absconding</span>
                </div>
                <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.accusedParticulars || '—'}</p>
              </fieldset>
              <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Brief Facts</legend>
                <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.briefFacts || casePopup.briefFacts || '—'}</p>
              </fieldset>
              {(casePopup.caseDetails?.seizedProperty || casePopup.caseDetails?.seizedWorth) && (
                <fieldset className="border border-[#D9DEE4] bg-white px-4 pb-3 pt-1 rounded-sm">
                  <legend className="text-[11px] font-bold text-[#003366] uppercase tracking-wider px-1">Property Seized & Worth</legend>
                  {casePopup.caseDetails?.seizedWorth && (
                    <span className="inline-block text-[10px] font-bold bg-[#A66914] text-white px-2 py-0.5 mb-2 rounded-sm">Rs. {casePopup.caseDetails.seizedWorth}</span>
                  )}
                  <p className="text-sm text-[#4A5568] whitespace-pre-wrap">{casePopup.caseDetails?.seizedProperty || '—'}</p>
                </fieldset>
              )}
            </div>
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
      )}
    </>
  );
};

export default Review;

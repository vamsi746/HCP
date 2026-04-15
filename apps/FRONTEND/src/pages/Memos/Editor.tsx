import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, useBeforeUnload, UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemo, updateMemo, submitMemoForReview } from '../../services/endpoints';
import MemoEditor from '../../components/MemoEditor';
import { ArrowLeft, Save, Send, CheckCircle2, Clock, FileText, Loader2, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Memo } from '../../types';
import MemoPrintButton from '../../components/MemoPrintButton';

const MemoEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [suppressNextEditorUpdate, setSuppressNextEditorUpdate] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const navigationContext = useContext(NavigationContext);

  const { data, isLoading } = useQuery({
    queryKey: ['memo', id],
    queryFn: async () => {
      const res = await getMemo(id!);
      return res.data.data as Memo;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      const loadedContent = data.content || '';
      setContent(loadedContent);
      setLastSavedContent(loadedContent);
      setHasChanges(false);
      // The editor may normalize HTML once after mount; do not treat that as a user edit.
      setSuppressNextEditorUpdate(true);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateMemo(id!, { content }),
    onSuccess: (res: any) => {
      toast.success('Memo saved');
      const savedContent = res?.data?.data?.content;
      if (typeof savedContent === 'string') {
        setContent(savedContent);
        setLastSavedContent(savedContent);
        setSuppressNextEditorUpdate(true);
      } else {
        setLastSavedContent(content);
      }
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['memo', id] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (hasChanges) await updateMemo(id!, { content });
      return submitMemoForReview(id!);
    },
    onSuccess: (res: any) => {
      toast.success('Memo submitted for CP Sir review');
      const savedContent = res?.data?.data?.content;
      if (typeof savedContent === 'string') {
        setContent(savedContent);
        setLastSavedContent(savedContent);
        setSuppressNextEditorUpdate(true);
      } else {
        setLastSavedContent(content);
      }
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['memo', id] });
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      queryClient.invalidateQueries({ queryKey: ['memos-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['memos-review-counts'] });
      navigate('/memos');
    },
    onError: () => toast.error('Failed to submit'),
  });

  const handleContentUpdate = (html: string) => {
    setContent(html);
    if (suppressNextEditorUpdate) {
      setSuppressNextEditorUpdate(false);
      setLastSavedContent(html);
      setHasChanges(false);
      return;
    }
    setHasChanges(html !== lastSavedContent);
  };

  const editable = !!data && (data.status === 'DRAFT' || data.status === 'PENDING_REVIEW');
  const shouldBlockNavigation = hasChanges && editable;

  useEffect(() => {
    if (!shouldBlockNavigation) return;
    const navigator: any = navigationContext.navigator;
    if (!navigator?.block) return;

    const unblock = navigator.block((tx: any) => {
      setPendingNavigation(() => () => {
        unblock();
        tx.retry();
      });
      setLeaveDialogOpen(true);
    });

    return () => {
      unblock();
    };
  }, [navigationContext, shouldBlockNavigation]);

  useEffect(() => {
    if (!shouldBlockNavigation) {
      setPendingNavigation(null);
      if (leaveDialogOpen) setLeaveDialogOpen(false);
    }
  }, [shouldBlockNavigation, leaveDialogOpen]);

  useBeforeUnload(
    useCallback((event) => {
      if (!shouldBlockNavigation) return;
      event.preventDefault();
      event.returnValue = '';
    }, [shouldBlockNavigation])
  );

  const stayOnPage = () => {
    setLeaveDialogOpen(false);
    setPendingNavigation(null);
  };

  const leaveWithoutSaving = () => {
    setLeaveDialogOpen(false);
    const proceed = pendingNavigation;
    setPendingNavigation(null);
    proceed?.();
  };

  const handleBack = () => {
    if (shouldBlockNavigation) {
      setPendingNavigation(() => () => navigate(-1));
      setLeaveDialogOpen(true);
      return;
    }
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">Memo not found</div>
    );
  }

  const STATUS_META: Record<string, { icon: React.ReactNode; label: string; bg: string }> = {
    DRAFT: { icon: <FileText size={12} />, label: 'Draft', bg: 'bg-amber-500 text-white' },
    PENDING_REVIEW: { icon: <Clock size={12} />, label: 'Pending Review', bg: 'bg-blue-600 text-white' },
    REVIEWED: { icon: <CheckCircle2 size={12} />, label: 'Reviewed', bg: 'bg-sky-500 text-white' },
    APPROVED: { icon: <CheckCircle2 size={12} />, label: 'Approved', bg: 'bg-emerald-600 text-white' },
    SENT: { icon: <Send size={12} />, label: 'Sent', bg: 'bg-slate-700 text-white' },
    ON_HOLD: { icon: <Clock size={12} />, label: 'On Hold', bg: 'bg-orange-500 text-white' },
    REJECTED: { icon: <Ban size={12} />, label: 'Rejected', bg: 'bg-red-600 text-white' },
  };

  const statusMeta = STATUS_META[data.status] || STATUS_META.DRAFT;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header bar — govt theme */}
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-5 py-3.5 flex items-center justify-between border-l-4 border-amber-500 -mx-6 -mt-6">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-1.5 hover:bg-white/10 text-blue-200 hover:text-white transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                {data.policeStation || 'Unknown'} PS — Cr.No. {data.crimeNo || '—'}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusMeta.bg}`}>
                {statusMeta.icon}
                {statusMeta.label}
              </span>
            </div>
            <p className="text-[11px] text-blue-200 mt-0.5">{data.reference}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <MemoPrintButton
            content={content}
            title={`Memo - ${data.policeStation} PS - Cr.No. ${data.crimeNo}`}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition"
          />
        {editable && (
          <>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-40 transition"
            >
              <Save size={13} />
              {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Send size={13} />
              {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
            </button>
          </>
        )}
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && editable && (
        <div className="-mx-6 bg-amber-50 border-b border-amber-300 px-5 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-800">
          <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
          You have unsaved changes. Save draft before leaving this page.
        </div>
      )}

      {/* Memo editor */}
      <div className="mt-5 mx-0 mb-4 bg-white border border-slate-200 shadow-md">
        <div className="bg-indigo-600 px-4 py-1.5">
          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Memorandum Document</p>
        </div>
        <div className="p-2">
          {content ? (
            <MemoEditor content={content} onUpdate={handleContentUpdate} editable={editable} />
          ) : (
            <div className="border border-gray-200 bg-gray-100 flex items-center justify-center" style={{ minHeight: 600 }}>
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Leave confirmation dialog */}
      {leaveDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4" onClick={stayOnPage}>
          <div className="w-full max-w-md bg-white border border-[#D9DEE4] shadow-2xl rounded-sm" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#003366] px-5 py-3 rounded-t-sm">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Unsaved Changes</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#4A5568] leading-relaxed">
                You have unsaved changes in this memo. Leave this page without saving?
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={stayOnPage}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-[#D9DEE4] text-[#4A5568] hover:bg-[#F4F5F7] rounded-sm"
                >
                  Stay
                </button>
                <button
                  onClick={leaveWithoutSaving}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#003366] text-white hover:bg-[#004480] rounded-sm"
                >
                  Leave Without Saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoEditorPage;

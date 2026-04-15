import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemo, updateMemo, submitMemoForReview } from '../../services/endpoints';
import MemoEditor from '../../components/MemoEditor';
import { ArrowLeft, Save, Send, CheckCircle2, Clock, FileText, Loader2, MapPin, Shield, Scale, Calendar, UserCheck, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo } from '../../types';
import MemoPrintButton from '../../components/MemoPrintButton';

const MemoEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['memo', id],
    queryFn: async () => {
      const res = await getMemo(id!);
      return res.data.data as Memo;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.content) {
      setContent(data.content);
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateMemo(id!, { content }),
    onSuccess: () => {
      toast.success('Memo saved');
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
    onSuccess: () => {
      toast.success('Memo submitted for CP Sir review');
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
    setHasChanges(true);
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

  const isDraft = data.status === 'DRAFT';
  const editable = data.status === 'DRAFT' || data.status === 'PENDING_REVIEW';

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
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-white/10 text-blue-200 hover:text-white transition">
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

      {/* Info strip — colored chips */}
      <div className="bg-white border-b-2 border-indigo-100 px-5 py-2.5 flex items-center gap-3 text-xs shadow-sm -mx-6">
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 px-3 py-1 border border-indigo-200 font-semibold"><MapPin size={12} />{data.zone || '—'}</span>
        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 px-3 py-1 border border-blue-200 font-semibold"><Shield size={12} />{data.policeStation || '—'} PS</span>
        <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1 border border-slate-200 font-semibold"><Scale size={12} />u/s {data.sections || '—'}</span>
        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1 border border-amber-200 font-semibold"><Calendar size={12} />{format(new Date(data.date), 'dd MMM yyyy')}</span>
        {data.recipientName && (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 border border-emerald-200 font-bold">
            <UserCheck size={12} />Issued To: {data.recipientDesignation}, {data.recipientName}
          </span>
        )}
      </div>

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

      {/* Unsaved changes warning */}
      {hasChanges && editable && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-300 px-3 py-2 font-semibold">
          <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
          You have unsaved changes
        </div>
      )}
    </div>
  );
};

export default MemoEditorPage;

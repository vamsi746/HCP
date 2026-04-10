import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemo, updateMemo, submitMemoForReview } from '../../services/endpoints';
import MemoEditor from '../../components/MemoEditor';
import { ArrowLeft, Save, Send, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Memo } from '../../types';

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
      navigate('/compliance');
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
  const editable = isDraft;

  const STATUS_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    DRAFT: { icon: <FileText size={14} />, label: 'Draft', color: 'bg-amber-100 text-amber-700' },
    PENDING_REVIEW: { icon: <Clock size={14} />, label: 'Pending Review', color: 'bg-blue-100 text-blue-700' },
    REVIEWED: { icon: <CheckCircle2 size={14} />, label: 'Reviewed', color: 'bg-indigo-100 text-indigo-700' },
    APPROVED: { icon: <CheckCircle2 size={14} />, label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
    SENT: { icon: <Send size={14} />, label: 'Sent', color: 'bg-teal-100 text-teal-700' },
  };

  const statusMeta = STATUS_META[data.status] || STATUS_META.DRAFT;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">
                {data.policeStation || 'Unknown'} PS — Cr.No. {data.crimeNo || '—'}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.color}`}>
                {statusMeta.icon}
                {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {data.reference}
            </p>
          </div>
        </div>

        {isDraft && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Send size={14} />
              {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <span><strong>Zone:</strong> {data.zone || '—'}</span>
        <span><strong>Police Station:</strong> {data.policeStation || '—'}</span>
        <span><strong>Sections:</strong> u/s {data.sections || '—'}</span>
        {data.recipientName && (
          <span><strong>To:</strong> {data.recipientDesignation}, {data.recipientName}</span>
        )}
      </div>

      {/* Editor — only mount after content is loaded so TipTap initializes with real HTML */}
      {content ? (
        <MemoEditor content={content} onUpdate={handleContentUpdate} editable={editable} />
      ) : (
        <div className="border border-gray-200 rounded-xl bg-gray-100 flex items-center justify-center" style={{ minHeight: 600 }}>
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasChanges && isDraft && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          You have unsaved changes
        </div>
      )}
    </div>
  );
};

export default MemoEditorPage;

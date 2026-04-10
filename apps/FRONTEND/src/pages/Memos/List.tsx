import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, deleteMemo } from '../../services/endpoints';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Eye, Send, CheckCircle2, Clock, Edit3, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo, MemoStatus } from '../../types';

const STATUS_TABS: { key: MemoStatus | ''; label: string; icon: React.ReactNode; color: string }[] = [
  { key: '', label: 'All', icon: <FileText size={14} />, color: 'text-gray-600' },
  { key: 'DRAFT', label: 'Drafts', icon: <Edit3 size={14} />, color: 'text-amber-600' },
  { key: 'PENDING_REVIEW', label: 'Pending Review', icon: <Clock size={14} />, color: 'text-blue-600' },
  { key: 'REVIEWED', label: 'Reviewed', icon: <Eye size={14} />, color: 'text-indigo-600' },
  { key: 'APPROVED', label: 'Approved', icon: <CheckCircle2 size={14} />, color: 'text-emerald-600' },
  { key: 'SENT', label: 'Sent', icon: <Send size={14} />, color: 'text-teal-600' },
];

const STATUS_BADGE: Record<MemoStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Draft' },
  PENDING_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending Review' },
  REVIEWED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Reviewed' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  SENT: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Sent' },
};

const MemoList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MemoStatus | ''>('');
  const [page, setPage] = useState(1);
  const [deleteItem, setDeleteItem] = useState<Memo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['memos', statusFilter, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await getMemos(params);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMemo(id),
    onSuccess: () => { toast.success('Memo deleted'); queryClient.invalidateQueries({ queryKey: ['memos'] }); setDeleteItem(null); },
    onError: () => toast.error('Failed to delete memo'),
  });

  const memos: Memo[] = data?.data || [];
  const total: number = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Memos & Compliance</h1>
          <p className="text-gray-500 text-sm mt-1">Generated memos from DSR case data</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key as MemoStatus | ''); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === tab.key
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Memo cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">Loading…</div>
        ) : memos.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No memos found. Generate one from a DSR case.</p>
          </div>
        ) : (
          memos.map((memo) => {
            const badge = STATUS_BADGE[memo.status];
            const generatedBy = typeof memo.generatedBy === 'object' ? memo.generatedBy : null;
            return (
              <div
                key={memo._id}
                onClick={() => navigate(`/compliance/${memo._id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {memo.memoNumber && (
                        <span className="text-xs text-gray-400 font-mono">{memo.memoNumber}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {format(new Date(memo.date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-gray-800">{memo.policeStation || 'Unknown'} PS</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600 font-mono text-xs">Cr.No. {memo.crimeNo || '—'}</span>
                      {memo.sections && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500 text-xs truncate max-w-[200px]">u/s {memo.sections}</span>
                        </>
                      )}
                    </div>
                    {memo.recipientName && (
                      <div className="mt-1.5 text-xs text-gray-500">
                        <span className="font-medium">To:</span> {memo.recipientDesignation || memo.recipientType}, {memo.recipientName}
                      </div>
                    )}
                    {generatedBy && (
                      <div className="mt-1 text-[10px] text-gray-400">
                        Generated by {generatedBy.name} ({generatedBy.rank})
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/compliance/${memo._id}`); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      title="View/Edit"
                    >
                      <Eye size={14} />
                    </button>
                    {memo.status === 'DRAFT' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteItem(memo); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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

      {/* Delete modal */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Memo?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete this memo.</p>
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

export default MemoList;

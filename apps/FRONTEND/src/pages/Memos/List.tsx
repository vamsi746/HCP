import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, deleteMemo } from '../../services/endpoints';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Eye, Send, CheckCircle2, Clock, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
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
      {/* Official header */}
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Memos & Compliance Register</h1>
        <p className="text-[11px] text-blue-200 mt-0.5">Hyderabad City Police — Commissioner's Task Force</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status:</span>
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider border transition-all ${
                isActive
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto text-[12px] font-bold text-slate-500 uppercase tracking-wider">
          Total: {total} Record{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-300 bg-white">
        <table className="w-full text-[13px] table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white text-left">
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

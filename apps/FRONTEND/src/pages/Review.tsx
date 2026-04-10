import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMemos, getMemo, approveMemo, assignMemoRecipient, getCaseOfficers } from '../services/endpoints';
import MemoEditor from '../components/MemoEditor';
import { Eye, CheckCircle2, UserCheck, ArrowLeft, Loader2, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Memo, MemoStatus } from '../types';

const TABS: { key: MemoStatus; label: string; color: string }[] = [
  { key: 'PENDING_REVIEW', label: 'Pending Review', color: 'text-blue-600' },
  { key: 'REVIEWED', label: 'Reviewed / Assigned', color: 'text-indigo-600' },
  { key: 'APPROVED', label: 'Approved', color: 'text-emerald-600' },
];

const Review: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MemoStatus>('PENDING_REVIEW');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memoDetail, setMemoDetail] = useState<Memo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assignModal, setAssignModal] = useState<Memo | null>(null);
  const [officers, setOfficers] = useState<{ si: any; sho: any } | null>(null);
  const [loadingOfficers, setLoadingOfficers] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['memos-review', tab],
    queryFn: async () => {
      const res = await getMemos({ status: tab, limit: 50 });
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveMemo(id),
    onSuccess: () => {
      toast.success('Memo approved');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      setMemoDetail(null);
      setSelectedId(null);
    },
    onError: () => toast.error('Failed to approve'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, recipientType, recipientId }: { id: string; recipientType: string; recipientId: string }) =>
      assignMemoRecipient(id, { recipientType, recipientId }),
    onSuccess: () => {
      toast.success('Recipient assigned');
      queryClient.invalidateQueries({ queryKey: ['memos-review'] });
      setAssignModal(null);
      setOfficers(null);
    },
    onError: () => toast.error('Failed to assign'),
  });

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
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedId(null); setMemoDetail(null); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {memoDetail.policeStation || 'Unknown'} PS — Cr.No. {memoDetail.crimeNo || '—'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{memoDetail.reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(memoDetail.status === 'PENDING_REVIEW') && (
              <button
                onClick={() => openAssign(memoDetail)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <UserCheck size={14} />
                Assign Recipient
              </button>
            )}
            {(memoDetail.status === 'REVIEWED' || memoDetail.status === 'PENDING_REVIEW') && (
              <button
                onClick={() => approveMutation.mutate(memoDetail._id)}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                <CheckCircle2 size={14} />
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </button>
            )}
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <span><strong>Zone:</strong> {memoDetail.zone || '—'}</span>
          <span><strong>PS:</strong> {memoDetail.policeStation || '—'}</span>
          <span><strong>Sections:</strong> u/s {memoDetail.sections || '—'}</span>
          {memoDetail.recipientName && (
            <span className="text-indigo-600 font-medium">
              <strong>To:</strong> {memoDetail.recipientDesignation}, {memoDetail.recipientName}
            </span>
          )}
        </div>

        <MemoEditor content={memoDetail.content} onUpdate={() => {}} editable={false} />

        {/* Assign modal */}
        {assignModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setAssignModal(null); setOfficers(null); }}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Assign Recipient</h2>
                <button onClick={() => { setAssignModal(null); setOfficers(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Select the officer who should receive this memo for <strong>{assignModal.policeStation} PS</strong>.
              </p>
              {loadingOfficers ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : (
                <div className="space-y-3">
                  {officers?.sho && (
                    <button
                      onClick={() => assignMutation.mutate({ id: assignModal._id, recipientType: 'SHO', recipientId: officers.sho._id })}
                      disabled={assignMutation.isPending}
                      className="w-full text-left p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-amber-500 uppercase">SHO</span>
                          <p className="font-bold text-gray-800">{officers.sho.name}</p>
                          <p className="text-xs text-gray-500">{officers.sho.rank} • {officers.sho.badgeNumber}</p>
                        </div>
                        <UserCheck size={20} className="text-amber-500" />
                      </div>
                    </button>
                  )}
                  {officers?.si && (
                    <button
                      onClick={() => assignMutation.mutate({ id: assignModal._id, recipientType: 'SI', recipientId: officers.si._id })}
                      disabled={assignMutation.isPending}
                      className="w-full text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-blue-500 uppercase">SI</span>
                          <p className="font-bold text-gray-800">{officers.si.name}</p>
                          <p className="text-xs text-gray-500">{officers.si.rank} • {officers.si.badgeNumber}</p>
                        </div>
                        <UserCheck size={20} className="text-blue-500" />
                      </div>
                    </button>
                  )}
                  {!officers?.sho && !officers?.si && (
                    <p className="text-sm text-gray-500 text-center py-4">No officers found for this police station.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Memo list view
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">To be Reviewed by CP Sir</h1>
        <p className="text-gray-500 text-sm mt-1">Review, assign recipients, and approve memos</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">Loading…</div>
        ) : memos.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No memos in this category.</p>
          </div>
        ) : (
          memos.map((memo) => (
            <div
              key={memo._id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
              onClick={() => openDetail(memo)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-gray-800">{memo.policeStation || 'Unknown'} PS</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 font-mono text-xs">Cr.No. {memo.crimeNo || '—'}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(memo.date), 'dd MMM yyyy')}
                    </span>
                  </div>
                  {memo.recipientName && (
                    <div className="text-xs text-indigo-600">
                      Assigned to: {memo.recipientDesignation}, {memo.recipientName}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {tab === 'PENDING_REVIEW' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openAssign(memo); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition"
                    >
                      <UserCheck size={12} />
                      Assign
                    </button>
                  )}
                  {(tab === 'REVIEWED' || tab === 'PENDING_REVIEW') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); approveMutation.mutate(memo._id); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition"
                    >
                      <CheckCircle2 size={12} />
                      Approve
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openDetail(memo); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Review;

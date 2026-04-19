import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppeals, updateAppeal, deleteAppeal } from "../services/endpoints";
import StatusBadge from "../components/StatusBadge";
import { Pencil, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
const APPEAL_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ESCALATED"];
const Appeals = () => {
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [editForm, setEditForm] = useState({ status: "", reason: "", reviewNotes: "" });
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["appeals", page],
    queryFn: async () => {
      const res = await getAppeals({ page, limit: 20 });
      return res.data;
    }
  });
  const openEdit = (a) => {
    setEditForm({ status: a.status, reason: a.reason || "", reviewNotes: a.reviewNotes || "" });
    setEditItem(a);
  };
  const editMutation = useMutation({
    mutationFn: ({ id, data: data2 }) => updateAppeal(id, data2),
    onSuccess: () => {
      toast.success("Appeal updated");
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update appeal")
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAppeal(id),
    onSuccess: () => {
      toast.success("Appeal deleted");
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      setDeleteItem(null);
    },
    onError: () => toast.error("Failed to delete appeal")
  });
  const appeals = data?.data || [];
  const total = data?.total || 0;
  return <div><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500"><h1 className="text-sm font-bold text-white uppercase tracking-wider">Appeals</h1><p className="text-[11px] text-blue-200">Manage and review officer appeals</p></div><div className="border border-slate-200 bg-white overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[700px]"><thead className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white"><tr className="text-left"><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Officer</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Reason</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Status</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">SLA Deadline</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Actions</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr> : appeals.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No appeals found.</td></tr> : appeals.map((a, idx) => <tr key={a._id} className={`border-b border-slate-200 hover:bg-blue-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}><td className="px-4 py-3 text-slate-700">{a.officer?.name || a.officerId}</td><td className="px-4 py-3 max-w-xs truncate text-slate-700">{a.reason}</td><td className="px-4 py-3"><StatusBadge status={a.status} /></td><td className="px-4 py-3 text-slate-600">{format(new Date(a.slaDeadline), "dd MMM yyyy")}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => openEdit(a)} className="text-slate-500 hover:text-blue-600" title="Edit"><Pencil size={14} /></button><button onClick={() => setDeleteItem(a)} className="text-slate-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div></div>{total > 20 && <div className="flex justify-center gap-2 mt-4"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-300 text-[12px] font-bold text-slate-600 uppercase tracking-wider disabled:opacity-50 hover:bg-slate-100">Prev</button><span className="px-3 py-1 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Page {page}</span><button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-300 text-[12px] font-bold text-slate-600 uppercase tracking-wider disabled:opacity-50 hover:bg-slate-100">Next</button></div>}{
    /* Edit Appeal Modal */
  }{editItem && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white shadow-xl w-[95vw] max-w-md overflow-hidden"><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4 flex items-center justify-between"><h2 className="text-sm font-bold text-white uppercase tracking-wider">Edit Appeal</h2><button onClick={() => setEditItem(null)} className="text-blue-200 hover:text-white"><X size={20} /></button></div><div className="p-6 space-y-3"><div><label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Status</label><select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">{APPEAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div><div><label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Reason</label><textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm h-16 resize-none" placeholder="Appeal reason…" /></div><div><label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Review Notes</label><textarea value={editForm.reviewNotes} onChange={(e) => setEditForm({ ...editForm, reviewNotes: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm h-16 resize-none" placeholder="Add review notes…" /></div></div><div className="flex gap-3 px-6 pb-6"><button onClick={() => setEditItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button><button onClick={() => editMutation.mutate({ id: editItem._id, data: editForm })} disabled={editMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50">{editMutation.isPending ? "Saving\u2026" : "Save Changes"}</button></div></div></div>}{
    /* Delete Confirmation */
  }{deleteItem && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white shadow-xl w-[95vw] max-w-sm overflow-hidden"><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-6 py-4"><h3 className="text-sm font-bold text-white uppercase tracking-wider">Delete Appeal?</h3></div><div className="p-6 text-center"><div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4"><Trash2 className="text-red-600" size={24} /></div><p className="text-sm text-slate-500 mb-5">
                This will permanently delete the appeal by {deleteItem.officer?.name || "this officer"}. This action cannot be undone.
              </p><div className="flex gap-3"><button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button><button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50">{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}</button></div></div></div></div>}</div>;
};
export default Appeals;

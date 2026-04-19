import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActions, updateAction, deleteAction } from "../services/endpoints";
import { FileText, AlertTriangle, Ban, Download, Pencil, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
const ACTION_TYPES = ["COUNSELING", "WARNING", "SHOW_CAUSE", "ENQUIRY", "SUSPENSION", "COMMENDATION", "TRANSFER_RECOMMENDATION"];
const ACTION_STATUSES = ["PENDING", "ACKNOWLEDGED", "RESPONDED", "CLOSED", "APPEALED"];
const API_URL = process.env.REACT_APP_API_URL || "";
const Actions = () => {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [editForm, setEditForm] = useState({ actionType: "", status: "", responseDeadline: "" });
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["actions", page, typeFilter],
    queryFn: async () => {
      const params = { page, limit: 20 };
      if (typeFilter) params.actionType = typeFilter;
      const res = await getActions(params);
      return res.data;
    }
  });
  const openEdit = (a) => {
    setEditForm({ actionType: a.actionType, status: a.status, responseDeadline: a.responseDeadline ? new Date(a.responseDeadline).toISOString().split("T")[0] : "" });
    setEditItem(a);
  };
  const editMutation = useMutation({
    mutationFn: ({ id, data: data2 }) => updateAction(id, data2),
    onSuccess: () => {
      toast.success("Action updated");
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update action")
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAction(id),
    onSuccess: () => {
      toast.success("Action deleted");
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setDeleteItem(null);
    },
    onError: () => toast.error("Failed to delete action")
  });
  const actions = data?.data || [];
  const pagination = data?.pagination || { total: 0 };
  const getTypeStyle = (type) => {
    switch (type) {
      case "WARNING":
        return "bg-yellow-100 text-yellow-800";
      case "SUSPENSION":
        return "bg-red-100 text-red-800";
      case "SHOW_CAUSE":
        return "bg-orange-100 text-orange-800";
      case "COMMENDATION":
        return "bg-green-100 text-green-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };
  const getStatusStyle = (status) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "ACKNOWLEDGED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "RESPONDED":
        return "bg-green-50 text-green-700 border-green-200";
      case "CLOSED":
        return "bg-slate-50 text-slate-700 border-slate-200";
      case "APPEALED":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };
  return <div><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500"><h1 className="text-sm font-bold text-white uppercase tracking-wider">Warnings & Disciplinary Actions</h1><p className="text-[11px] text-blue-200 mt-1">
          Auto-generated warnings & suspension orders for officers who failed to act
        </p></div>{
    /* Summary cards */
  }<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"><div className="bg-yellow-50 border border-yellow-200 p-4 flex items-center gap-3"><AlertTriangle className="text-yellow-600" size={24} /><div><div className="text-2xl font-bold text-yellow-700">{actions.filter((a) => a.actionType === "WARNING").length}</div><div className="text-sm text-yellow-600">Warning Letters</div></div></div><div className="bg-red-50 border border-red-200 p-4 flex items-center gap-3"><Ban className="text-red-600" size={24} /><div><div className="text-2xl font-bold text-red-700">{actions.filter((a) => a.actionType === "SUSPENSION").length}</div><div className="text-sm text-red-600">Suspension Orders</div></div></div><div className="bg-blue-50 border border-blue-200 p-4 flex items-center gap-3"><FileText className="text-blue-600" size={24} /><div><div className="text-2xl font-bold text-blue-700">{actions.filter((a) => a.status === "PENDING").length}</div><div className="text-sm text-blue-600">Pending Response</div></div></div></div>{
    /* Filters */
  }<div className="flex flex-wrap gap-2 mb-4">{["", "WARNING", "SUSPENSION", "SHOW_CAUSE", "COUNSELING"].map((t) => <button
    key={t}
    onClick={() => {
      setTypeFilter(t);
      setPage(1);
    }}
    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${typeFilter === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-blue-50/60"}`}
  >{t === "" ? "All" : t.replace(/_/g, " ")}</button>)}</div>{
    /* Table */
  }<div className="border border-slate-200 bg-white overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[700px]"><thead className="bg-gradient-to-r from-[#1a2a4a] to-[#2d4a6f] text-white"><tr className="text-left"><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Date</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Officer</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Badge #</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Type</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">#</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Status</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Deadline</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Document</th><th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Actions</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr> : actions.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No actions found. Warnings will appear here when incidents are logged.</td></tr> : actions.map((a, idx) => <tr key={a._id} className={`border-b border-slate-200 hover:bg-blue-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}><td className="px-4 py-3 text-slate-600">{new Date(a.issuedAt).toLocaleDateString("en-IN")}</td><td className="px-4 py-3 font-medium">{a.officer?.name || "\u2014"}</td><td className="px-4 py-3 font-mono text-slate-500">{a.officer?.badgeNumber || "\u2014"}</td><td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-xs font-semibold ${getTypeStyle(a.actionType)}`}>{a.actionType === "WARNING" && <AlertTriangle size={12} className="inline mr-1" />}{a.actionType === "SUSPENSION" && <Ban size={12} className="inline mr-1" />}{a.actionType.replace(/_/g, " ")}</span></td><td className="px-4 py-3 text-center font-bold text-slate-700">{a.actionNumber}</td><td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 border text-xs font-medium ${getStatusStyle(a.status)}`}>{a.status}</span></td><td className="px-4 py-3 text-slate-500 text-xs">{a.responseDeadline ? new Date(a.responseDeadline).toLocaleDateString("en-IN") : "\u2014"}</td><td className="px-4 py-3">{a.documentUrl ? <a
    href={`${API_URL}${a.documentUrl}`}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
  ><Download size={12} /> PDF
                      </a> : <span className="text-slate-300">—</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => openEdit(a)} className="text-slate-500 hover:text-blue-600" title="Edit"><Pencil size={14} /></button><button onClick={() => setDeleteItem(a)} className="text-slate-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div></div>{pagination.total > 20 && <div className="flex justify-center gap-2 mt-4"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-200 disabled:opacity-50 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Prev</button><span className="px-3 py-1 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Page {page}</span><button disabled={page * 20 >= pagination.total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-200 disabled:opacity-50 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Next</button></div>}{
    /* Edit Action Modal */
  }{editItem && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white shadow-xl w-[95vw] max-w-md overflow-hidden"><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-5 py-4 flex items-center justify-between"><h2 className="text-sm font-bold text-white uppercase tracking-wider">Edit Action</h2><button onClick={() => setEditItem(null)} className="text-blue-200 hover:text-white"><X size={20} /></button></div><div className="p-5 space-y-3"><div><label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Action Type</label><select value={editForm.actionType} onChange={(e) => setEditForm({ ...editForm, actionType: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">{ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></div><div><label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Status</label><select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm">{ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Response Deadline</label><input type="date" value={editForm.responseDeadline} onChange={(e) => setEditForm({ ...editForm, responseDeadline: e.target.value })} className="w-full border border-slate-300 px-3 py-2 text-sm" /></div></div><div className="flex gap-3 px-5 pb-5"><button onClick={() => setEditItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button><button onClick={() => editMutation.mutate({ id: editItem._id, data: editForm })} disabled={editMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50">{editMutation.isPending ? "Saving\u2026" : "Save Changes"}</button></div></div></div>}{
    /* Delete Confirmation */
  }{deleteItem && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white shadow-xl w-[95vw] max-w-sm overflow-hidden"><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] px-5 py-4"><h3 className="text-sm font-bold text-white uppercase tracking-wider text-center">Delete Action?</h3></div><div className="p-5 text-center"><div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4"><Trash2 className="text-red-600" size={24} /></div><p className="text-sm text-slate-500 mb-5">
                This will permanently delete {deleteItem.actionType.replace(/_/g, " ")} #{deleteItem.actionNumber} for {deleteItem.officer?.name || "this officer"}. This action cannot be undone.
              </p><div className="flex gap-3"><button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50">Cancel</button><button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50">{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}</button></div></div></div></div>}</div>;
};
export default Actions;

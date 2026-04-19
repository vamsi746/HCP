import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDSR, generateMemo } from "../../services/endpoints";
import StatusBadge from "../../components/StatusBadge";
import { format } from "date-fns";
import { ArrowLeft, FileWarning, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
const FORCE_LABELS = {
  CHARMINAR_GOLCONDA: "Charminar & Golconda",
  RAJENDRANAGAR_SHAMSHABAD: "Rajendra Nagar & Shamshabad",
  KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS: "Khairatabad, Secunderabad & Jubilee Hills"
};
const DSRDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedCase, setExpandedCase] = useState(null);
  const [generatingMemoId, setGeneratingMemoId] = useState(null);
  const handleGenerateMemo = async (e, caseId) => {
    e.stopPropagation();
    if (!id) return;
    setGeneratingMemoId(caseId);
    try {
      const res = await generateMemo({ dsrId: id, caseId });
      const memo = res.data.data;
      toast.success("Memo generated");
      navigate(`/memos/${memo._id}`);
    } catch {
      toast.error("Failed to generate memo");
    } finally {
      setGeneratingMemoId(null);
    }
  };
  const { data, isLoading } = useQuery({
    queryKey: ["dsr", id],
    queryFn: async () => {
      const res = await getDSR(id);
      return res.data.data;
    },
    enabled: !!id
  });
  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading DSR…</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400">DSR not found</div>;
  const dsr = data;
  const cases = dsr.parsedCases || [];
  const matchedCount = cases.filter((c) => c.matchedPSId).length;
  return <div>{
    /* Header */
  }<div className="flex items-center gap-3 mb-6"><button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition"><ArrowLeft size={20} /></button><div className="flex-1"><h1 className="text-2xl font-bold text-gray-800">{FORCE_LABELS[dsr.forceType] || dsr.forceType}</h1><p className="text-gray-500 text-sm">{format(new Date(dsr.date), "dd MMMM yyyy")} &middot; {dsr.fileName || "No file"}</p></div><StatusBadge status={dsr.processingStatus} /></div>{
    /* Summary Strip */
  }<div className="flex flex-wrap items-center gap-3 sm:gap-6 bg-white rounded-xl shadow px-6 py-4 mb-6 text-sm"><div><span className="text-gray-400">Total Cases</span><span className="ml-2 text-lg font-bold text-gray-800">{dsr.totalCases}</span></div><div className="w-px h-8 bg-gray-200" /><div><span className="text-gray-400">PS Matched</span><span className="ml-2 text-lg font-bold text-green-600">{matchedCount}</span></div><div className="w-px h-8 bg-gray-200" /><div><span className="text-gray-400">Unmatched</span><span className="ml-2 text-lg font-bold text-amber-600">{cases.length - matchedCount}</span></div></div>{
    /* Cases Table */
  }{cases.length > 0 ? <div className="bg-white rounded-xl shadow overflow-x-auto"><table className="w-full text-sm min-w-[700px]"><thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"><th className="px-4 py-3 w-12">S.No</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Social Vice Type</th><th className="px-4 py-3">Cr. No</th><th className="px-4 py-3">PS</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Action Taken By</th><th className="px-4 py-3">Responsible SI</th><th className="px-4 py-3">Action</th><th className="px-4 py-3 w-10" /></tr></thead><tbody className="divide-y divide-gray-100">{cases.map((c) => {
    const matchedPS = typeof c.matchedPSId === "object" ? c.matchedPSId : null;
    const matchedOfficer = typeof c.matchedOfficerId === "object" ? c.matchedOfficerId : null;
    const matchedSHO = typeof c.matchedSHOId === "object" ? c.matchedSHOId : null;
    const isExpanded = expandedCase === c._id;
    return <React.Fragment key={c._id}><tr
      className="hover:bg-gray-50 cursor-pointer transition"
      onClick={() => setExpandedCase(isExpanded ? null : c._id)}
    ><td className="px-4 py-3 font-semibold text-gray-700">{c.slNo}</td><td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.zone || "\u2014"}</td><td className="px-4 py-3 text-gray-600">{c.socialViceType || "None"}</td><td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.crNo || "\u2014"}</td><td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.policeStation || "\u2014"}</td><td className="px-4 py-3 text-gray-600">{c.sector || "\u2014"}</td><td className="px-4 py-3"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">{c.actionTakenBy || "Task Force"}</span></td><td className="px-4 py-3">{matchedOfficer ? <span className="text-xs text-blue-700 font-medium">{matchedOfficer.name}</span> : <span className="text-xs text-gray-400">—</span>}</td><td className="px-4 py-3"><button
      onClick={(e) => handleGenerateMemo(e, c._id)}
      disabled={generatingMemoId === c._id}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-sm transition-all disabled:opacity-50"
    >{generatingMemoId === c._id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}{generatingMemoId === c._id ? "Generating\u2026" : "Generate"}</button></td><td className="px-4 py-3 text-gray-400">{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td></tr>{
      /* Expanded Detail Row */
    }{isExpanded && <tr><td colSpan={10} className="p-0 bg-gradient-to-b from-slate-100 via-slate-50 to-white"><div className="px-5 pt-3 pb-4"><div className="relative"><div className="absolute inset-x-2 -bottom-1 h-2 bg-slate-200/60 rounded-b-xl" /><div className="absolute inset-x-1 -bottom-0.5 h-1 bg-slate-100/80 rounded-b-lg" /><div className="relative bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">{
      /* Accent bar */
    }<div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />{
      /* ── Case Identity ── */
    }<div className="px-4 pt-4 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-3"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Case Identity</span><div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />{c.warningGenerated && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600 uppercase">Warning Generated</span>}</div><div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 text-xs"><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">S.No</span><span className="text-slate-800 font-bold text-sm">{c.slNo}</span></div><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Zone</span><span className="text-gray-800 font-medium">{c.zone || "\u2014"}</span></div><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Police Station</span><span className="text-gray-800 font-medium">{c.policeStation || "\u2014"}</span></div><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Sector</span><span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">{c.sector || "\u2014"}</span></div><div className="bg-violet-50 rounded-lg p-2.5 border border-violet-100"><span className="block text-[10px] text-violet-400 uppercase font-semibold mb-0.5">Action Taken By</span><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">{c.actionTakenBy || "Task Force"}</span></div><div className={`rounded-lg p-2.5 border ${matchedSHO ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60" : "bg-gray-50 border-gray-200"}`}><span className="block text-[10px] text-amber-500 uppercase font-semibold mb-0.5">SHO</span>{matchedSHO ? <><span className="text-amber-800 font-bold text-xs block leading-tight">{matchedSHO.name}</span><span className="text-[10px] text-amber-600">{matchedSHO.rank}</span></> : <span className="text-gray-400 text-[10px]">—</span>}</div><div className={`rounded-lg p-2.5 border ${matchedOfficer ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60" : "bg-gray-50 border-gray-200"}`}><span className="block text-[10px] text-blue-500 uppercase font-semibold mb-0.5">Responsible SI</span>{matchedOfficer ? <><span className="text-blue-800 font-bold text-xs block leading-tight">{matchedOfficer.name}</span><span className="text-[10px] text-blue-600">{matchedOfficer.rank}</span></> : <span className="text-gray-400 text-[10px]">—</span>}</div><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Social Vice Type</span>{c.socialViceType && c.socialViceType !== "None" ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{c.socialViceType}</span> : <span className="text-gray-400">None</span>}</div><div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Nature of Case</span><span className="text-gray-800 font-medium leading-snug">{c.natureOfCase || c.crimeHead || "\u2014"}</span></div></div>{
      /* Matched PS + Raided By */
    }<div className="flex gap-4 mt-3"><div><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Matched PS</span>{matchedPS ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium"><CheckCircle2 size={12} /> {matchedPS.name}</span> : <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle size={12} /> Unmatched
                                        </span>}</div><div><span className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Raided By</span><span className="text-gray-700 text-xs">{dsr.raidedBy || "\u2014"}</span></div></div></div>{
      /* ── Name of the P.S., Cr. No, U/Sec & D.O.R ── */
    }<div className="px-4 pt-3 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Name of the P.S., Cr. No, U/Sec & D.O.R</span><div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" /></div><div className="text-xs text-gray-800 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 leading-relaxed">{c.psWithCrDetails || `${c.policeStation || "\u2014"} PS Cr.No. ${c.crNo || "\u2014"} U/s ${c.sections || "\u2014"} DOR: ${c.dor || "\u2014"}`}</div></div>{
      /* ── Details of Accused ── */
    }<div className="px-4 pt-3 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Details of Accused (Name, S/o, Age, R/o & Contact No.)</span><div className="flex-1 h-px bg-gradient-to-r from-orange-200 to-transparent" /><div className="flex gap-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{c.numAccused || 0} Accused</span><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{c.numCases || 0} Cases</span><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">{c.abscondingAccused || 0} Absconding</span></div></div><div className="text-xs text-gray-800 bg-orange-50/50 p-3 rounded-lg border border-orange-100 leading-relaxed">{c.accusedParticulars || c.accusedDetails || "\u2014"}</div></div>{
      /* ── BRIEF FACTS ── */
    }<div className="px-4 pt-3 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider">Brief Facts</span><div className="flex-1 h-px bg-gradient-to-r from-teal-200 to-transparent" /></div><div className="text-xs text-gray-800 bg-teal-50/50 p-3 rounded-lg border border-teal-100 leading-relaxed">{c.briefFacts || <span className="text-gray-400 italic">No brief facts extracted</span>}</div></div>{
      /* ── Seized Property ── */
    }{(c.seizedProperty || c.seizedWorth) && <div className="px-4 pt-3 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Property Seized & Worth</span><div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />{c.seizedWorth && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">{c.seizedWorth}</span>}</div>{c.seizedProperty && <div className="text-xs text-gray-800 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">{c.seizedProperty}</div>}</div>}{
      /* ── Extracted Locations ── */
    }{c.extractedLocations && c.extractedLocations.length > 0 && <div className="px-4 pt-3 pb-3 border-b border-gray-100"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Extracted Locations</span><div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" /></div><div className="flex flex-wrap gap-2">{c.extractedLocations.map((loc, i) => <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${loc.type === "ps_reference" ? "bg-violet-50 text-violet-700 border-violet-200" : loc.type === "residential" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}><span className={`w-1.5 h-1.5 rounded-full ${loc.type === "ps_reference" ? "bg-violet-400" : loc.type === "residential" ? "bg-teal-400" : "bg-orange-400"}`} />{loc.rawText}</span>)}</div></div>}</div></div></div></td></tr>}</React.Fragment>;
  })}</tbody></table></div> : <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400"><FileWarning size={48} className="mx-auto mb-3 text-gray-300" /><p>No cases were extracted from this document.</p><p className="text-sm mt-1">The document may be in an unsupported format or empty.</p></div>}</div>;
};
export default DSRDetail;

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getOfficerMemoTracker, getOfficerMemos, getHierarchy, downloadComplianceDocument } from "../services/endpoints";
import FilterDropdown from "../components/FilterDropdown";
import {
  Filter,
  Shield,
  MapPin,
  Search,
  FileText,
  Calendar,
  RotateCcw,
  AlertTriangle,
  UserCheck,
  Eye,
  Users,
  X,
  Download,
  CheckCircle2,
  Clock,
  ArrowRight,
  Gavel,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { renderAsync } from "docx-preview";
const RANK_LABELS = {
  COMMISSIONER: "CP",
  ADDL_CP: "Addl. CP",
  DCP: "DCP",
  ACP: "ACP",
  CI: "CI",
  SI: "SI",
  WSI: "WSI",
  PSI: "PSI",
  ASI: "ASI",
  HEAD_CONSTABLE: "HC",
  CONSTABLE: "Const."
};
const OfficerTracker = () => {
  const navigate = useNavigate();
  const [filterZoneId, setFilterZoneId] = useState("");
  const [filterPsId, setFilterPsId] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [viewMode, setViewMode] = useState("with-memos");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const { data: hierarchyData } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => {
      const res = await getHierarchy();
      return res.data.data;
    },
    staleTime: 5 * 60 * 1e3
  });
  const allStations = useMemo(() => {
    if (!hierarchyData) return [];
    const stations = [];
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
  const allSectors = useMemo(() => {
    if (!hierarchyData) return [];
    const sectors = [];
    for (const zone of hierarchyData) {
      for (const div of zone.divisions || []) {
        for (const circle of div.circles || []) {
          for (const station of circle.stations || []) {
            for (const sec of station.sectors || []) {
              if (sec.name && sec.name !== "Sector 0") {
                sectors.push({ _id: sec._id, name: sec.name, psId: station._id, zoneId: zone._id });
              }
            }
          }
        }
      }
    }
    return sectors;
  }, [hierarchyData]);
  const sectorList = useMemo(() => {
    let sectors = allSectors;
    if (filterPsId) sectors = allSectors.filter((s) => s.psId === filterPsId);
    else if (filterZoneId) sectors = allSectors.filter((s) => s.zoneId === filterZoneId);
    const seen = /* @__PURE__ */ new Set();
    return sectors.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, void 0, { numeric: true }));
  }, [allSectors, filterPsId, filterZoneId]);
  const hasActiveFilters = filterZoneId || filterPsId || filterSector || search;
  const onZoneChange = (v) => {
    setFilterZoneId(v);
    setPage(1);
    if (v && filterPsId) {
      const ps = allStations.find((s) => s._id === filterPsId);
      if (ps && ps.zoneId !== v) {
        setFilterPsId("");
        setFilterSector("");
      }
    }
  };
  const onPsChange = (v) => {
    setFilterPsId(v);
    setPage(1);
    if (v) {
      const ps = allStations.find((s) => s._id === v);
      if (ps && !filterZoneId) setFilterZoneId(ps.zoneId);
      if (ps && filterZoneId && ps.zoneId !== filterZoneId) setFilterZoneId(ps.zoneId);
    }
  };
  const clearFilters = () => {
    setFilterZoneId("");
    setFilterPsId("");
    setFilterSector("");
    setSearch("");
    setPage(1);
  };
  const { data: trackerResponse, isLoading } = useQuery({
    queryKey: ["officer-memo-tracker", filterZoneId, filterPsId, filterSector, search, viewMode, page],
    queryFn: async () => {
      const params = { viewMode, page, limit: PAGE_SIZE };
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (search.trim()) params.search = search.trim();
      const res = await getOfficerMemoTracker(params);
      return res.data;
    },
    placeholderData: (prev) => prev
  });
  const rows = trackerResponse?.data || [];
  const stats = trackerResponse?.stats || { totalOfficers: 0, officersWithMemos: 0, totalMemos: 0, actionRequired: 0 };
  const pagination = trackerResponse?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };
  const getWarningLevel = (count) => {
    if (count === 0) return { label: "No Memos", color: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    if (count === 1) return { label: "1st Warning", color: "bg-amber-50 text-amber-700 border-amber-200" };
    if (count === 2) return { label: "2nd Warning", color: "bg-orange-50 text-orange-700 border-orange-200" };
    return { label: "Charge Memo Due", color: "bg-red-50 text-red-700 border-red-200" };
  };
  const switchView = (mode) => {
    setViewMode(mode);
    setPage(1);
    setSelectedOfficer(null);
  };
  return <div className="flex-1 flex flex-col overflow-hidden -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 -mb-3 sm:-mb-4 md:-mb-6 px-3 sm:px-4 md:px-6">{
    /* Header */
  }<div className="flex-shrink-0 bg-[#003366] -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-3 pb-3 border-b-2 border-[#B8860B]"><h1 className="text-sm font-bold text-white uppercase tracking-wider">Memo History</h1><p className="text-[11px] text-neutral-400 mt-0.5">Officer-wise memo tracking — 3 memos trigger charge memo</p></div>{
    /* Filters + View Mode Buttons */
  }<div className="flex-shrink-0 flex items-center gap-2 py-3 flex-wrap"><FilterDropdown
    icon={<Filter size={13} />}
    placeholder="All Zones"
    value={filterZoneId}
    onChange={onZoneChange}
    options={(hierarchyData || []).map((z) => ({ value: z._id, label: z.name }))}
  /><FilterDropdown
    icon={<Shield size={13} />}
    placeholder="All Stations"
    value={filterPsId}
    onChange={onPsChange}
    options={filteredStations.map((s) => ({ value: s._id, label: s.name }))}
    searchable
  /><FilterDropdown
    icon={<MapPin size={13} />}
    placeholder="All Sectors"
    value={filterSector}
    onChange={(v) => {
      setFilterSector(v);
      setPage(1);
    }}
    options={sectorList.map((s) => ({ value: s.name, label: s.name }))}
  /><div className="inline-flex items-center gap-1.5 bg-white shadow-sm border border-slate-200 text-slate-700 pl-3 pr-2.5 py-[7px] rounded-lg"><Search size={13} className="flex-shrink-0 text-slate-400" /><input
    type="text"
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setPage(1);
    }}
    placeholder="Search officer name"
    className="text-[12px] font-medium bg-transparent focus:outline-none text-slate-700 w-full sm:w-[180px] placeholder:text-slate-400"
  /></div>{hasActiveFilters && <button
    onClick={clearFilters}
    className="inline-flex items-center gap-1 bg-white shadow-sm border border-slate-200 text-red-600 px-2.5 py-[7px] rounded-lg text-[12px] font-semibold hover:bg-red-50 transition-colors"
  ><RotateCcw size={12} />
            Clear
          </button>}<div className="w-px h-6 bg-slate-200 mx-0.5 hidden sm:block" />{
    /* View mode buttons */
  }<button
    onClick={() => switchView("all")}
    className={`inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12px] font-semibold border transition-all ${viewMode === "all" ? "bg-[#003366] text-white border-[#003366]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
  ><Users size={13} />
          All <span className="font-bold">{stats.totalOfficers}</span></button><button
    onClick={() => switchView("with-memos")}
    className={`inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12px] font-semibold border transition-all ${viewMode === "with-memos" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
  ><AlertTriangle size={13} />
          Warnings <span className="font-bold">{stats.officersWithMemos}</span></button><button
    onClick={() => switchView("action-required")}
    className={`inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12px] font-semibold border transition-all ${viewMode === "action-required" ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-slate-200 hover:border-red-300"}`}
  ><Gavel size={13} />
          Charge Due <span className="font-bold">{stats.actionRequired}</span></button></div>{
    /* Main content area */
  }<div className={`flex-1 flex flex-col ${selectedOfficer ? "lg:flex-row" : ""} gap-3 min-h-0 overflow-hidden`}>{
    /* Officer Table */
  }<div className={`${selectedOfficer ? "min-h-[200px] lg:min-h-0 lg:w-[42%] xl:w-[38%] flex-shrink-0" : "w-full"} flex flex-col min-h-0`}><div className="border border-slate-200 bg-white rounded-lg overflow-hidden flex-1 flex flex-col"><div className="overflow-auto flex-1"><table className="w-full text-[12px]"><thead className="sticky top-0 z-10"><tr className="bg-[#003366] text-white text-left"><th className="px-2 py-2.5 font-bold text-[10px] uppercase tracking-wider w-[32px] text-center">#</th><th className="px-2 py-2.5 font-bold text-[10px] uppercase tracking-wider">Officer</th><th className={`px-2 py-2.5 font-bold text-[10px] uppercase tracking-wider ${selectedOfficer ? "hidden xl:table-cell" : ""}`}>Station / Sector</th><th className="px-2 py-2.5 font-bold text-[10px] uppercase tracking-wider w-[56px] text-center">Memos</th><th className={`px-2 py-2.5 font-bold text-[10px] uppercase tracking-wider w-[100px] text-center ${selectedOfficer ? "hidden 2xl:table-cell" : ""}`}>Status</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400 font-medium text-[13px]">Loading officers…</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-16 text-center"><UserCheck size={28} className="mx-auto text-slate-300 mb-2" /><p className="text-[13px] font-semibold text-slate-500">{viewMode === "with-memos" ? "No officers with warnings" : viewMode === "action-required" ? "No officers with charge memo due" : "No officers found"}</p></td></tr> : rows.map((row, idx) => {
    const warning = getWarningLevel(row.memoCount);
    const isSelected = selectedOfficer?.officerId === row.officerId && selectedOfficer?.sectorId === row.sectorId;
    return <tr
      key={`${row.officerId}-${row.sectorId}-${idx}`}
      onClick={() => row.memoCount > 0 ? setSelectedOfficer(isSelected ? null : row) : void 0}
      className={`border-b border-slate-100 transition-colors ${row.memoCount > 0 ? "cursor-pointer" : ""} ${isSelected ? "bg-blue-50 border-l-[3px] border-l-[#003366]" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${!isSelected && row.memoCount > 0 ? "hover:bg-slate-50" : ""} ${!isSelected && row.memoCount >= 3 ? "border-l-[3px] border-l-red-400" : ""}`}
    ><td className="px-2 py-2 text-center text-slate-400 font-medium text-[11px]">{(pagination.page - 1) * pagination.limit + idx + 1}</td><td className="px-2 py-2"><div className="min-w-0"><p className="font-bold text-slate-800 truncate text-[12px] leading-tight">{row.name}</p><div className="flex items-center gap-1.5 mt-0.5"><span className="text-[9px] font-bold text-[#003366] bg-[#003366]/8 px-1.5 py-[1px] rounded">{row.role !== "\u2014" ? row.role.replace(/_/g, " ") : RANK_LABELS[row.rank] || row.rank}</span></div>{
      /* Show station inline when column is hidden */
    }{selectedOfficer && <p className="text-[10px] text-slate-400 truncate mt-0.5 xl:hidden">{row.policeStation} · {row.sector}</p>}</div></td><td className={`px-2 py-2 ${selectedOfficer ? "hidden xl:table-cell" : ""}`}><p className="text-slate-700 truncate text-[11px] font-medium">{row.policeStation}</p><p className="text-slate-400 text-[10px] truncate">{row.zone} · {row.sector}</p></td><td className="px-2 py-2 text-center">{row.memoCount > 0 ? <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${row.memoCount >= 3 ? "bg-red-600 text-white" : row.memoCount === 2 ? "bg-orange-500 text-white" : "bg-amber-500 text-white"}`}>{row.memoCount}</span> : <span className="text-slate-300 text-[12px]">—</span>}</td><td className={`px-2 py-2 text-center ${selectedOfficer ? "hidden 2xl:table-cell" : ""}`}><span className={`inline-block px-2 py-1 text-[9px] font-bold tracking-wider rounded border ${warning.color}`}>{warning.label.toUpperCase()}</span></td></tr>;
  })}</tbody></table></div>{
    /* Footer with pagination */
  }{!isLoading && <div className="flex-shrink-0 border-t border-slate-100 px-3 py-1.5 bg-slate-50/60 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-400 tabular-nums">{pagination.total > 0 ? `${(pagination.page - 1) * pagination.limit + 1}\u2013${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : "0 officers"}</span>{pagination.totalPages > 1 && <div className="flex items-center gap-1"><button
    onClick={() => setPage((p) => Math.max(1, p - 1))}
    disabled={page <= 1}
    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
  ><ChevronLeft size={14} className="text-slate-600" /></button><span className="text-[11px] font-semibold text-slate-500 tabular-nums px-1">{pagination.page} / {pagination.totalPages}</span><button
    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
    disabled={page >= pagination.totalPages}
    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
  ><ChevronRight size={14} className="text-slate-600" /></button></div>}</div>}</div></div>{
    /* Officer Detail Panel */
  }{selectedOfficer && <div className="flex-1 min-h-0 flex flex-col overflow-hidden"><OfficerDetailPanel
    officer={selectedOfficer}
    onClose={() => setSelectedOfficer(null)}
    onViewMemo={(memoId) => navigate(`/memos/${memoId}`)}
  /></div>}</div></div>;
};
const OfficerDetailPanel = ({ officer, onClose, onViewMemo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["officer-memos", officer.officerId],
    queryFn: async () => {
      const res = await getOfficerMemos(officer.officerId);
      return res.data.data;
    }
  });
  const memos = data || [];
  const compliedCount = memos.filter((m) => m.complianceStatus === "COMPLIED").length;
  const awaitingCount = memos.filter((m) => m.complianceStatus === "AWAITING_REPLY").length;
  const [compliancePreview, setCompliancePreview] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceBlob, setComplianceBlob] = useState(null);
  const [complianceUrl, setComplianceUrl] = useState(null);
  const docxPreviewRef = useRef(null);
  const openCompliancePreview = async (memoId, docName) => {
    const isPdf = docName.toLowerCase().endsWith(".pdf");
    const isDocxFile = docName.toLowerCase().endsWith(".docx");
    if (isPdf) {
      try {
        const res = await downloadComplianceDocument(memoId);
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const w = Math.min(1100, window.screen.availWidth - 100);
        const h = Math.min(800, window.screen.availHeight - 100);
        const left = Math.round((window.screen.availWidth - w) / 2);
        const top = Math.round((window.screen.availHeight - h) / 2);
        window.open(url, "_blank", `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0`);
      } catch {
      }
      return;
    }
    setCompliancePreview({ memoId, docName });
    setComplianceLoading(true);
    setComplianceBlob(null);
    setComplianceUrl(null);
    try {
      const res = await downloadComplianceDocument(memoId);
      const blob = new Blob([res.data], { type: res.headers?.["content-type"] || "application/octet-stream" });
      setComplianceBlob(blob);
      setComplianceUrl(URL.createObjectURL(blob));
    } catch {
      setComplianceBlob(null);
    } finally {
      setComplianceLoading(false);
    }
  };
  const closeCompliancePreview = () => {
    if (complianceUrl) URL.revokeObjectURL(complianceUrl);
    setCompliancePreview(null);
    setComplianceBlob(null);
    setComplianceUrl(null);
  };
  const handleComplianceDownload = () => {
    if (!complianceUrl || !compliancePreview) return;
    const a = document.createElement("a");
    a.href = complianceUrl;
    a.download = compliancePreview.docName;
    a.click();
  };
  const isDocx = compliancePreview?.docName?.toLowerCase().endsWith(".docx");
  useEffect(() => {
    if (docxPreviewRef.current && complianceBlob && isDocx && !complianceLoading) {
      docxPreviewRef.current.innerHTML = "";
      renderAsync(complianceBlob, docxPreviewRef.current, void 0, {
        className: "compliance-docx-preview",
        inWrapper: false,
        ignoreWidth: true,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false
      }).catch(() => {
      });
    }
  }, [complianceBlob, isDocx, complianceLoading]);
  return <div className="bg-white border border-slate-200 rounded-lg flex flex-col h-full overflow-hidden">{
    /* Panel Header */
  }<div className="bg-[#003366] px-4 sm:px-5 py-3 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-white font-bold text-[14px] truncate">{officer.name}</h2><div className="flex items-center gap-2 mt-1 flex-wrap"><span className="text-[10px] font-bold text-blue-200 bg-white/15 px-2 py-0.5 rounded">{RANK_LABELS[officer.rank] || officer.rank}</span><span className="text-[10px] text-blue-200">{officer.policeStation} · {officer.sector}</span><span className="text-[10px] text-blue-300/60">|</span><span className="text-[10px] text-blue-200">{officer.zone}</span></div></div><button onClick={onClose} className="text-white/60 hover:text-white mt-0.5 flex-shrink-0"><X size={16} /></button></div>{
    /* Warning Progress Bar */
  }<div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Warning Escalation</span>{officer.memoCount >= 3 && <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse"><Gavel size={10} />
              CHARGE MEMO DUE
            </span>}</div><div className="flex items-center gap-1">{[1, 2, 3].map((step) => <React.Fragment key={step}><div className="flex flex-col items-center gap-1 flex-1"><div className={`w-full h-2 rounded-full ${officer.memoCount >= step ? step === 3 ? "bg-red-500" : step === 2 ? "bg-orange-400" : "bg-amber-400" : "bg-slate-200"}`} /><span className={`text-[9px] font-bold ${officer.memoCount >= step ? step === 3 ? "text-red-600" : step === 2 ? "text-orange-600" : "text-amber-600" : "text-slate-300"}`}>{step === 3 ? "3rd Memo" : step === 2 ? "2nd Memo" : "1st Memo"}</span></div>{step < 3 && <ArrowRight size={10} className={`mt-[-10px] flex-shrink-0 ${officer.memoCount > step ? "text-slate-400" : "text-slate-200"}`} />}</React.Fragment>)}<ArrowRight size={10} className={`mt-[-10px] flex-shrink-0 ${officer.memoCount >= 3 ? "text-red-400" : "text-slate-200"}`} /><div className="flex flex-col items-center gap-1"><div className={`w-16 h-2 rounded-full ${officer.memoCount >= 3 ? "bg-red-700" : "bg-slate-200"}`} /><span className={`text-[9px] font-bold whitespace-nowrap ${officer.memoCount >= 3 ? "text-red-700" : "text-slate-300"}`}>
              Charge Memo
            </span></div></div></div>{
    /* Compliance summary */
  }{!isLoading && memos.length > 0 && <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 flex items-center gap-4 flex-wrap"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compliance:</span><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 size={12} /> {compliedCount} Complied
          </span><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Clock size={12} /> {awaitingCount} Awaiting
          </span><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><FileText size={12} /> {memos.length} Total
          </span></div>}{
    /* Memo Timeline */
  }<div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">{isLoading ? <div className="flex items-center justify-center py-12"><p className="text-[12px] text-slate-400 font-medium">Loading memo history…</p></div> : memos.length === 0 ? <div className="flex items-center justify-center py-12"><p className="text-[12px] text-slate-400 font-medium">No memos found for this officer.</p></div> : <div className="space-y-0">{memos.map((memo, idx) => {
    const warningNum = idx + 1;
    const isComplied = memo.complianceStatus === "COMPLIED";
    const isAwaiting = memo.complianceStatus === "AWAITING_REPLY";
    return <div key={memo._id} className="relative pl-7 pb-5 last:pb-0">{
      /* Timeline line */
    }{idx < memos.length - 1 && <div className="absolute left-[11px] top-[22px] bottom-0 w-[2px] bg-slate-200" />}{
      /* Timeline dot */
    }<div className={`absolute left-0 top-[2px] w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${warningNum >= 3 ? "bg-red-600 text-white border-red-600" : warningNum === 2 ? "bg-orange-500 text-white border-orange-500" : "bg-amber-500 text-white border-amber-500"}`}>{warningNum}</div>{
      /* Memo Card */
    }<div className={`border rounded-lg overflow-hidden ${warningNum >= 3 ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>{
      /* Card header */
    }<div className="px-3 py-2.5 flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded ${warningNum >= 3 ? "bg-red-100 text-red-700" : warningNum === 2 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{warningNum >= 3 ? "3rd Warning" : warningNum === 2 ? "2nd Warning" : "1st Warning"}</span>{memo.memoNumber && <span className="text-[10px] text-slate-400 font-mono">{memo.memoNumber}</span>}</div><p className="text-[11px] font-semibold text-slate-700 mt-1 line-clamp-2">{memo.subject || `Cr. No ${memo.crimeNo || "\u2014"} \xB7 u/s ${memo.sections || "\u2014"}`}</p><div className="flex items-center gap-3 mt-1.5 flex-wrap"><span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Calendar size={10} className="text-slate-400" />
                            Issued: {memo.approvedAt ? format(new Date(memo.approvedAt), "dd MMM yyyy") : "\u2014"}</span>{memo.policeStation && <span className="text-[10px] text-slate-400">{memo.policeStation}</span>}</div></div><button
      onClick={() => onViewMemo(memo._id)}
      className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-[#003366] hover:text-[#B8860B] bg-[#003366]/5 hover:bg-[#B8860B]/10 px-2 py-1 rounded transition-colors"
    ><Eye size={11} />
                        View
                      </button></div>{
      /* Compliance Section */
    }<div className={`px-3 py-2 border-t ${isComplied ? "bg-emerald-50/60 border-emerald-100" : isAwaiting ? "bg-amber-50/40 border-amber-100" : "bg-slate-50/60 border-slate-100"}`}><div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2">{isComplied ? <><CheckCircle2 size={13} className="text-emerald-600" /><div><span className="text-[10px] font-bold text-emerald-700">Compliance Received</span>{memo.compliedAt && <span className="text-[10px] text-emerald-600 ml-1.5">
                                    on {format(new Date(memo.compliedAt), "dd MMM yyyy")}</span>}</div></> : isAwaiting ? <><Clock size={13} className="text-amber-600" /><span className="text-[10px] font-bold text-amber-700">Awaiting Compliance</span></> : <><Clock size={13} className="text-slate-400" /><span className="text-[10px] font-semibold text-slate-400">No compliance yet</span></>}</div>{isComplied && memo.complianceDocumentName && <button
      onClick={() => openCompliancePreview(memo._id, memo.complianceDocumentName)}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003366] hover:text-[#B8860B] bg-[#003366]/5 hover:bg-[#B8860B]/10 px-2 py-1 rounded transition-colors"
    ><Eye size={10} />
                            View Compliance
                          </button>}</div>{isComplied && memo.complianceRemarks && <p className="text-[10px] text-emerald-600 mt-1 pl-5 line-clamp-2">{memo.complianceRemarks}</p>}</div></div></div>;
  })}</div>}</div>{
    /* Compliance Document Preview Modal */
  }{compliancePreview && <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={closeCompliancePreview}><div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>{
    /* Modal Header */
  }<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#003366] rounded-t-lg"><div className="min-w-0"><h3 className="text-[12px] font-bold text-white uppercase tracking-wider">Compliance Document</h3><p className="text-[10px] text-blue-200 truncate mt-0.5">{compliancePreview.docName}</p></div><div className="flex items-center gap-2"><button
    onClick={handleComplianceDownload}
    disabled={!complianceUrl}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-white/25 rounded transition disabled:opacity-40"
  ><Download size={12} />
                  Download
                </button><button onClick={closeCompliancePreview} className="p-1 text-white/60 hover:text-white transition"><X size={16} /></button></div></div>{
    /* Modal Body */
  }<div className="flex-1 overflow-auto p-4 bg-slate-50">{complianceLoading ? <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-slate-400" /></div> : !complianceBlob ? <div className="flex items-center justify-center py-20"><p className="text-[12px] text-slate-400 font-medium">Failed to load document</p></div> : isDocx ? <div ref={docxPreviewRef} className="bg-white border border-slate-200 p-4 min-h-[300px]" /> : complianceUrl ? <iframe src={complianceUrl} className="w-full h-[60vh] border border-slate-200 bg-white" title="Compliance Document" /> : null}</div></div></div>}</div>;
};
export default OfficerTracker;

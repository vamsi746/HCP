import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMemos, deleteMemo, getHierarchy, getMemoCounts, complyMemo, downloadComplianceDocument, updateCompliance, deleteComplianceDocument } from "../../services/endpoints";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, Trash2, Eye, ChevronLeft, ChevronRight, Filter, RotateCcw, Shield, MapPin, Calendar, X, Download, ChevronDown, Upload, Pencil, MessageSquareText } from "lucide-react";
import FilterDropdown from "../../components/FilterDropdown";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { renderAsync } from "docx-preview";
const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PENDING_REVIEW", label: "Pending Review" },
  { key: "APPROVED,ON_HOLD,REJECTED", label: "Reviewed" },
  { key: "__COMPLIANCE__", label: "Compliance" }
];
const STATUS_CONFIG = {
  DRAFT: { bg: "bg-amber-600", text: "text-white", label: "DRAFT" },
  PENDING_REVIEW: { bg: "bg-blue-700", text: "text-white", label: "PENDING" },
  REVIEWED: { bg: "bg-indigo-700", text: "text-white", label: "REVIEWED" },
  ON_HOLD: { bg: "bg-orange-600", text: "text-white", label: "ON HOLD" },
  REJECTED: { bg: "bg-red-700", text: "text-white", label: "REJECTED" },
  APPROVED: { bg: "bg-emerald-700", text: "text-white", label: "APPROVED" },
  SENT: { bg: "bg-slate-700", text: "text-white", label: "SENT" }
};
const MemoList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState(() => location.state?.tab || "");
  const [page, setPage] = useState(1);
  const [deleteItem, setDeleteItem] = useState(null);
  const [complianceSubFilter, setComplianceSubFilter] = useState(() => location.state?.subFilter || "");
  const [complianceModal, setComplianceModal] = useState(null);
  const [complianceRemarks, setComplianceRemarks] = useState("");
  const [complianceFile, setComplianceFile] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const modalDocxRef = useRef(null);
  const [detailMemo, setDetailMemo] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editRemarks, setEditRemarks] = useState("");
  const [replaceFile, setReplaceFile] = useState(null);
  const [filterZoneId, setFilterZoneId] = useState("");
  const [filterPsId, setFilterPsId] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
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
  const hasActiveFilters = filterZoneId || filterPsId || filterSector || filterDateFrom || filterDateTo;
  const onZoneChange = (v) => {
    setFilterZoneId(v);
    if (v && filterPsId) {
      const ps = allStations.find((s) => s._id === filterPsId);
      if (ps && ps.zoneId !== v) {
        setFilterPsId("");
        setFilterSector("");
      }
    }
    setPage(1);
  };
  const onPsChange = (v) => {
    setFilterPsId(v);
    if (v) {
      const ps = allStations.find((s) => s._id === v);
      if (ps && !filterZoneId) setFilterZoneId(ps.zoneId);
      if (ps && filterZoneId && ps.zoneId !== filterZoneId) setFilterZoneId(ps.zoneId);
    }
    setPage(1);
  };
  const clearFilters = () => {
    setFilterZoneId("");
    setFilterPsId("");
    setFilterSector("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };
  const isComplianceTab = statusFilter === "__COMPLIANCE__";
  const { data, isLoading } = useQuery({
    queryKey: ["memos", statusFilter, page, filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo, complianceSubFilter],
    queryFn: async () => {
      const params = { page, limit: 20 };
      if (isComplianceTab) {
        params.complianceView = "true";
        if (complianceSubFilter) params.complianceStatus = complianceSubFilter;
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      const res = await getMemos(params);
      return res.data;
    }
  });
  const { data: countsData } = useQuery({
    queryKey: ["memos-counts", filterZoneId, filterPsId, filterSector, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params = {};
      if (filterZoneId) params.zoneId = filterZoneId;
      if (filterPsId) params.psId = filterPsId;
      if (filterSector) params.sector = filterSector;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      const res = await getMemoCounts(params);
      return res.data.data;
    }
  });
  const getTabCount = (tabKey) => {
    if (!countsData) return 0;
    if (tabKey === "__COMPLIANCE__") return countsData["__COMPLIANCE__"] || 0;
    if (tabKey === "") {
      return Object.entries(countsData).filter(([k]) => !k.startsWith("compliance_") && !k.startsWith("__")).reduce((sum, [, c]) => sum + c, 0);
    }
    const statuses = tabKey.split(",");
    return statuses.reduce((sum, s) => sum + (countsData[s] || 0), 0);
  };
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMemo(id),
    onSuccess: () => {
      toast.success("Memo deleted");
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.invalidateQueries({ queryKey: ["memos-counts"] });
      queryClient.invalidateQueries({ queryKey: ["memos-pending-count"] });
      setDeleteItem(null);
    },
    onError: () => toast.error("Failed to delete memo")
  });
  const complyMutation = useMutation({
    mutationFn: ({ id, formData }) => complyMemo(id, formData),
    onSuccess: () => {
      toast.success("Compliance recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.invalidateQueries({ queryKey: ["memos-counts"] });
      setComplianceModal(null);
      setComplianceRemarks("");
      setComplianceFile(null);
    },
    onError: () => toast.error("Failed to record compliance")
  });
  const updateComplianceMutation = useMutation({
    mutationFn: ({ id, formData }) => updateCompliance(id, formData),
    onSuccess: () => {
      toast.success("Compliance updated");
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      setIsEditMode(false);
      setReplaceFile(null);
      setDetailMemo(null);
    },
    onError: () => toast.error("Failed to update compliance")
  });
  const deleteDocMutation = useMutation({
    mutationFn: (id) => deleteComplianceDocument(id),
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      setDetailMemo(null);
      setIsEditMode(false);
    },
    onError: () => toast.error("Failed to delete document")
  });
  const openDetailModal = (memo) => {
    setDetailMemo(memo);
    setEditRemarks(memo.complianceRemarks || "");
    setIsEditMode(false);
    setReplaceFile(null);
  };
  const closeDetailModal = () => {
    setDetailMemo(null);
    setIsEditMode(false);
    setEditRemarks("");
    setReplaceFile(null);
  };
  const handleViewCompliance = async (memo) => {
    try {
      const res = await downloadComplianceDocument(memo._id);
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      setPreviewDoc({ url, name: memo.complianceDocumentName || "Compliance Document", blob });
    } catch {
      toast.error("Failed to load document");
    }
  };
  const isDocxFile = (name) => /\.(docx?|DOC|DOCX)$/i.test(name);
  useEffect(() => {
    if (modalDocxRef.current && previewDoc?.blob && isDocxFile(previewDoc.name)) {
      modalDocxRef.current.innerHTML = "";
      renderAsync(previewDoc.blob, modalDocxRef.current, void 0, {
        className: "compliance-docx-preview",
        inWrapper: false,
        ignoreWidth: true,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false
      }).then(() => {
        if (modalDocxRef.current) {
          modalDocxRef.current.querySelectorAll("*").forEach((el) => {
            const s = el.style;
            s.width = "";
            s.minWidth = "";
            s.maxWidth = "";
            s.height = "";
            s.minHeight = "";
            s.maxHeight = "";
          });
          modalDocxRef.current.querySelectorAll("section").forEach((sec) => {
            const s = sec.style;
            s.padding = "0";
            s.margin = "0";
            s.height = "auto";
            s.minHeight = "0";
          });
        }
      }).catch(() => {
      });
    }
  }, [previewDoc]);
  const memos = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);
  return <div>{
    /* Official header */
  }<div className="bg-[#003366] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b-2 border-[#B8860B]"><h1 className="text-sm font-bold text-white uppercase tracking-wider">Memos & Compliance Register</h1><p className="text-[11px] text-neutral-400 mt-0.5">Hyderabad City Police — Commissioner's Task Force</p></div>{
    /* Status filter bar */
  }<div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-4"><span className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider mr-1">Status:</span>{STATUS_TABS.map((tab) => {
    const isActive = statusFilter === tab.key;
    const count = getTabCount(tab.key);
    return <button
      key={tab.key}
      onClick={() => {
        setStatusFilter(tab.key);
        setPage(1);
        if (tab.key !== "__COMPLIANCE__") setComplianceSubFilter("");
      }}
      className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider border transition-all ${isActive ? "bg-[#003366] text-white border-[#003366]" : "bg-white text-[#4A5568] border-[#D9DEE4] hover:bg-[#F4F5F7] hover:border-[#003366]/30"}`}
    >{tab.label}<span className={`ml-1.5 text-[10px] px-1.5 py-0.5 font-bold rounded-sm ${isActive ? "bg-white/20 text-white" : "bg-[#718096] text-white"}`}>{count}</span></button>;
  })}</div>{
    /* Zone / PS / Sector / Date filters */
  }<div className="flex items-center gap-2.5 mb-5 flex-wrap"><FilterDropdown
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
  /><div className="w-px h-6 bg-[#D9DEE4] mx-1" /><div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all"><Calendar size={13} className="flex-shrink-0 opacity-50" /><input
    type="date"
    value={filterDateFrom}
    onChange={(e) => {
      setFilterDateFrom(e.target.value);
      setPage(1);
    }}
    className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[100px] sm:w-[115px]"
  /></div><span className="text-[11px] text-[#718096] font-semibold">to</span><div className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(0,51,102,0.1)] border border-[#003366]/10 text-[#003366] pl-3 pr-2.5 py-[7px] rounded-lg hover:shadow-[0_2px_6px_rgba(0,51,102,0.15)] hover:border-[#003366]/20 transition-all"><Calendar size={13} className="flex-shrink-0 opacity-50" /><input
    type="date"
    value={filterDateTo}
    onChange={(e) => {
      setFilterDateTo(e.target.value);
      setPage(1);
    }}
    className="text-[12px] font-semibold bg-transparent focus:outline-none cursor-pointer text-[#1C2334] w-[100px] sm:w-[115px]"
  /></div>{hasActiveFilters && <button
    onClick={clearFilters}
    className="inline-flex items-center gap-1.5 bg-white shadow-[0_1px_3px_rgba(155,44,44,0.12)] border border-[#9B2C2C]/15 text-[#9B2C2C] pl-2.5 pr-3 py-[7px] rounded-lg text-[12px] font-semibold hover:bg-[#9B2C2C]/5 hover:shadow-[0_2px_6px_rgba(155,44,44,0.18)] transition-all"
  ><RotateCcw size={12} />
            Clear All
          </button>}</div>{
    /* Compliance sub-filter */
  }{isComplianceTab && <div className="flex items-center gap-2 mb-4"><span className="text-[11px] font-bold text-[#4A5568] uppercase tracking-wider mr-1">Show:</span>{[
    { key: "", label: "All" },
    { key: "AWAITING_REPLY", label: "Awaiting Reply" },
    { key: "COMPLIED", label: "Complied" }
  ].map((sf) => <button
    key={sf.key}
    onClick={() => {
      setComplianceSubFilter(sf.key);
      setPage(1);
    }}
    className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border transition-all ${complianceSubFilter === sf.key ? "bg-[#003366] text-white border-[#003366]" : "bg-white text-[#4A5568] border-[#D9DEE4] hover:bg-[#F4F5F7] hover:border-[#003366]/30"}`}
  >{sf.label}{countsData && sf.key === "" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 font-bold rounded-sm bg-white/20">{countsData["__COMPLIANCE__"] || 0}</span>}{countsData && sf.key === "AWAITING_REPLY" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 font-bold rounded-sm bg-white/20">{countsData["compliance_AWAITING_REPLY"] || 0}</span>}{countsData && sf.key === "COMPLIED" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 font-bold rounded-sm bg-white/20">{countsData["compliance_COMPLIED"] || 0}</span>}</button>)}</div>}{
    /* Table */
  }<div className="border border-slate-300 bg-white"><div className="overflow-x-auto"><table className="w-full text-[13px] table-fixed min-w-[800px]"><thead><tr className="bg-[#003366] text-white text-left"><th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[50px] text-center">S.No</th>{!isComplianceTab && <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[100px]">Status</th>}<th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[100px]">Date</th><th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[18%]">Zone / PS</th><th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[90px]">Cr. No</th><th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[18%]">Sections</th><th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[15%]">Issued To</th>{isComplianceTab && <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[160px]">Status</th>}{!isComplianceTab && <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-wider w-[13%]">Generated By</th>}<th className={`px-4 py-3 font-bold text-[11px] uppercase tracking-wider text-center ${isComplianceTab ? "w-[140px]" : "w-[80px]"}`}>Actions</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={isComplianceTab ? 8 : 9} className="px-4 py-12 text-center text-slate-400 font-medium">Loading records…</td></tr> : memos.length === 0 ? <tr><td colSpan={isComplianceTab ? 8 : 9} className="px-4 py-16 text-center"><FileText size={32} className="mx-auto text-slate-300 mb-2" /><p className="text-[13px] font-semibold text-slate-500">{isComplianceTab ? "No compliance records found" : "No memos found"}</p><p className="text-[12px] text-slate-400 mt-0.5">{isComplianceTab ? "Approved memos will appear here for compliance tracking." : "Generate a memo from a DSR case to get started."}</p></td></tr> : memos.map((memo, idx) => {
    const cfg = STATUS_CONFIG[memo.status];
    const generatedBy = typeof memo.generatedBy === "object" ? memo.generatedBy : null;
    const sNo = (page - 1) * 20 + idx + 1;
    const displayComplianceStatus = memo.complianceStatus || "AWAITING_REPLY";
    return <React.Fragment key={memo._id}><tr
      onClick={() => navigate(`/memos/${memo._id}`, { state: { fromTab: statusFilter, fromSubFilter: complianceSubFilter } })}
      className={`border-b border-slate-200 cursor-pointer transition-colors hover:bg-blue-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
    ><td className="px-4 py-3 font-bold text-slate-500 text-center">{sNo}</td>{!isComplianceTab && <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-[11px] font-bold tracking-wider ${cfg.bg} ${cfg.text}`}>{cfg.label}</span></td>}<td className="px-4 py-3 text-slate-700 font-medium tabular-nums">{format(new Date(memo.date), "dd-MM-yyyy")}</td><td className="px-4 py-3"><div className="font-bold text-slate-800">{memo.zone ? `${memo.zone} Zone` : "\u2014"}</div><div className="text-[11px] text-slate-500 mt-0.5">{memo.policeStation || "\u2014"} PS</div></td><td className="px-4 py-3 font-mono font-bold text-slate-700">{memo.crimeNo || "\u2014"}</td><td className="px-4 py-3 text-slate-600 max-w-[180px]"><span className="line-clamp-2 text-[12px]" title={memo.sections ? `u/s ${memo.sections}` : ""}>{memo.sections ? `u/s ${memo.sections}` : "\u2014"}</span></td><td className="px-4 py-3">{memo.recipientName ? <div><div className="font-semibold text-slate-700">{memo.recipientName}</div><div className="text-[11px] text-slate-400">{memo.recipientDesignation || memo.recipientType || ""}</div></div> : <span className="text-slate-400">—</span>}</td>{isComplianceTab && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>{displayComplianceStatus === "COMPLIED" ? <div><span className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider bg-emerald-700 text-white">COMPLIED</span>{memo.compliedAt && <div className="text-[10px] text-slate-400 mt-0.5">{format(new Date(memo.compliedAt), "dd-MM-yyyy")}</div>}</div> : <div className="relative inline-block"><select
      value={displayComplianceStatus}
      onChange={(e) => {
        if (e.target.value === "COMPLIED") {
          setComplianceModal(memo);
        }
      }}
      className="appearance-none bg-orange-50 border border-orange-300 text-orange-800 text-[11px] font-bold uppercase tracking-wider pl-2.5 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-orange-500 hover:bg-orange-100 transition-colors"
    ><option value="AWAITING_REPLY">Awaiting Reply</option><option value="COMPLIED">Complied</option></select><ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-600 pointer-events-none" /></div>}</td>}{!isComplianceTab && <td className="px-4 py-3">{generatedBy ? <div><div className="font-medium text-slate-700 text-[12px]">{generatedBy.name}</div><div className="text-[11px] text-slate-400">{generatedBy.rank}</div></div> : <span className="text-slate-400">—</span>}</td>}<td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">{isComplianceTab ? <><button
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/memos/${memo._id}`, { state: { fromTab: statusFilter, fromSubFilter: complianceSubFilter } });
      }}
      className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
      title="View Memo"
    ><Eye size={15} /></button>{displayComplianceStatus === "COMPLIED" && memo.complianceDocumentPath && <button
      onClick={(e) => {
        e.stopPropagation();
        handleViewCompliance(memo);
      }}
      className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
      title="View Document"
    ><FileText size={15} /></button>}{displayComplianceStatus === "COMPLIED" && memo.complianceRemarks && <button
      onClick={(e) => {
        e.stopPropagation();
        openDetailModal(memo);
      }}
      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
      title="View Remarks"
    ><MessageSquareText size={15} /></button>}{displayComplianceStatus === "COMPLIED" && <button
      onClick={(e) => {
        e.stopPropagation();
        setDetailMemo(memo);
        setEditRemarks(memo.complianceRemarks || "");
        setIsEditMode(true);
        setReplaceFile(null);
      }}
      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
      title="Edit Compliance"
    ><Pencil size={14} /></button>}</> : <><button
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/memos/${memo._id}`, { state: { fromTab: statusFilter, fromSubFilter: complianceSubFilter } });
      }}
      className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
      title="View / Edit"
    ><Eye size={15} /></button>{memo.status === "DRAFT" && <button
      onClick={(e) => {
        e.stopPropagation();
        setDeleteItem(memo);
      }}
      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
      title="Delete"
    ><Trash2 size={15} /></button>}</>}</div></td></tr></React.Fragment>;
  })}</tbody></table></div></div>{
    /* Pagination */
  }{totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200"><span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
            Page {page} of {totalPages}</span><div className="flex items-center gap-2"><button
    disabled={page <= 1}
    onClick={() => setPage(page - 1)}
    className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
  ><ChevronLeft size={13} /> Prev
            </button><button
    disabled={page >= totalPages}
    onClick={() => setPage(page + 1)}
    className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-[12px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
  >
              Next <ChevronRight size={13} /></button></div></div>}{
    /* Delete confirmation */
  }{deleteItem && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteItem(null)}><div className="bg-white border border-slate-300 shadow-xl w-[95vw] max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}><div className="mx-auto w-12 h-12 bg-red-100 flex items-center justify-center mb-4"><Trash2 className="text-red-700" size={22} /></div><h3 className="text-[16px] font-bold text-slate-900 mb-1">Delete Memo?</h3><p className="text-[13px] text-slate-500 mb-5">This action is permanent and cannot be undone.</p><div className="flex gap-3"><button onClick={() => setDeleteItem(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">Cancel</button><button onClick={() => deleteMutation.mutate(deleteItem._id)} disabled={deleteMutation.isPending} className="flex-1 bg-red-700 text-white py-2 text-[13px] font-bold uppercase tracking-wider hover:bg-red-800 disabled:opacity-50 transition-colors">{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}</button></div></div></div>}{
    /* Compliance modal */
  }{complianceModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
    setComplianceModal(null);
    setComplianceRemarks("");
    setComplianceFile(null);
  }}><div className="bg-white border border-slate-300 shadow-xl w-[95vw] max-w-lg" onClick={(e) => e.stopPropagation()}><div className="bg-[#003366] px-5 py-3 flex items-center justify-between"><h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Compliance Response</h3><button onClick={() => {
    setComplianceModal(null);
    setComplianceRemarks("");
    setComplianceFile(null);
  }} className="text-white/50 hover:text-white transition"><X size={18} /></button></div><div className="p-5 space-y-4">{
    /* Memo info */
  }<div className="bg-slate-50 border border-slate-200 p-3 text-[12px] space-y-1"><p><span className="text-slate-400">Zone / PS:</span> <span className="font-bold text-slate-700">{complianceModal.zone ? `${complianceModal.zone} Zone` : "\u2014"} — {complianceModal.policeStation || "\u2014"} PS</span></p><p><span className="text-slate-400">Cr. No:</span> <span className="font-bold text-slate-700">{complianceModal.crimeNo || "\u2014"}</span></p><p><span className="text-slate-400">Issued To:</span> <span className="font-bold text-slate-700">{complianceModal.recipientName || "\u2014"} {complianceModal.recipientDesignation ? `(${complianceModal.recipientDesignation})` : ""}</span></p></div>{
    /* Remarks */
  }<div><label className="block text-[11px] font-bold text-[#4A5568] uppercase tracking-wider mb-1.5">Compliance Remarks</label><textarea
    value={complianceRemarks}
    onChange={(e) => setComplianceRemarks(e.target.value)}
    rows={4}
    className="w-full border border-slate-300 px-3 py-2 text-[13px] focus:outline-none focus:border-[#003366] resize-none"
    placeholder="Enter compliance response from officer..."
  /></div>{
    /* File upload */
  }<div><label className="block text-[11px] font-bold text-[#4A5568] uppercase tracking-wider mb-1.5">Upload Document (PDF / Word)</label><div className="border border-dashed border-slate-300 p-4 text-center bg-slate-50"><input
    type="file"
    accept=".pdf,.doc,.docx"
    onChange={(e) => setComplianceFile(e.target.files?.[0] || null)}
    className="text-[12px] text-slate-600"
  /></div>{complianceFile && <div className="flex items-center gap-2 mt-2 text-[12px]"><span className="text-slate-600 font-medium">{complianceFile.name}</span><button onClick={() => setComplianceFile(null)} className="text-red-500 hover:text-red-700 transition"><X size={14} /></button></div>}</div>{
    /* Actions */
  }<div className="flex gap-3 pt-2"><button
    onClick={() => {
      setComplianceModal(null);
      setComplianceRemarks("");
      setComplianceFile(null);
    }}
    className="flex-1 border border-slate-300 text-slate-700 py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
  >
                  Cancel
                </button><button
    onClick={() => {
      const formData = new FormData();
      if (complianceRemarks.trim()) formData.append("complianceRemarks", complianceRemarks.trim());
      if (complianceFile) formData.append("complianceDocument", complianceFile);
      complyMutation.mutate({ id: complianceModal._id, formData });
    }}
    disabled={!complianceRemarks.trim() && !complianceFile || complyMutation.isPending}
    className="flex-1 bg-[#1B6B46] text-white py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-[#155A38] disabled:opacity-50 transition-colors"
  >{complyMutation.isPending ? "Submitting\u2026" : "Mark as Complied"}</button></div></div></div></div>}{
    /* Compliance detail modal */
  }{detailMemo && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDetailModal}><div className="bg-white border border-slate-300 shadow-xl w-[95vw] max-w-lg" onClick={(e) => e.stopPropagation()}><div className="bg-[#003366] px-5 py-3 flex items-center justify-between"><h3 className="text-sm font-bold text-white uppercase tracking-wider">Compliance Details</h3><div className="flex items-center gap-2">{!isEditMode && <button
    onClick={() => setIsEditMode(true)}
    className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20 hover:bg-white/20 rounded-sm transition"
  ><Pencil size={11} /> Edit
                  </button>}<button onClick={closeDetailModal} className="text-white/50 hover:text-white transition"><X size={18} /></button></div></div><div className="p-5 space-y-4">{
    /* Remarks */
  }<div><span className="text-[11px] font-bold text-[#4A5568] uppercase tracking-wider block mb-1.5">Compliance Remarks</span>{isEditMode ? <textarea
    value={editRemarks}
    onChange={(e) => setEditRemarks(e.target.value)}
    rows={4}
    className="w-full border border-slate-300 px-3 py-2 text-[13px] focus:outline-none focus:border-[#003366] resize-none"
    placeholder="Enter compliance remarks..."
  /> : <p className="text-[13px] text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2.5 min-h-[60px]">{detailMemo.complianceRemarks || <span className="text-slate-300 italic">No remarks entered</span>}</p>}</div>{
    /* Document */
  }<div><span className="text-[11px] font-bold text-[#4A5568] uppercase tracking-wider block mb-1.5">Document</span>{isEditMode ? <div>{detailMemo.complianceDocumentPath && !replaceFile && <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 flex items-center gap-2"><FileText size={16} className="text-blue-600 flex-shrink-0" /><span className="text-[12px] text-slate-700 font-medium truncate flex-1" title={detailMemo.complianceDocumentName}>{detailMemo.complianceDocumentName || "Document"}</span><button
    onClick={() => deleteDocMutation.mutate(detailMemo._id)}
    disabled={deleteDocMutation.isPending}
    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-sm transition disabled:opacity-50"
  ><Trash2 size={11} /> Remove
                        </button></div>}{(!detailMemo.complianceDocumentPath || replaceFile) && <div className="border border-dashed border-slate-300 px-3 py-3 text-center bg-slate-50">{replaceFile ? <div className="flex items-center gap-2 justify-center"><FileText size={14} className="text-slate-400 flex-shrink-0" /><span className="text-[12px] text-slate-600 font-medium truncate">{replaceFile.name}</span><button onClick={() => setReplaceFile(null)} className="text-red-400 hover:text-red-600 transition"><X size={14} /></button></div> : <label className="cursor-pointer text-[12px] text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"><Upload size={13} />{detailMemo.complianceDocumentPath ? "Upload Replacement" : "Upload Document"}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} /></label>}</div>}</div> : detailMemo.complianceDocumentPath ? <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 flex items-center gap-2"><FileText size={16} className="text-blue-600 flex-shrink-0" /><span className="text-[12px] text-slate-700 font-medium truncate flex-1">{detailMemo.complianceDocumentName || "Document"}</span><button
    onClick={() => handleViewCompliance(detailMemo)}
    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-sm transition"
  ><Eye size={11} /> Preview
                    </button></div> : <p className="text-[12px] text-slate-300 italic bg-slate-50 border border-slate-200 px-3 py-2.5">No document attached</p>}</div>{
    /* Edit mode actions */
  }{isEditMode && <div className="flex gap-3 pt-2"><button
    onClick={closeDetailModal}
    className="flex-1 border border-slate-300 text-slate-700 py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
  >
                    Cancel
                  </button><button
    onClick={() => {
      const formData = new FormData();
      if (editRemarks.trim() !== (detailMemo.complianceRemarks || "")) {
        formData.append("complianceRemarks", editRemarks.trim());
      }
      if (replaceFile) {
        formData.append("complianceDocument", replaceFile);
      }
      updateComplianceMutation.mutate({ id: detailMemo._id, formData });
    }}
    disabled={updateComplianceMutation.isPending}
    className="flex-1 bg-[#003366] text-white py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-[#004480] disabled:opacity-50 transition-colors"
  >{updateComplianceMutation.isPending ? "Saving\u2026" : "Save Changes"}</button></div>}</div></div></div>}{
    /* Document preview modal */
  }{previewDoc && <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => {
    window.URL.revokeObjectURL(previewDoc.url);
    setPreviewDoc(null);
  }}><div className="bg-white border border-slate-300 shadow-2xl w-[95vw] max-w-7xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}><div className="bg-[#003366] px-5 py-3 flex items-center justify-between flex-shrink-0"><h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">{previewDoc.name}</h3><div className="flex items-center gap-2"><a
    href={previewDoc.url}
    download={previewDoc.name}
    className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20 hover:bg-white/20 rounded-sm transition"
    onClick={(e) => e.stopPropagation()}
  ><Download size={12} />
                  Download
                </a><button onClick={() => {
    window.URL.revokeObjectURL(previewDoc.url);
    setPreviewDoc(null);
  }} className="text-white/50 hover:text-white transition"><X size={18} /></button></div></div><div className="flex-1 min-h-0">{previewDoc.name.toLowerCase().endsWith(".pdf") ? <iframe src={previewDoc.url} className="w-full h-full border-0" title="Compliance Document Preview" /> : isDocxFile(previewDoc.name) ? <div ref={modalDocxRef} className="w-full h-full overflow-auto bg-white" style={{ scrollbarWidth: "thin", scrollbarColor: "#c1c7cf transparent" }} /> : <div className="flex flex-col items-center justify-center h-full text-center p-8"><FileText size={48} className="text-slate-300 mb-4" /><p className="text-[14px] font-semibold text-slate-600 mb-1">{previewDoc.name}</p><p className="text-[12px] text-slate-400 mb-4">Preview is not available for this file type.</p><a
    href={previewDoc.url}
    download={previewDoc.name}
    className="px-4 py-2 bg-[#003366] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#004480] rounded-sm transition"
  ><Download size={13} className="inline mr-1.5" />
                    Download File
                  </a></div>}</div></div></div>}</div>;
};
export default MemoList;

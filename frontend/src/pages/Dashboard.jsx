import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDashboardAnalytics } from "../services/endpoints";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList
} from "recharts";
const VICE_CATEGORIES = ["Peta", "Gambling", "Food Adulteration", "Cross Message", "Hookah Centers", "Narcotics", "Others"];
const VICE_COLORS = ["#1e40af", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#94a3b8"];
const ZONE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#64748b", "#7c3aed", "#db2777", "#0891b2"];
const ALL_ZONES = ["Charminar Zone", "Golkonda Zone", "Jubilee Hills Zone", "Khairthabad Zone", "Rajendranagar Zone", "Secundrabad Zone", "Shamshabad Zone"];
const ROLE_COLORS = { SHO: "#003366", SI: "#d97706", UNASSIGNED: "#94a3b8" };
const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";

  const updateRange = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next.from) params.set("from", next.from); else params.delete("from");
    if (next.to) params.set("to", next.to); else params.delete("to");
    setSearchParams(params, { replace: true });
  };

  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const fmt = (d) => d.toISOString().slice(0, 10);
    updateRange({ from: fmt(start), to: fmt(end) });
  };

  // Build /memos URL preserving date range + extra filter params
  const goToMemos = (extraParams = {}, basePath = "/memos") => {
    const qp = new URLSearchParams();
    if (dateFrom) qp.set("from", dateFrom);
    if (dateTo) qp.set("to", dateTo);
    for (const [k, v] of Object.entries(extraParams)) {
      if (v !== undefined && v !== null && v !== "") qp.set(k, v);
    }
    const qs = qp.toString();
    navigate(qs ? `${basePath}?${qs}` : basePath);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dashboard-analytics", dateFrom, dateTo],
    queryFn: async () => {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await getDashboardAnalytics(params);
      return res.data.data;
    },
    keepPreviousData: true,
  });
  const kpi = data?.kpi || {
    totalMemos: 0,
    pendingReview: 0,
    approved: 0,
    complied: 0,
    awaiting: 0,
    chargeMemoDue: 0,
    drafts: 0,
    rejected: 0
  };
  const complianceRate = kpi.approved > 0 ? (kpi.complied / kpi.approved * 100).toFixed(1) : "0.0";
  const viceData = useMemo(() => {
    const apiList = data?.socialViceBreakdown || [];
    const map = new Map(apiList.map((v) => [v.category, v.memos]));
    const list = VICE_CATEGORIES.map((cat) => ({ category: cat, memos: map.get(cat) || 0 })).sort((a, b) => b.memos - a.memos);
    const max = list.reduce((m, x) => Math.max(m, x.memos), 0) || 1;
    const total = list.reduce((s, x) => s + x.memos, 0);
    return { list, max, total, topCategory: list[0]?.memos > 0 ? list[0] : void 0 };
  }, [data]);
  const zoneData = useMemo(() => {
    const apiList = data?.zoneBreakdown || [];
    const map = new Map(apiList.map((z) => [z.zone, z]));
    const list = ALL_ZONES.map((z) => ({ zone: z, memos: map.get(z)?.memos || 0, complied: map.get(z)?.complied || 0, awaiting: map.get(z)?.awaiting || 0 })).sort((a, b) => b.memos - a.memos);
    const max = list.reduce((m, x) => Math.max(m, x.memos), 0) || 1;
    return { list, max };
  }, [data]);
  const roleData = useMemo(() => {
    const list = data?.roleBreakdown || [];
    const total = list.reduce((s, r) => s + r.count, 0) || 1;
    const ROLE_ORDER = { SHO: 0, SI: 1, UNASSIGNED: 2 };
    return list.map((r) => ({
      role: r.role,
      count: r.count,
      pct: Math.round(r.count / total * 100),
      label: r.role === "SHO" ? "SHO (Station House Officer)" : r.role === "SI" ? "Sector SI (Sub-Inspector)" : r.role,
      color: ROLE_COLORS[r.role] || "#94a3b8"
    })).sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
  }, [data]);
  const donutData = useMemo(() => {
    const c = kpi.complied || 0;
    const p = kpi.awaiting || 0;
    if (c + p === 0) return [{ name: "No data", value: 1, color: "#e2e8f0" }];
    return [
      { name: "Complied", value: c, color: "#16a34a" },
      { name: "Pending", value: p, color: "#d97706" }
    ];
  }, [kpi.complied, kpi.awaiting]);
  const officers = data?.chargeMemoOfficers || [];
  return <div className="flex flex-col min-h-full"><div className="flex flex-col gap-3 flex-1"><DateRangeBar
    from={dateFrom}
    to={dateTo}
    onChange={updateRange}
    onPreset={setPreset}
    loading={isLoading || isFetching}
  />{
    /* ====== ROW 1: VICE + ZONE + ROLES (3 cols) ====== */
  }<div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-[minmax(320px,1fr)]">{
    /* Social Vice Category Distribution */
  }<SectionCard title="Social Vice Category Distribution">{viceData.list.length === 0 ? <EmptyState /> : <><div className="space-y-2.5">{viceData.list.map((v, i) => <HBar
    key={v.category}
    label={v.category}
    value={v.memos}
    max={viceData.max}
    color={VICE_COLORS[i % VICE_COLORS.length]}
    onClick={() => goToMemos({ vice: v.category })}
  />)}</div></>}</SectionCard>{
    /* Zone-wise Issued Memos */
  }<SectionCard title="Zone-wise Issued Memos">{zoneData.list.length === 0 ? <EmptyState /> : <div className="space-y-2.5">{zoneData.list.map((z, i) => <HBar
    key={z.zone}
    label={z.zone}
    value={z.memos}
    max={zoneData.max}
    color={ZONE_COLORS[i % ZONE_COLORS.length]}
    onClick={() => goToMemos({ zone: z.zone })}
  />)}</div>}</SectionCard>{
    /* Role-wise Memo Distribution */
  }<SectionCard title="Role-wise Memo Distribution">{roleData.length === 0 ? <EmptyState /> : <><ResponsiveContainer width="100%" height={220}><BarChart data={roleData} barSize={50}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis
    dataKey="role"
    tick={{ fontSize: 10, fill: "#64748b" }}
    axisLine={false}
    tickLine={false}
  /><YAxis
    tick={{ fontSize: 9, fill: "#94a3b8" }}
    axisLine={false}
    tickLine={false}
    width={30}
  /><Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} /><Bar dataKey="count" name="Memos" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => d?.role && goToMemos({ recipientType: d.role })}>{roleData.map((r) => <Cell key={r.role} fill={r.color} />)}<LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} /></Bar></BarChart></ResponsiveContainer><div className="flex items-center justify-center gap-4 mt-2">{roleData.map((r) => <div key={r.role} className="flex items-center gap-1.5 text-[9px] text-slate-500"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} /><span className="font-semibold">{r.label}</span></div>)}</div></>}</SectionCard></div>{
    /* ====== ROW 2: COMPLIANCE + CHARGE MEMOS (2 cols) ====== */
  }<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-2 auto-rows-[minmax(260px,auto)]">{
    /* Memo Compliance Status Tracking */
  }<SectionCard title="Memo Compliance Status Tracking"><div className="flex items-stretch min-h-[230px]">{
    /* Left: Donut section */
  }<div className="flex-1 flex flex-col"><div className="flex items-center flex-1">{
    /* Pending % left of donut */
  }<div className="flex flex-col items-center min-w-[48px]"><span className="text-[16px] font-extrabold text-amber-600 leading-none">{(100 - parseFloat(complianceRate)).toFixed(0)}%
                    </span><span className="text-[10px] font-semibold text-amber-500">({kpi.awaiting})</span></div>{
    /* Donut */
  }<div className="flex-1 min-w-[140px]"><ResponsiveContainer width="100%" height={160}><PieChart><Pie
    data={donutData}
    dataKey="value"
    cx="50%"
    cy="50%"
    innerRadius={45}
    outerRadius={68}
    paddingAngle={2}
    stroke="none"
    startAngle={90}
    endAngle={-270}
    cursor="pointer"
    onClick={(d) => {
      if (!d?.name) return;
      if (d.name === "Complied") goToMemos({ tab: "__COMPLIANCE__", compliance: "COMPLIED" });
      else if (d.name === "Pending") goToMemos({ tab: "__COMPLIANCE__", compliance: "AWAITING_REPLY" });
    }}
  >{donutData.map((d) => <Cell key={d.name} fill={d.color} />)}<Label
    content={() => <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"><tspan x="50%" dy="-5" fontSize="8" fill="#94a3b8" fontWeight="700">MEMO</tspan><tspan x="50%" dy="11" fontSize="8" fill="#94a3b8" fontWeight="700">COMPLIANCE</tspan></text>}
    position="center"
  /></Pie></PieChart></ResponsiveContainer></div>{
    /* Complied % right of donut */
  }<div className="flex flex-col items-center min-w-[48px]"><span className="text-[16px] font-extrabold text-emerald-600 leading-none">{parseFloat(complianceRate).toFixed(0)}%
                    </span><span className="text-[10px] font-semibold text-emerald-500">({kpi.complied})</span></div></div><div className="flex items-center justify-center gap-6 mt-1"><button onClick={() => goToMemos({ tab: "__COMPLIANCE__", compliance: "COMPLIED" })} className="flex items-center gap-1.5 text-[10px] hover:underline"><span className="w-3 h-3 rounded-full bg-green-600" /><span className="text-slate-700 font-bold uppercase">Complied</span></button><button onClick={() => goToMemos({ tab: "__COMPLIANCE__", compliance: "AWAITING_REPLY" })} className="flex items-center gap-1.5 text-[10px] hover:underline"><span className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-slate-700 font-bold uppercase">Pending</span></button></div></div>{
    /* Divider */
  }<div className="w-px bg-slate-200 mx-3 self-stretch" />{
    /* Right: Commissioner Review */
  }<div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4"><div className="w-10 h-10 rounded-full bg-[#003366]/10 flex items-center justify-center mb-3"><svg className="w-5 h-5 text-[#003366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Pending Commissioner Review & Approval
                </p><p className="text-[56px] font-extrabold text-[#003366] tabular-nums leading-none">{isLoading ? "-" : kpi.pendingReview}</p><div className="mt-4 flex items-center gap-4"><span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded">
                    High Priority
                  </span><button
    onClick={() => goToMemos({ tab: "PENDING_REVIEW" }, "/review")}
    className="text-[10px] font-bold text-[#003366] bg-[#003366]/10 hover:bg-[#003366]/20 px-3 py-1 rounded transition-colors"
  >
                    Review Now &rarr;
                  </button></div></div></div></SectionCard>{
    /* Charge Memo Analytics & Issuance */
  }<div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col"><div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 gap-2"><h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Charge Memo Analytics & Issuance
              </h3><span className="bg-[#003366] text-white text-[8px] font-bold px-2.5 py-1 rounded leading-tight text-center uppercase flex-shrink-0">
                Charge Memo Flag: &gt;3 Pending
              </span></div><div className="px-4 pb-3">{officers.length === 0 ? <EmptyState /> : <><div className="overflow-x-auto border border-slate-200 rounded mt-2"><table className="w-full text-[10px]"><thead><tr className="bg-slate-50"><th className="text-left py-2 px-3 font-bold text-slate-600 uppercase border-b border-slate-200">
                            Officer Name
                          </th><th className="text-left py-2 px-3 font-bold text-slate-600 uppercase border-b border-slate-200">
                            Designation
                          </th><th className="text-left py-2 px-3 font-bold text-slate-600 uppercase border-b border-slate-200">
                            Zone / PS
                          </th><th className="text-center py-2 px-3 font-bold text-slate-600 uppercase border-b border-slate-200">
                            Pending Memos
                          </th><th className="text-center py-2 px-3 font-bold text-slate-600 uppercase border-b border-slate-200">
                            Status
                          </th></tr></thead><tbody>{officers.map((o, idx) => <tr
    key={o.officerId}
    className={`border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
    onClick={() => navigate(o.officerId ? `/officers/${o.officerId}` : "/officer-tracker")}
  ><td className="py-2 px-3 font-semibold text-slate-800">{rankPrefix(o.rank)} {o.name || "-"}</td><td className="py-2 px-3 text-slate-600">{designationLabel(o.rank)}</td><td className="py-2 px-3 text-slate-600">{o.zone || "-"}{o.policeStation ? ` / ${o.policeStation}` : ""}</td><td className="py-2 px-3 text-center"><span className="inline-flex items-center gap-1.5"><span className="font-bold text-slate-800">{o.memoCount}</span><span
    className={`w-2 h-2 rounded-full ${o.memoCount >= 5 ? "bg-red-500" : "bg-amber-400"}`}
  /></span></td><td className="py-2 px-3 text-center"><span className={`text-[9px] font-bold px-2 py-0.5 rounded ${o.memoCount >= 5 ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"}`}>{o.memoCount >= 5 ? "Critical" : "Warning"}</span></td></tr>)}</tbody></table></div><p className="mt-2 text-[9px] text-slate-400 italic leading-relaxed">
                    * Officers with &gt;3 pending compliance issues are flagged for charge memo proceedings.
                  </p></>}</div></div></div></div></div>;
};
const DateRangeBar = ({ from, to, onChange, onPreset, loading }) => {
  const presets = [
    { label: "Today", days: 1 },
    { label: "7 Days", days: 7 },
    { label: "30 Days", days: 30 },
    { label: "90 Days", days: 90 },
    { label: "1 Year", days: 365 },
  ];
  const isActive = (days) => {
    if (!from || !to) return false;
    const start = new Date(from);
    const end = new Date(to);
    const diff = Math.round((end - start) / 86400000) + 1;
    const today = new Date().toISOString().slice(0, 10);
    return diff === days && to === today;
  };
  const fmtDisplay = (s) => {
    if (!s) return "";
    const d = new Date(s);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const summary = from && to
    ? `${fmtDisplay(from)} → ${fmtDisplay(to)}`
    : from
      ? `From ${fmtDisplay(from)}`
      : to
        ? `Until ${fmtDisplay(to)}`
        : "All time";
  return (
    <div className="bg-white border border-[#D9DEE4]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {/* Label + summary */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-[#003366]/10 border border-[#003366]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#003366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[10px] font-bold text-[#4A5568] uppercase tracking-wider">Date Range</span>
            <span className="text-[11px] font-semibold text-[#003366] truncate">{summary}</span>
          </div>
        </div>

        <span className="hidden md:block w-px h-7 bg-[#D9DEE4]" />

        {/* Date inputs */}
        <div className="flex items-center gap-2">
          <DateField
            label="From"
            value={from}
            max={to || undefined}
            onChange={(v) => onChange({ from: v, to })}
          />
          <span className="text-[#718096] text-[11px] font-bold">→</span>
          <DateField
            label="To"
            value={to}
            min={from || undefined}
            onChange={(v) => onChange({ from, to: v })}
          />
        </div>

        <span className="hidden md:block w-px h-7 bg-[#D9DEE4]" />

        {/* Presets — same style as Memos status tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {presets.map((p) => {
            const active = isActive(p.days);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onPreset(p.days)}
                className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider border transition-all ${
                  active
                    ? "bg-[#003366] text-white border-[#003366]"
                    : "bg-white text-[#4A5568] border-[#D9DEE4] hover:bg-[#F4F5F7] hover:border-[#003366]/30"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right: Clear + loading */}
        <div className="flex items-center gap-2 ml-auto">
          {loading && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#4A5568] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Updating
            </span>
          )}
          {(from || to) && (
            <button
              type="button"
              onClick={() => onChange({ from: "", to: "" })}
              className="px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider border bg-white text-red-700 border-red-200 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DateField = ({ label, value, min, max, onChange }) => (
  <label className="group flex items-center gap-2 px-2.5 py-1.5 bg-white border border-[#D9DEE4] hover:border-[#003366]/40 focus-within:border-[#003366] transition-colors cursor-pointer">
    <span className="text-[10px] font-bold text-[#4A5568] uppercase tracking-wider">{label}</span>
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-bold text-[#003366] bg-transparent border-0 outline-none p-0 cursor-pointer w-[120px]"
    />
  </label>
);

const SectionCard = ({
  title,
  badge,
  children
}) => <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col"><div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between"><h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{title}</h3>{badge !== undefined && <span className="bg-[#003366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[28px] text-center">{badge}</span>}</div><div className="px-3 py-3 flex-1 flex flex-col justify-center">{children}</div></div>;
const HBar = ({ label, value, max, color, onClick, title }) => {
  const pct = value / max * 100;
  const clickable = typeof onClick === "function" && value > 0;
  return <div
    className={`flex items-center gap-2 text-[12px] ${clickable ? "cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-0.5 rounded transition-colors" : ""}`}
    onClick={clickable ? onClick : undefined}
    title={title || (clickable ? `View memos: ${label}` : label)}
  ><span
    className="w-[120px] text-slate-700 font-semibold truncate flex-shrink-0"
  >{label}</span><div className="flex-1 h-[18px] bg-gray-100 rounded overflow-hidden"><div
    className="h-full rounded"
    style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
  /></div><span className="text-slate-900 font-bold tabular-nums w-[32px] text-right flex-shrink-0">{value}</span></div>;
};
const EmptyState = () => <div className="py-6 text-center"><p className="text-[11px] text-slate-400 font-medium">No data available</p></div>;
function rankPrefix(rank) {
  if (!rank) return "";
  const map = {
    INSPECTOR: "Insp.",
    CI: "Insp.",
    SI: "SI",
    WSI: "WSI",
    PSI: "PSI",
    ASI: "ASI",
    HEAD_CONSTABLE: "HC",
    CONSTABLE: "Const."
  };
  return map[rank] || rank;
}
function designationLabel(rank) {
  if (!rank) return "-";
  const map = {
    INSPECTOR: "Inspector",
    CI: "Inspector",
    SI: "Sub-Inspector",
    WSI: "Sub-Inspector",
    PSI: "Sub-Inspector",
    ASI: "Asst. Sub-Inspector",
    HEAD_CONSTABLE: "Head Constable",
    CONSTABLE: "Constable"
  };
  return map[rank] || rank;
}
export default Dashboard;

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { format } from "date-fns";
const VICE_CATEGORIES = ["Peta", "Gambling", "Food Adulteration", "Cross Message", "Hookah Centers", "Narcotics"];
const VICE_COLORS = ["#1e40af", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
const ZONE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#64748b", "#7c3aed", "#db2777", "#0891b2"];
const ALL_ZONES = ["Charminar Zone", "Golkonda Zone", "Jubilee Hills Zone", "Khairthabad Zone", "Rajendranagar Zone", "Secundrabad Zone", "Shamshabad Zone"];
const ROLE_COLORS = { SHO: "#003366", SI: "#d97706", UNASSIGNED: "#94a3b8" };
const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: async () => {
      const res = await getDashboardAnalytics();
      return res.data.data;
    }
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
    return { list, max, topCategory: list[0]?.memos > 0 ? list[0] : void 0 };
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
    return list.map((r) => ({
      role: r.role,
      count: r.count,
      pct: Math.round(r.count / total * 100),
      label: r.role === "SHO" ? "SHO (Station House Officer)" : r.role === "SI" ? "Sector SI (Sub-Inspector)" : r.role,
      color: ROLE_COLORS[r.role] || "#94a3b8"
    }));
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
  return <div className="flex flex-col -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 min-h-full bg-[#f0f2f5]">{
    /* ====== HEADER BAR ====== */
  }<div className="bg-[#003366] px-4 md:px-6 py-3 flex items-center justify-between flex-wrap gap-2"><div className="flex items-center gap-3"><div className="w-1 h-6 bg-[#d4a017] rounded" /><h1 className="text-[13px] font-bold text-white tracking-wide uppercase">
            Centralized Social Vice & Memo Analytics Platform
          </h1></div><div className="flex items-center gap-3"><span className="bg-white/10 text-white/80 text-[10px] font-medium px-3 py-1 rounded border border-white/20">{format(/* @__PURE__ */ new Date(), "MMM yyyy")}</span><span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span></div></div><div className="px-3 sm:px-4 md:px-6 py-3 flex flex-col gap-3">{
    /* ====== KPI ROW ====== */
  }<div className="grid grid-cols-2 md:grid-cols-4 gap-3"><KPICard
    label="Total Social Vice Cases:"
    value={kpi.totalMemos}
    sub={`${viceData.list.length} categories tracked`}
    isLoading={isLoading}
    icon={<span className="text-emerald-500 text-[10px] font-bold">&#9650;</span>}
  /><KPICard
    label="Total Memos Issued"
    value={kpi.approved}
    sub="across all zones"
    isLoading={isLoading}
    icon={<span className="text-red-500 text-[9px] font-medium">&#9660; 0.95%</span>}
  /><KPICard
    label="Pending Commissioner Approval"
    value={kpi.pendingReview}
    sub="awaiting review"
    isLoading={isLoading}
    onClick={() => navigate("/review")}
  /><KPICard
    label="Overall Compliance Rate"
    valueText={`${complianceRate}%`}
    sub={`${kpi.complied} of ${kpi.approved} complied`}
    isLoading={isLoading}
    valueColor="text-emerald-600"
  /></div>{
    /* ====== ROW 1: VICE + ZONE + ROLES (3 cols) ====== */
  }<div className="grid grid-cols-1 md:grid-cols-3 gap-3">{
    /* Social Vice Category Distribution */
  }<SectionCard title="Social Vice Category Distribution">{viceData.list.length === 0 ? <EmptyState /> : <><div className="space-y-2.5">{viceData.list.map((v, i) => <HBar
    key={v.category}
    label={v.category}
    value={v.memos}
    max={viceData.max}
    color={VICE_COLORS[i % VICE_COLORS.length]}
  />)}</div>{viceData.topCategory && <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[9px] font-bold flex-shrink-0">
                      i
                    </span>
                    Top Issue Category:{" "}<span className="font-bold text-slate-800">{viceData.topCategory.category} (
                      {(viceData.topCategory.memos / (kpi.totalMemos || 1) * 100).toFixed(1)}%)
                    </span></div>}</>}</SectionCard>{
    /* Zone-wise Issued Memos */
  }<SectionCard title="Zone-wise Issued Memos">{zoneData.list.length === 0 ? <EmptyState /> : <div className="space-y-2.5">{zoneData.list.map((z, i) => <HBar
    key={z.zone}
    label={z.zone}
    value={z.memos}
    max={zoneData.max}
    color={ZONE_COLORS[i % ZONE_COLORS.length]}
  />)}</div>}</SectionCard>{
    /* Role-wise Memo Distribution */
  }<SectionCard title="Role-wise Memo Distribution">{roleData.length === 0 ? <EmptyState /> : <><ResponsiveContainer width="100%" height={170}><BarChart data={roleData} barSize={50}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis
    dataKey="role"
    tick={{ fontSize: 10, fill: "#64748b" }}
    axisLine={false}
    tickLine={false}
  /><YAxis
    tick={{ fontSize: 9, fill: "#94a3b8" }}
    axisLine={false}
    tickLine={false}
    width={30}
  /><Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} /><Bar dataKey="count" name="Memos" radius={[4, 4, 0, 0]}>{roleData.map((r) => <Cell key={r.role} fill={r.color} />)}<LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} /></Bar></BarChart></ResponsiveContainer><div className="flex items-center justify-center gap-4 mt-2">{roleData.map((r) => <div key={r.role} className="flex items-center gap-1.5 text-[9px] text-slate-500"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} /><span className="font-semibold">{r.label}</span></div>)}</div></>}</SectionCard></div>{
    /* ====== ROW 2: COMPLIANCE + CHARGE MEMOS (2 cols) ====== */
  }<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-2">{
    /* Memo Compliance Status Tracking */
  }<SectionCard title="Memo Compliance Status Tracking"><div className="flex items-stretch min-h-[220px]">{
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
  >{donutData.map((d) => <Cell key={d.name} fill={d.color} />)}<Label
    content={() => <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"><tspan x="50%" dy="-5" fontSize="8" fill="#94a3b8" fontWeight="700">MEMO</tspan><tspan x="50%" dy="11" fontSize="8" fill="#94a3b8" fontWeight="700">COMPLIANCE</tspan></text>}
    position="center"
  /></Pie></PieChart></ResponsiveContainer></div>{
    /* Complied % right of donut */
  }<div className="flex flex-col items-center min-w-[48px]"><span className="text-[16px] font-extrabold text-emerald-600 leading-none">{parseFloat(complianceRate).toFixed(0)}%
                    </span><span className="text-[10px] font-semibold text-emerald-500">({kpi.complied})</span></div></div><div className="flex items-center justify-center gap-6 mt-1"><span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-3 rounded-full bg-green-600" /><span className="text-slate-700 font-bold uppercase">Complied</span></span><span className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-slate-700 font-bold uppercase">Pending</span></span></div></div>{
    /* Divider */
  }<div className="w-px bg-slate-200 mx-3 self-stretch" />{
    /* Right: Commissioner Review */
  }<div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4"><div className="w-10 h-10 rounded-full bg-[#003366]/10 flex items-center justify-center mb-3"><svg className="w-5 h-5 text-[#003366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Pending Commissioner Review & Approval
                </p><p className="text-[56px] font-extrabold text-[#003366] tabular-nums leading-none">{isLoading ? "-" : kpi.pendingReview}</p><div className="mt-4 flex items-center gap-4"><span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded">
                    High Priority
                  </span><button
    onClick={() => navigate("/review")}
    className="text-[10px] font-bold text-[#003366] bg-[#003366]/10 hover:bg-[#003366]/20 px-3 py-1 rounded transition-colors"
  >
                    Review Now &rarr;
                  </button></div></div></div></SectionCard>{
    /* Charge Memo Analytics & Issuance */
  }<div className="bg-white rounded-lg border border-slate-200 overflow-hidden"><div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 gap-2"><h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
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
    onClick={() => navigate("/officer-tracker")}
  ><td className="py-2 px-3 font-semibold text-slate-800">{rankPrefix(o.rank)} {o.name || "-"}</td><td className="py-2 px-3 text-slate-600">{designationLabel(o.rank)}</td><td className="py-2 px-3 text-slate-600">{o.zone || "-"}{o.policeStation ? ` / ${o.policeStation}` : ""}</td><td className="py-2 px-3 text-center"><span className="inline-flex items-center gap-1.5"><span className="font-bold text-slate-800">{o.memoCount}</span><span
    className={`w-2 h-2 rounded-full ${o.memoCount >= 5 ? "bg-red-500" : "bg-amber-400"}`}
  /></span></td><td className="py-2 px-3 text-center"><span className={`text-[9px] font-bold px-2 py-0.5 rounded ${o.memoCount >= 5 ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"}`}>{o.memoCount >= 5 ? "Critical" : "Warning"}</span></td></tr>)}</tbody></table></div><p className="mt-2 text-[9px] text-slate-400 italic leading-relaxed">
                    * Officers with &gt;3 pending compliance issues are flagged for charge memo proceedings.
                  </p></>}</div></div></div></div></div>;
};
const KPICard = ({ label, value, valueText, sub, isLoading, onClick, icon, valueColor }) => <div
  onClick={onClick}
  className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""} transition-all`}
><div className="h-[3px] bg-[#d4a017]" /><div className="px-3 py-2.5"><p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p><div className="flex items-baseline gap-2 mt-1"><p className={`text-[26px] font-extrabold tabular-nums leading-tight ${valueColor || "text-[#003366]"}`}>{isLoading ? "-" : valueText || (value?.toLocaleString() ?? "0")}</p>{icon && <span className="flex-shrink-0">{icon}</span>}</div><p className="text-[10px] text-slate-400 mt-0.5">{sub}</p></div></div>;
const SectionCard = ({
  title,
  children
}) => <div className="bg-white rounded-lg border border-slate-200 overflow-hidden"><div className="px-3 py-2 border-b border-slate-100"><h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{title}</h3></div><div className="px-3 py-3">{children}</div></div>;
const HBar = ({ label, value, max, color }) => {
  const pct = value / max * 100;
  return <div className="flex items-center gap-2 text-[11px]"><span
    className="w-[120px] text-slate-700 font-semibold truncate flex-shrink-0"
    title={label}
  >{label}</span><div className="flex-1 h-[14px] bg-gray-100 rounded overflow-hidden"><div
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

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOfficer } from "../services/endpoints";
import StatusBadge from "../components/StatusBadge";
const OfficerDetail = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["officer", id],
    queryFn: async () => {
      const res = await getOfficer(id);
      return res.data.data;
    },
    enabled: !!id
  });
  if (isLoading) return <div className="text-slate-400 p-8">Loading…</div>;
  if (!data) return <div className="text-slate-400 p-8">Officer not found.</div>;
  const fields = [
    { label: "Badge Number", value: data.badgeNumber },
    { label: "Name", value: data.name },
    { label: "Rank", value: data.rank },
    { label: "Phone", value: data.phone },
    { label: "Email", value: data.email }
  ];
  return <div><div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500"><h1 className="text-sm font-bold text-white uppercase tracking-wider">Officer Details</h1><p className="text-[11px] text-blue-200 mt-0.5">{data.name} — {data.rank}</p></div><div className="bg-white border border-slate-200 max-w-2xl"><div className="bg-indigo-500 px-5 py-2.5 flex items-center gap-3"><div className="w-9 h-9 bg-white/20 flex items-center justify-center text-white font-bold text-sm">{data.name.charAt(0)}</div><div><h2 className="text-sm font-bold text-white">{data.name}</h2><StatusBadge status={data.isActive ? "ACTIVE" : "INACTIVE"} /></div></div><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">{fields.map((f) => <div key={f.label}><dt className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</dt><dd className="font-semibold text-slate-800 mt-0.5">{f.value || "\u2014"}</dd></div>)}</dl></div></div>;
};
export default OfficerDetail;

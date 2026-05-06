import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Eye, ShieldCheck, Clock, Inbox, MessageSquareText } from "lucide-react";
import api from "../services/api";
import ComplianceModal from "../components/memos/ComplianceModal";
import { designationLabel } from "../utils/formatters";
import { useSelector } from "react-redux";
import { format } from "date-fns";

const OfficerDashboard = () => {
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [viewMode, setViewMode] = useState("comply"); // "comply" | "view"
  const { user } = useSelector((s) => s.auth);

  const openComply = (memo) => {
    setViewMode("comply");
    setSelectedMemo(memo);
  };
  const openView = (memo) => {
    setViewMode("view");
    setSelectedMemo(memo);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-memos"],
    queryFn: async () => {
      const res = await api.get("/memos/my-memos");
      return res.data;
    }
  });

  const memos = data?.data || [];
  const pendingMemos = memos.filter((m) => m.complianceStatus !== "COMPLIED");
  const compliedMemos = memos.filter((m) => m.complianceStatus === "COMPLIED");

  return (
    <div>
      {/* Official header */}
      <div className="bg-[#003366] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b-2 border-[#B8860B] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">
            Personal Memo & Compliance Register
          </h1>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {user.name} — {designationLabel(user.rank)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            System Role
          </p>
          <p className="text-[12px] font-bold text-white tracking-wider">
            {user.systemRole}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard
          title="Total Memos"
          value={memos.length}
          icon={<Inbox size={16} />}
          accent="#003366"
        />
        <StatCard
          title="Pending Compliance"
          value={pendingMemos.length}
          icon={<Clock size={16} />}
          accent="#B8860B"
          urgent={pendingMemos.length >= 3}
        />
        <StatCard
          title="Complied"
          value={compliedMemos.length}
          icon={<ShieldCheck size={16} />}
          accent="#1B6B46"
        />
      </div>

      {/* Table */}
      <div className="border border-slate-300 bg-white">
        <div className="w-full">
          <table className="w-full text-[13px] table-auto">
            <thead>
              <tr className="bg-[#003366] text-white text-left">
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider text-center whitespace-nowrap">
                  S.No
                </th>
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider whitespace-nowrap">
                  Memo No / Date
                </th>
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider w-full">
                  Subject
                </th>
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider text-center whitespace-nowrap hidden md:table-cell">
                  Cr. No
                </th>
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider text-center whitespace-nowrap">
                  Status
                </th>
                <th className="px-2 sm:px-3 py-3 font-bold text-[11px] uppercase tracking-wider text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400 font-medium"
                  >
                    Loading records…
                  </td>
                </tr>
              ) : memos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[13px] font-semibold text-slate-500">
                      No memos issued
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      Memos addressed to you will appear here for compliance.
                    </p>
                  </td>
                </tr>
              ) : (
                memos.map((memo, idx) => (
                  <tr
                    key={memo._id}
                    className={`border-b border-slate-200 transition-colors hover:bg-blue-50/60 ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    <td className="px-2 sm:px-3 py-3 font-bold text-slate-500 text-center whitespace-nowrap">
                      {idx + 1}
                    </td>
                    <td className="px-2 sm:px-3 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-800 font-mono text-[12px]">
                        {memo.memoNumber || "PENDING"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {format(new Date(memo.date), "dd-MM-yyyy")}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-slate-700 min-w-0">
                      <p className="line-clamp-2 text-[12px] break-words" title={memo.subject}>
                        {memo.subject || "—"}
                      </p>
                      <p className="md:hidden text-[10px] text-slate-400 mt-0.5 font-mono">
                        {memo.crimeNo ? `Cr.No: ${memo.crimeNo}` : ""}
                      </p>
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-center font-mono font-bold text-slate-700 text-[12px] whitespace-nowrap hidden md:table-cell">
                      {memo.crimeNo || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                      <StatusBadge status={memo.complianceStatus} />
                    </td>
                    <td className="px-2 sm:px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openView(memo)}
                          title="View Issued Memo"
                          className="p-1.5 text-slate-400 hover:text-[#003366] hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {memo.complianceStatus === "COMPLIED" ? (
                          <button
                            onClick={() => openComply(memo)}
                            title="View / Edit Submitted Compliance"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <MessageSquareText size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => openComply(memo)}
                            title="Submit Compliance"
                            className="ml-1 inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border bg-[#003366] text-white border-[#003366] hover:bg-[#004480] transition-all"
                          >
                            Comply
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMemo && (
        <ComplianceModal
          memo={selectedMemo}
          onClose={() => setSelectedMemo(null)}
          onSuccess={() => {
            refetch();
            setSelectedMemo(null);
          }}
          isOfficer={true}
          viewOnly={viewMode === "view"}
        />
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, accent, urgent }) => {
  return (
    <div
      className="bg-white border border-slate-300 px-4 py-3 flex items-center justify-between"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div>
        <p className="text-[10px] font-bold text-[#4A5568] uppercase tracking-wider">
          {title}
        </p>
        <p
          className="text-2xl font-bold mt-1 leading-none tabular-nums"
          style={{ color: urgent ? "#9B2C2C" : "#1C2334" }}
        >
          {value}
        </p>
      </div>
      <div
        className="w-9 h-9 flex items-center justify-center"
        style={{ backgroundColor: `${accent}10`, color: accent }}
      >
        {icon}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  if (status === "COMPLIED") {
    return (
      <span className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider bg-emerald-700 text-white">
        COMPLIED
      </span>
    );
  }
  return (
    <span className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider bg-amber-600 text-white">
      AWAITING
    </span>
  );
};

export default OfficerDashboard;

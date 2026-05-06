import React from "react";

const SectionCard = ({ title, badge, children, className = "" }) => (
  <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col ${className}`}>
    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.05em]">{title}</h3>
      {badge !== undefined && (
        <span className="bg-[#003366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[28px] text-center">
          {badge}
        </span>
      )}
    </div>
    <div className="px-4 py-4 flex-1 flex flex-col justify-center">
      {children}
    </div>
  </div>
);

export default SectionCard;

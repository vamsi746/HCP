import React from "react";

const EmptyState = ({ message = "No data available" }) => (
  <div className="py-12 text-center flex flex-col items-center justify-center">
    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{message}</p>
  </div>
);

export default EmptyState;

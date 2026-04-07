import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDSR } from '../../services/endpoints';
import StatusBadge from '../../components/StatusBadge';
import type { DSR, ParsedCase } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, FileWarning, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';

const FORCE_LABELS: Record<string, string> = {
  TASK_FORCE: "Commissioner's Task Force",
  H_FAST: 'H-FAST',
  H_NEW: 'H-NEW',
};

const DSRDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dsr', id],
    queryFn: async () => {
      const res = await getDSR(id!);
      return res.data.data as DSR;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading DSR…</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400">DSR not found</div>;

  const dsr = data;
  const cases = dsr.parsedCases || [];
  const matchedCount = cases.filter((c) => c.matchedPSId).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/dsr')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            {FORCE_LABELS[dsr.forceType] || dsr.forceType}
          </h1>
          <p className="text-gray-500 text-sm">{format(new Date(dsr.date), 'dd MMMM yyyy')} &middot; {dsr.fileName || 'No file'}</p>
        </div>
        <StatusBadge status={dsr.processingStatus} />
      </div>

      {/* Summary Strip */}
      <div className="flex items-center gap-6 bg-white rounded-xl shadow px-6 py-4 mb-6 text-sm">
        <div>
          <span className="text-gray-400">Total Cases</span>
          <span className="ml-2 text-lg font-bold text-gray-800">{dsr.totalCases}</span>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div>
          <span className="text-gray-400">PS Matched</span>
          <span className="ml-2 text-lg font-bold text-green-600">{matchedCount}</span>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div>
          <span className="text-gray-400">Unmatched</span>
          <span className="ml-2 text-lg font-bold text-amber-600">{cases.length - matchedCount}</span>
        </div>
      </div>

      {/* Cases Table */}
      {cases.length > 0 ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-12">Sl.</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Crime Head</th>
                <th className="px-4 py-3">PS</th>
                <th className="px-4 py-3">Cr.No</th>
                <th className="px-4 py-3">Sections</th>
                <th className="px-4 py-3">Accused</th>
                <th className="px-4 py-3">Matched PS</th>
                <th className="px-4 py-3">Responsible SI</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cases.map((c) => {
                const matchedPS = typeof c.matchedPSId === 'object' ? c.matchedPSId : null;
                const matchedOfficer = typeof c.matchedOfficerId === 'object' ? c.matchedOfficerId : null;
                const isExpanded = expandedCase === c._id;

                return (
                  <React.Fragment key={c._id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => setExpandedCase(isExpanded ? null : c._id)}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-700">{c.slNo}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.zone || '—'}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium max-w-[180px] truncate" title={c.crimeHead}>{c.crimeHead || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.policeStation || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.crNo || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate text-xs" title={c.sections}>{c.sections || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.numAccused || 0}</td>
                      <td className="px-4 py-3">
                        {matchedPS ? (
                          <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle2 size={12} /> {matchedPS.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                            <AlertTriangle size={12} /> Unmatched
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {matchedOfficer ? (
                          <span className="text-xs text-blue-700 font-medium">{matchedOfficer.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <span className="block text-xs text-gray-400 mb-0.5">DOR</span>
                              <span className="text-gray-700">{c.dor || '—'}</span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-400 mb-0.5">No. of Cases</span>
                              <span className="text-gray-700">{c.numCases || 1}</span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-400 mb-0.5">Seized Worth</span>
                              <span className="text-gray-700">{c.seizedWorth || '—'}</span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-400 mb-0.5">Warning</span>
                              {c.warningGenerated ? (
                                <span className="text-green-600 font-medium text-xs">Generated</span>
                              ) : (
                                <span className="text-gray-400 text-xs">Not generated</span>
                              )}
                            </div>
                          </div>

                          {matchedOfficer && (
                            <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                              <span className="text-xs font-semibold text-blue-700">Responsible Officer:</span>{' '}
                              <span className="text-blue-800">{matchedOfficer.name}</span>
                              <span className="text-blue-600 ml-1">({matchedOfficer.rank})</span>
                              {matchedOfficer.phone && <span className="text-blue-600 ml-2">&middot; {matchedOfficer.phone}</span>}
                            </div>
                          )}

                          {c.accusedDetails && (
                            <div className="mb-2">
                              <span className="block text-xs text-gray-400 mb-0.5">Accused Details</span>
                              <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">{c.accusedDetails}</p>
                            </div>
                          )}

                          {c.briefFacts && (
                            <div className="mb-2">
                              <span className="block text-xs text-gray-400 mb-0.5">Brief Facts</span>
                              <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">{c.briefFacts}</p>
                            </div>
                          )}

                          {c.seizedProperty && (
                            <div className="mb-2">
                              <span className="block text-xs text-gray-400 mb-0.5">Seized Property</span>
                              <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                                {c.seizedProperty}
                                {c.seizedWorth && <span className="ml-1 font-semibold">({c.seizedWorth})</span>}
                              </p>
                            </div>
                          )}

                          {c.extractedLocations && c.extractedLocations.length > 0 && (
                            <div>
                              <span className="block text-xs text-gray-400 mb-1">Extracted Locations</span>
                              <div className="flex flex-wrap gap-1.5">
                                {c.extractedLocations.map((loc, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      loc.type === 'ps_reference' ? 'bg-blue-100 text-blue-700'
                                      : loc.type === 'residential' ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                    }`}
                                    title={loc.type}
                                  >
                                    {loc.rawText}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
          <FileWarning size={48} className="mx-auto mb-3 text-gray-300" />
          <p>No cases were extracted from this document.</p>
          <p className="text-sm mt-1">The document may be in an unsupported format or empty.</p>
        </div>
      )}
    </div>
  );
};

export default DSRDetail;

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGISData } from '../services/endpoints';
import type { PoliceStation } from '../types';

const GIS: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['gisData'],
    queryFn: async () => {
      const res = await getGISData();
      return res.data.data as PoliceStation[];
    },
  });

  if (isLoading) return <div className="text-slate-400">Loading…</div>;

  return (
    <div>
      <div className="bg-gradient-to-r from-[#1a2a4a] to-[#2d3e5f] -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 border-l-4 border-amber-500">
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">GIS — Police Stations</h1>
        <p className="text-[11px] text-blue-200">Geographic information system for station locations</p>
      </div>

      <div className="bg-white border border-slate-200 shadow p-6">
        <p className="text-sm text-slate-500 mb-4">
          Station locations listed below. Integrate with a map library (e.g. Leaflet) for visual display.
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Latitude</th>
              <th className="px-4 py-3">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((s) => (
                <tr key={s._id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 font-mono">{s.code}</td>
                  <td className="px-4 py-3">{s.latitude ?? '—'}</td>
                  <td className="px-4 py-3">{s.longitude ?? '—'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No stations found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default GIS;

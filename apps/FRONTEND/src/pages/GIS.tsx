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

  if (isLoading) return <div className="text-gray-400">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">GIS — Police Stations</h1>

      <div className="bg-white rounded-xl shadow p-6">
        <p className="text-sm text-gray-500 mb-4">
          Station locations listed below. Integrate with a map library (e.g. Leaflet) for visual display.
        </p>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Latitude</th>
              <th className="px-4 py-3">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((s) => (
                <tr key={s._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 font-mono">{s.code}</td>
                  <td className="px-4 py-3">{s.latitude ?? '—'}</td>
                  <td className="px-4 py-3">{s.longitude ?? '—'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No stations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GIS;

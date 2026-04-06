import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOfficer } from '../services/endpoints';
import StatusBadge from '../components/StatusBadge';
import type { Officer } from '../types';

const OfficerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['officer', id],
    queryFn: async () => {
      const res = await getOfficer(id!);
      return res.data.data as Officer;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="text-gray-400">Loading…</div>;
  if (!data) return <div className="text-gray-400">Officer not found.</div>;

  const fields = [
    { label: 'Badge Number', value: data.badgeNumber },
    { label: 'Name', value: data.name },
    { label: 'Rank', value: data.rank },
    { label: 'Phone', value: data.phone },
    { label: 'Email', value: data.email },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Officer Details</h1>
      <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {data.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{data.name}</h2>
            <StatusBadge status={data.isActive ? 'ACTIVE' : 'INACTIVE'} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-gray-500 uppercase">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};

export default OfficerDetail;

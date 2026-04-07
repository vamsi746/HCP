import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, CheckCircle, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { uploadDSR } from '../../services/endpoints';
import type { ForceType } from '../../types';

const FORCE_OPTIONS: { value: ForceType; label: string }[] = [
  { value: 'TASK_FORCE', label: "Commissioner's Task Force" },
  { value: 'H_FAST', label: 'H-FAST (Hyderabad Fast Action Special Team)' },
  { value: 'H_NEW', label: 'H-NEW (Hyderabad New Enforcement Wing)' },
];

const DSRUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedForce, setSelectedForce] = useState<ForceType | ''>('');
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (formData: FormData) => uploadDSR(formData),
    onSuccess: (res) => {
      const dsr = res.data?.data;
      toast.success(`DSR parsed successfully — ${dsr?.totalCases || 0} cases extracted`);
      setFile(null);
      setSelectedForce('');
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
      if (dsr?._id) {
        navigate(`/dsr/${dsr._id}`);
      }
    },
    onError: () => {
      toast.error('Failed to upload DSR');
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleUpload = () => {
    if (!file || !selectedForce) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('forceType', selectedForce);
    mutation.mutate(formData);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Upload DSR</h1>
      <p className="text-gray-500 text-sm mb-8">Upload a Daily Situation Report for automatic parsing</p>

      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        {/* Force Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Force Unit <span className="text-red-500">*</span></label>
          <select
            value={selectedForce}
            onChange={(e) => setSelectedForce(e.target.value as ForceType | '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">Select force unit…</option>
            {FORCE_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Document <span className="text-red-500">*</span></label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-400 bg-primary-50'
                : file
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle size={32} className="text-green-500" />
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <FileText size={16} />
                  {file.name}
                </div>
                <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB — click or drag to replace</span>
              </div>
            ) : (
              <div>
                <UploadIcon size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium text-sm">Drag & drop or click to select</p>
                <p className="text-xs text-gray-400 mt-1">Accepts .docx and .txt files</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleUpload}
          disabled={!file || !selectedForce || mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Parsing Document…
            </>
          ) : (
            <>
              <UploadIcon size={18} />
              Upload & Parse
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DSRUpload;

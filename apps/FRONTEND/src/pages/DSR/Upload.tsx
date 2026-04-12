import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, CheckCircle, FileText, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { uploadDSR } from '../../services/endpoints';
import FilterDropdown from '../../components/FilterDropdown';
import type { ForceType } from '../../types';

const FORCE_OPTIONS: { value: ForceType; label: string }[] = [
  { value: 'CHARMINAR_GOLCONDA', label: 'Charminar & Golconda (Task Force only)' },
  { value: 'RAJENDRANAGAR_SHAMSHABAD', label: 'Rajendra Nagar & Shamshabad (Task Force only)' },
  { value: 'KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS', label: 'Khairatabad, Secunderabad & Jubilee Hills (Task Force, H-New, H-Fast)' },
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
      navigate('/dsr');
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
      'application/msword': ['.doc'],
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
    <div>
      {/* Official header */}
      <div className="bg-slate-800 -mx-6 -mt-6 px-6 pt-5 pb-4 mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/dsr')}
          className="p-2 text-white/70 hover:text-white hover:bg-slate-700 transition"
          title="Back to DSR List"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-wide">UPLOAD DSR</h1>
          <p className="text-slate-400 text-[12px] mt-0.5 font-medium tracking-wider uppercase">Hyderabad City Police — Commissioner's Task Force</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="border border-slate-300 bg-white p-6 space-y-6">
          {/* Force Selection */}
          <div>
            <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Zones <span className="text-red-600">*</span></label>
            <FilterDropdown
              variant="form"
              placeholder="Select zones…"
              value={selectedForce}
              onChange={(v) => setSelectedForce(v as ForceType | '')}
              options={FORCE_OPTIONS}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Document <span className="text-red-600">*</span></label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-slate-500 bg-slate-50'
                  : file
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle size={32} className="text-emerald-600" />
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-[13px]">
                    <FileText size={16} />
                    {file.name}
                  </div>
                  <span className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(1)} KB — click or drag to replace</span>
                </div>
              ) : (
                <div>
                  <UploadIcon size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-700 font-bold text-[13px]">Drag & drop or click to select</p>
                  <p className="text-[11px] text-slate-400 mt-1">Accepts .doc, .docx and .txt files</p>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={!file || !selectedForce || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 text-[13px] font-bold uppercase tracking-wider hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default DSRUpload;

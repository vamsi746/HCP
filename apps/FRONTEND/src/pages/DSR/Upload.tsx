import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, CheckCircle, FileText, Loader2, ArrowLeft, Shield, FileBarChart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { uploadDSR } from '../../services/endpoints';
import FilterDropdown from '../../components/FilterDropdown';
import type { ForceType, DSRCategory } from '../../types';

const FORCE_OPTIONS: { value: ForceType; label: string }[] = [
  { value: 'CHARMINAR_GOLCONDA', label: 'Charminar & Golconda (Task Force only)' },
  { value: 'RAJENDRANAGAR_SHAMSHABAD', label: 'Rajendra Nagar & Shamshabad (Task Force only)' },
  { value: 'KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS', label: 'Khairatabad, Secunderabad & Jubilee Hills (Task Force, H-New, H-Fast)' },
];

const DSRUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dsrCategory, setDsrCategory] = useState<DSRCategory>('SPECIAL_WINGS');
  const [selectedForce, setSelectedForce] = useState<ForceType | ''>('');
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (formData: FormData) => uploadDSR(formData),
    onSuccess: (res) => {
      const dsr = res.data?.data;
      if (dsrCategory === 'NORMAL') {
        toast.success('Normal DSR uploaded successfully');
      } else {
        toast.success(`DSR parsed successfully — ${dsr?.totalCases || 0} cases extracted`);
      }
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

  const canSubmit = dsrCategory === 'NORMAL'
    ? !!file
    : !!file && !!selectedForce;

  const handleUpload = () => {
    if (!canSubmit) return;
    const formData = new FormData();
    formData.append('file', file!);
    formData.append('dsrCategory', dsrCategory);
    if (dsrCategory === 'SPECIAL_WINGS' && selectedForce) {
      formData.append('forceType', selectedForce);
    }
    mutation.mutate(formData);
  };

  return (
    <div>
      {/* Official header */}
      <div className="bg-slate-800 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 px-3 sm:px-4 md:px-6 pt-5 pb-4 mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
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

          {/* Category Selection */}
          <div>
            <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-2">DSR Type <span className="text-red-600">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setDsrCategory('SPECIAL_WINGS'); setFile(null); }}
                className={`relative flex items-center gap-3 p-4 border-2 transition-all text-left ${
                  dsrCategory === 'SPECIAL_WINGS'
                    ? 'border-slate-800 bg-slate-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2 ${dsrCategory === 'SPECIAL_WINGS' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Shield size={20} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-800">Special Wings</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Task Force, H-Fast, H-New DSRs</div>
                </div>
                {dsrCategory === 'SPECIAL_WINGS' && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-slate-800 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => { setDsrCategory('NORMAL'); setSelectedForce(''); setFile(null); }}
                className={`relative flex items-center gap-3 p-4 border-2 transition-all text-left ${
                  dsrCategory === 'NORMAL'
                    ? 'border-slate-800 bg-slate-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2 ${dsrCategory === 'NORMAL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <FileBarChart size={20} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-slate-800">Normal Cases</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Regular PS / Station-level DSRs</div>
                </div>
                {dsrCategory === 'NORMAL' && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-slate-800 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Force Selection — only for Special Wings */}
          {dsrCategory === 'SPECIAL_WINGS' && (
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
          )}

          {/* Info banner for Normal */}
          {dsrCategory === 'NORMAL' && (
            <div className="bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="text-[12px] font-bold text-amber-800 uppercase tracking-wider mb-1">Document Upload Only</div>
              <p className="text-[12px] text-amber-700 leading-relaxed">
                Normal DSR parsing & memo generation will be enabled once the DSR template and memo format are configured. 
                For now, the document will be stored for viewing and future processing.
              </p>
            </div>
          )}

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
            disabled={!canSubmit || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 text-[13px] font-bold uppercase tracking-wider hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {dsrCategory === 'NORMAL' ? 'Uploading Document…' : 'Parsing Document…'}
              </>
            ) : (
              <>
                <UploadIcon size={18} />
                {dsrCategory === 'NORMAL' ? 'Upload Document' : 'Upload & Parse'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DSRUpload;

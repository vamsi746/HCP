import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadDSR } from '../../services/endpoints';

const DSRUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (formData: FormData) => uploadDSR(formData),
    onSuccess: () => {
      toast.success('DSR uploaded successfully');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['dsrs'] });
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
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  });

  const handleUpload = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    mutation.mutate(formData);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Upload DSR</h1>

      <div className="bg-white rounded-xl shadow p-6 max-w-xl">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-shield-gold bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <UploadIcon size={40} className="mx-auto text-gray-400 mb-3" />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle size={18} />
              <span className="font-medium">{file.name}</span>
            </div>
          ) : (
            <p className="text-gray-500">Drag & drop a DSR file here, or click to browse</p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || mutation.isPending}
          className="mt-4 w-full bg-primary-500 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-600 transition disabled:opacity-50"
        >
          {mutation.isPending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

export default DSRUpload;

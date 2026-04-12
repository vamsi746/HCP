import React, { useRef, useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface MemoPrintButtonProps {
  content: string;
  title?: string;
  className?: string;
  iconSize?: number;
  label?: string;
}

const MemoPrintButton: React.FC<MemoPrintButtonProps> = ({
  content,
  title,
  className = 'flex items-center gap-1.5 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition rounded-sm',
  iconSize = 13,
  label = 'Print',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!containerRef.current || generating) return;
    setGenerating(true);
    try {
      const filename = (title || 'Memorandum').replace(/[^a-zA-Z0-9\s\-_.]/g, '') + '.pdf';
      await html2pdf()
        .set({
          margin: [15, 18, 15, 18],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(containerRef.current)
        .save();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <button onClick={handleDownload} disabled={generating} className={className}>
        {generating ? <Loader2 size={iconSize} className="animate-spin" /> : <Printer size={iconSize} />}
        {label}
      </button>
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm' }}>
        <div
          ref={containerRef}
          style={{
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '12pt',
            lineHeight: 1.7,
            color: '#000',
            background: '#fff',
            padding: '40px 50px',
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </>
  );
};

export default MemoPrintButton;

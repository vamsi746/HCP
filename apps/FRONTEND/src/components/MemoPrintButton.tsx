import React, { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';

interface MemoPrintButtonProps {
  content: string;
  title?: string;
  className?: string;
  iconSize?: number;
  label?: string;
}

/** Collect all CSS rules from the current page's stylesheets.
 *  This ensures the print iframe uses the EXACT same .tiptap styles as the editor. */
const collectPageCSS = (): string => {
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n';
      }
    } catch {
      // cross-origin stylesheet — skip
    }
  }
  return css;
};

const MemoPrintButton: React.FC<MemoPrintButtonProps> = ({
  content,
  title,
  className = 'flex items-center gap-1.5 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition rounded-sm',
  iconSize = 13,
  label = 'Print',
}) => {
  const [generating, setGenerating] = useState(false);

  const handlePrint = () => {
    if (generating) return;
    setGenerating(true);

    const pageCSS = collectPageCSS();

    // TipTap serializes empty paragraphs as <p></p> which collapse in HTML
    // (no line box = zero height). In the editor they're kept alive by contentEditable.
    // Fix: inject &nbsp; so they maintain proper line height in print.
    const printContent = content
      .replace(/<p><\/p>/g, '<p>&nbsp;</p>')
      .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '<p>&nbsp;</p>');

    // Iframe at 794px width — same as MemoEditor paper (A4 at 96dpi)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      setGenerating(false);
      return;
    }

    const docTitle = (title || 'Memorandum').replace(/</g, '&lt;');
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${docTitle}</title>
<style>
${pageCSS}
@page { size: A4; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; width: 794px; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
html, body { margin: 0; padding: 0; }
</style>
</head>
<body>
<div class="tiptap" style="width:794px; padding:50px 60px; font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.7; color:#000; background:#fff;">
${printContent}
</div>
</body>
</html>`);
    doc.close();

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setGenerating(false);
        }, 1000);
      }, 300);
    };

    iframe.onload = doPrint;
    if (iframe.contentDocument?.readyState === 'complete') {
      doPrint();
    }
  };

  return (
    <button onClick={handlePrint} disabled={generating} className={className}>
      {generating ? <Loader2 size={iconSize} className="animate-spin" /> : <Printer size={iconSize} />}
      {label}
    </button>
  );
};

export default MemoPrintButton;

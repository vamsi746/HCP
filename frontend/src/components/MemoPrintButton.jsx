import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import {
  MEMO_A4_WIDTH_PX,
  MEMO_A4_HEIGHT_PX,
  MEMO_PAGE_PADDING_X_PX,
  MEMO_PAGE_PADDING_Y_PX,
  MEMO_FONT_FAMILY,
  MEMO_FONT_SIZE_PT,
  MEMO_LINE_HEIGHT
} from "./memoLayout";
const collectPageCSS = () => {
  let css = "";
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        css += rule.cssText + "\n";
      }
    } catch {
    }
  }
  return css;
};
const normalizeLegacyFooterForPrint = (html) => {
  const source = String(html || "");
  if (!source) return source;
  if (source.includes("memo-footer-block")) {
    return source.replace(/<div class="memo-page-break"><\/div>\s*(?=<div class="memo-footer-block">)/ig, "");
  }
  const footerTailRegex = /(<p[^>]*text-align:\s*right[^>]*>\s*Commissioner of Police,\s*<\/p>\s*<p[^>]*text-align:\s*right[^>]*>\s*Hyderabad City\s*<\/p>\s*<p>\s*&nbsp;\s*<\/p>\s*<p>\s*To\s*<\/p>[\s\S]*)$/i;
  if (!footerTailRegex.test(source)) return source;
  return source.replace(footerTailRegex, (tail) => {
    const withSignature = tail.replace(
      /(<p[^>]*text-align:\s*right[^>]*>\s*Commissioner of Police,\s*<\/p>\s*<p[^>]*text-align:\s*right[^>]*>\s*Hyderabad City\s*<\/p>)/i,
      '<div class="memo-signature-block">$1</div>'
    );
    const withDispatch = withSignature.replace(
      /(<p>\s*To\s*<\/p>[\s\S]*)$/i,
      '<div class="memo-dispatch-block">$1</div>'
    );
    return `<div class="memo-footer-block">${withDispatch}</div>`;
  });
};
const preserveBlankParagraphsForPrint = (html) => {
  const source = String(html || "");
  if (!source) return source;
  const container = document.createElement("div");
  container.innerHTML = source;
  const isVisuallyEmptyParagraph = (p) => {
    const visibleText = (p.textContent || "").replace(/\u00a0/g, "").trim();
    if (visibleText.length > 0) return false;
    const nonBreakChildren = Array.from(p.children).filter((c) => c.tagName !== "BR");
    return nonBreakChildren.length === 0;
  };
  container.querySelectorAll("p").forEach((node) => {
    const p = node;
    if (isVisuallyEmptyParagraph(p)) {
      p.innerHTML = "&nbsp;";
    }
  });
  return container.innerHTML;
};
const MemoPrintButton = ({
  content,
  title,
  className = "flex items-center gap-1.5 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition rounded-sm",
  iconSize = 13,
  label = "Print"
}) => {
  const [generating, setGenerating] = useState(false);
  const handlePrint = () => {
    if (generating) return;
    setGenerating(true);
    const pageCSS = collectPageCSS();
    const printContent = preserveBlankParagraphsForPrint(content);
    const normalizedPrintContent = normalizeLegacyFooterForPrint(printContent);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${MEMO_A4_WIDTH_PX}px;height:${MEMO_A4_HEIGHT_PX}px;border:none;`;
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      setGenerating(false);
      return;
    }
    const docTitle = (title || "Memorandum").replace(/</g, "&lt;");
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
  html, body { margin: 0; padding: 0; width: ${MEMO_A4_WIDTH_PX}px; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
html, body { margin: 0; padding: 0; background: #fff; width: ${MEMO_A4_WIDTH_PX}px; }
.memo-print-root {
  width: ${MEMO_A4_WIDTH_PX}px;
  min-height: ${MEMO_A4_HEIGHT_PX}px;
  box-sizing: border-box;
  padding: ${MEMO_PAGE_PADDING_Y_PX}px ${MEMO_PAGE_PADDING_X_PX}px;
  font-family: ${MEMO_FONT_FAMILY};
  font-size: ${MEMO_FONT_SIZE_PT};
  line-height: ${MEMO_LINE_HEIGHT};
  color: #000;
  background: #fff;
}
.memo-print-root * { box-sizing: border-box; }
.memo-print-root .memo-page-break {
  display: none !important;
}
.memo-print-root .memo-signature-block {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.memo-print-root tr,
.memo-print-root img { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="tiptap memo-print-root">
${normalizedPrintContent}
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
        }, 1e3);
      }, 300);
    };
    iframe.onload = doPrint;
    if (iframe.contentDocument?.readyState === "complete") {
      doPrint();
    }
  };
  return <button onClick={handlePrint} disabled={generating} className={className}>{generating ? <Loader2 size={iconSize} className="animate-spin" /> : <Printer size={iconSize} />}{label}</button>;
};
export default MemoPrintButton;

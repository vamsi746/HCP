import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useCallback, useRef, useState } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight,
  Trash2, RotateCcw, MoveHorizontal,
} from 'lucide-react';

/* ── Resize handle positions ── */
const HANDLES = [
  { pos: 'nw', cursor: 'nw-resize', top: -4, left: -4 },
  { pos: 'ne', cursor: 'ne-resize', top: -4, right: -4 },
  { pos: 'sw', cursor: 'sw-resize', bottom: -4, left: -4 },
  { pos: 'se', cursor: 'se-resize', bottom: -4, right: -4 },
  { pos: 'n',  cursor: 'n-resize',  top: -4, left: '50%', ml: -4 },
  { pos: 's',  cursor: 's-resize',  bottom: -4, left: '50%', ml: -4 },
  { pos: 'w',  cursor: 'w-resize',  top: '50%', left: -4, mt: -4 },
  { pos: 'e',  cursor: 'e-resize',  top: '50%', right: -4, mt: -4 },
] as const;

function getHandleStyle(h: (typeof HANDLES)[number]): React.CSSProperties {
  const s: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    cursor: h.cursor,
  };
  if ('top' in h && h.top !== undefined) s.top = h.top;
  if ('bottom' in h && h.bottom !== undefined) s.bottom = h.bottom;
  if ('left' in h && h.left !== undefined) s.left = h.left;
  if ('right' in h && h.right !== undefined) s.right = h.right;
  if ('ml' in h) s.marginLeft = h.ml;
  if ('mt' in h) s.marginTop = h.mt;
  return s;
}

/* ── React component for the resizable image node view ── */
const ResizableImageView: React.FC<any> = ({ node, updateAttributes, selected, deleteNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const naturalSize = useRef<{ w: number; h: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [liveW, setLiveW] = useState<number | null>(null);
  const [liveH, setLiveH] = useState<number | null>(null);

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight };
    if (!node.attrs.width && !node.attrs.height) {
      const maxW = 500;
      const w = Math.min(img.naturalWidth, maxW);
      const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
      updateAttributes({ width: w, height: h });
    }
  }, [node.attrs.width, node.attrs.height, updateAttributes]);

  /* ── Resize via pointer events (works across iframe boundaries too) ── */
  const startResize = useCallback(
    (e: React.PointerEvent, handle: string) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      setResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = node.attrs.width || containerRef.current?.offsetWidth || 200;
      const startH = node.attrs.height || containerRef.current?.offsetHeight || 150;
      const aspect = startW / startH;
      const isCorner = handle.length === 2;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = startW;
        let newH = startH;

        if (handle.includes('e')) newW = startW + dx;
        if (handle.includes('w')) newW = startW - dx;
        if (handle.includes('s')) newH = startH + dy;
        if (handle.includes('n')) newH = startH - dy;

        newW = Math.max(30, newW);
        newH = Math.max(30, newH);

        if (isCorner && !ev.shiftKey) {
          newH = Math.round(newW / aspect);
        }

        setLiveW(Math.round(newW));
        setLiveH(Math.round(newH));
      };

      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);

        const finalW = liveWRef.current ?? startW;
        const finalH = liveHRef.current ?? startH;
        updateAttributes({ width: finalW, height: finalH });
        setLiveW(null);
        setLiveH(null);
        setResizing(false);
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    },
    [node.attrs.width, node.attrs.height, updateAttributes],
  );

  // Refs to read latest live size in onUp without stale closure
  const liveWRef = useRef<number | null>(null);
  const liveHRef = useRef<number | null>(null);
  liveWRef.current = liveW;
  liveHRef.current = liveH;

  const alignment = node.attrs.alignment || 'inline';
  const displayW = liveW ?? node.attrs.width;
  const displayH = liveH ?? node.attrs.height;

  const setSize = (w: number | string, h?: number | string) => {
    if (typeof w === 'string' && w.endsWith('%')) {
      const container = containerRef.current?.closest('.tiptap') || containerRef.current?.parentElement;
      if (container) {
        const pct = parseInt(w) / 100;
        const cw = container.clientWidth - 120;
        const pw = Math.round(cw * pct);
        const nat = naturalSize.current;
        const ph = nat ? Math.round(pw * (nat.h / nat.w)) : Math.round(pw * 0.75);
        updateAttributes({ width: pw, height: ph });
      }
      return;
    }
    const numW = typeof w === 'number' ? w : parseInt(String(w)) || node.attrs.width;
    const numH = h != null ? (typeof h === 'number' ? h : parseInt(String(h)) || node.attrs.height) : node.attrs.height;
    updateAttributes({ width: numW, height: numH });
  };

  const handleAlign = (a: string) => updateAttributes({ alignment: a });

  const handleResetSize = () => {
    if (naturalSize.current) {
      const maxW = 500;
      const w = Math.min(naturalSize.current.w, maxW);
      const h = Math.round(w * (naturalSize.current.h / naturalSize.current.w));
      updateAttributes({ width: w, height: h });
    }
  };

  const isInline = alignment === 'inline';

  const wrapperStyle: React.CSSProperties = isInline
    ? { display: 'inline-flex', verticalAlign: 'bottom' }
    : alignment === 'center' ? { display: 'flex', justifyContent: 'center' }
    : alignment === 'right' ? { display: 'flex', justifyContent: 'flex-end' }
    : { display: 'flex', justifyContent: 'flex-start' };

  const btnCls = (active: boolean) =>
    `h-6 w-6 flex items-center justify-center rounded transition-colors ${
      active ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-blue-50'
    }`;

  return (
    <NodeViewWrapper
      as={isInline ? 'span' : 'div'}
      className={`resizable-img-node${selected ? ' img-selected' : ''}${resizing ? ' img-resizing' : ''}${isInline ? ' img-inline' : ' img-block'}`}
      style={wrapperStyle}
    >
      <div
        ref={containerRef}
        className="resizable-img-inner"
        style={{
          width: displayW || undefined,
          height: displayH || undefined,
          maxWidth: '100%',
        }}
      >
        {/* ═══ Floating Image Toolbar ═══ */}
        {selected && !resizing && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 z-20 img-toolbar-anim"
            contentEditable={false}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg shadow-lg px-1.5 py-1 text-[11px]">
              {/* Alignment */}
              <button className={btnCls(alignment === 'inline')} title="Inline" onMouseDown={(e) => { e.preventDefault(); handleAlign('inline'); }}>
                <MoveHorizontal size={13} />
              </button>
              <button className={btnCls(alignment === 'left')} title="Align Left" onMouseDown={(e) => { e.preventDefault(); handleAlign('left'); }}>
                <AlignLeft size={13} />
              </button>
              <button className={btnCls(alignment === 'center')} title="Center" onMouseDown={(e) => { e.preventDefault(); handleAlign('center'); }}>
                <AlignCenter size={13} />
              </button>
              <button className={btnCls(alignment === 'right')} title="Align Right" onMouseDown={(e) => { e.preventDefault(); handleAlign('right'); }}>
                <AlignRight size={13} />
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Size presets */}
              <button onMouseDown={(e) => { e.preventDefault(); setSize('25%'); }} className="h-6 px-1.5 rounded hover:bg-blue-50 text-slate-600 font-medium" title="25% width">25%</button>
              <button onMouseDown={(e) => { e.preventDefault(); setSize('50%'); }} className="h-6 px-1.5 rounded hover:bg-blue-50 text-slate-600 font-medium" title="50% width">50%</button>
              <button onMouseDown={(e) => { e.preventDefault(); setSize('75%'); }} className="h-6 px-1.5 rounded hover:bg-blue-50 text-slate-600 font-medium" title="75% width">75%</button>
              <button onMouseDown={(e) => { e.preventDefault(); setSize('100%'); }} className="h-6 px-1.5 rounded hover:bg-blue-50 text-slate-600 font-medium" title="Full width">100%</button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Manual W / H */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400">W</span>
                <input
                  type="number"
                  value={displayW || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 100;
                    setSize(v, node.attrs.height);
                  }}
                  className="h-6 w-14 text-[11px] border rounded px-1 text-center"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-slate-400">H</span>
                <input
                  type="number"
                  value={displayH || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 100;
                    setSize(node.attrs.width, v);
                  }}
                  className="h-6 w-14 text-[11px] border rounded px-1 text-center"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Reset */}
              <button className={btnCls(false)} title="Reset Size" onMouseDown={(e) => { e.preventDefault(); handleResetSize(); }}>
                <RotateCcw size={13} />
              </button>
              {/* Delete */}
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500" title="Delete" onMouseDown={(e) => { e.preventDefault(); deleteNode(); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}

        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          onLoad={onImgLoad}
          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          draggable={false}
        />

        {/* 8 resize handles — only when selected */}
        {selected && HANDLES.map((h) => (
          <div
            key={h.pos}
            className="img-resize-handle"
            style={getHandleStyle(h)}
            draggable={false}
            onPointerDown={(e) => startResize(e, h.pos)}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
};

/* ── TipTap extension ── */
export const ResizableImage = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      alignment: { default: 'inline' },
    };
  },

  parseHTML() {
    return [{
      tag: 'img[src]',
      getAttrs: (dom: HTMLElement) => {
        const width = dom.getAttribute('width') || dom.style.width?.replace('px', '') || null;
        const height = dom.getAttribute('height') || dom.style.height?.replace('px', '') || null;
        return {
          src: dom.getAttribute('src'),
          alt: dom.getAttribute('alt'),
          title: dom.getAttribute('title'),
          width: width ? parseInt(String(width)) || null : null,
          height: height ? parseInt(String(height)) || null : null,
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const style: string[] = [];
    if (HTMLAttributes.width) style.push(`width: ${HTMLAttributes.width}px`);
    if (HTMLAttributes.height) style.push(`height: ${HTMLAttributes.height}px`);
    if (HTMLAttributes.alignment === 'center') style.push('display: block', 'margin-left: auto', 'margin-right: auto');
    else if (HTMLAttributes.alignment === 'right') style.push('display: block', 'margin-left: auto');
    const { width, height, alignment, ...rest } = HTMLAttributes;
    const attrs = { ...rest, style: style.join('; ') || undefined };
    return ['img', mergeAttributes(attrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView, {
      stopEvent: ({ event }) => {
        // Allow pointer events on resize handles and toolbar to pass through to React
        if (event.type.startsWith('pointer') || event.type === 'mousedown') {
          const target = event.target as HTMLElement;
          if (target.closest?.('.img-resize-handle') || target.closest?.('.img-toolbar-anim')) {
            return true;
          }
        }
        // Let input events through for the W/H text fields
        if (event.type === 'input' || event.type === 'keydown' || event.type === 'keypress' || event.type === 'keyup') {
          const target = event.target as HTMLElement;
          if (target.closest?.('.img-toolbar-anim')) {
            return true;
          }
        }
        return false;
      },
    });
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    } as any;
  },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { ResizableImage } from './ResizableImage';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import {
  MEMO_A4_WIDTH_PX,
  MEMO_A4_HEIGHT_PX,
  MEMO_PAGE_PADDING_X_PX,
  MEMO_PAGE_PADDING_Y_PX,
  MEMO_CONTENT_MIN_HEIGHT_PX,
  MEMO_FONT_FAMILY,
  MEMO_FONT_SIZE_PT,
  MEMO_LINE_HEIGHT,
} from './memoLayout';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2, ImagePlus,
  Minus, Palette, Link as LinkIcon, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, Table as TableIcon, Highlighter,
  IndentIncrease, IndentDecrease,
} from 'lucide-react';

interface MemoEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
}

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '36pt', '48pt'];
const FONT_FAMILIES = [
  { label: 'Serif', value: 'serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Monospace', value: 'monospace' },
];
const FORMATS = [
  { label: 'Normal', value: 'paragraph' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
];
const FONT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#1a56db', '#047857', '#b91c1c', '#a16207',
  '#7c3aed', '#0e7490', '#be185d', '#ea580c',
];

const ToolbarSelect: React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  width?: number;
  title?: string;
}> = ({ value, options, onChange, width = 90, title }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    title={title}
    className="h-7 border border-gray-200 rounded text-xs text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-none px-1.5"
    style={{ width }}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Btn: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
      active
        ? 'bg-blue-100 text-blue-700'
        : disabled
        ? 'text-gray-300 cursor-not-allowed'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const Sep = () => <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />;

/* ── FontSize extension (inline style based) ── */
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}` };
        },
      },
    };
  },
});

const MemoEditor: React.FC<MemoEditorProps> = ({ content, onUpdate, editable = true }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(1);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ResizableImage,
      FontSize,
      Color,
      FontFamily,
      Placeholder.configure({
        placeholder: 'Start typing the memo content…',
        emptyEditorClass: 'is-editor-empty',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Superscript,
      Subscript,
      Highlight.configure({ multicolor: true }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        style: `min-height: ${MEMO_CONTENT_MIN_HEIGHT_PX}px; padding: ${MEMO_PAGE_PADDING_Y_PX}px ${MEMO_PAGE_PADDING_X_PX}px; font-family: ${MEMO_FONT_FAMILY}; font-size: ${MEMO_FONT_SIZE_PT}; line-height: ${MEMO_LINE_HEIGHT}; color: #000;`,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) {
            // Shift+Tab: outdent list item if in list
            if (editor?.can().liftListItem('listItem')) {
              editor.chain().focus().liftListItem('listItem').run();
            }
          } else {
            // Tab: indent list item or insert 4 spaces
            if (editor?.can().sinkListItem('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run();
            } else {
              editor?.chain().focus().insertContent('\u00A0\u00A0\u00A0\u00A0').run();
            }
          }
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // Track content height to calculate page count
  useEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.scrollHeight;
      setNumPages(Math.max(1, Math.ceil(h / MEMO_A4_HEIGHT_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [editor, content]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImageSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        (editor.chain().focus() as any).setImage({ src: reader.result as string }).run();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [editor]
  );

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (editor) editor.chain().focus().setColor(e.target.value).run();
    },
    [editor]
  );

  const insertLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  // ── Get current font size from selection ──
  const getCurrentFontSize = (): string => {
    if (!editor) return '12pt';
    const attrs = editor.getAttributes('textStyle');
    return attrs.fontSize || '12pt';
  };

  const setFontSize = (size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
  };

  const getCurrentFontFamily = (): string => {
    if (!editor) return 'serif';
    const attrs = editor.getAttributes('textStyle');
    return attrs.fontFamily || 'serif';
  };

  const getCurrentFormat = (): string => {
    if (!editor) return 'paragraph';
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    return 'paragraph';
  };

  const setFormat = (val: string) => {
    if (!editor) return;
    if (val === 'paragraph') editor.chain().focus().setParagraph().run();
    else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ── Toolbar ── */}
      {editable && (
        <div className="border-b border-gray-200 bg-gray-50/80 px-2 py-1 flex flex-wrap items-center gap-0.5">
          {/* Row 1 items */}
          {/* Text formatting */}
          <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
            <Bold size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
            <Italic size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
            <UnderlineIcon size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript">
            <SuperscriptIcon size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript">
            <SubscriptIcon size={14} />
          </Btn>

          <Sep />

          {/* Font size */}
          <ToolbarSelect
            value={getCurrentFontSize()}
            options={FONT_SIZES.map((s) => ({ label: s, value: s }))}
            onChange={setFontSize}
            width={62}
            title="Font Size"
          />

          {/* Font family */}
          <ToolbarSelect
            value={getCurrentFontFamily()}
            options={FONT_FAMILIES}
            onChange={(v) => editor.chain().focus().setFontFamily(v).run()}
            width={110}
            title="Font Family"
          />

          {/* Format */}
          <ToolbarSelect
            value={getCurrentFormat()}
            options={FORMATS}
            onChange={setFormat}
            width={90}
            title="Format"
          />

          <Sep />

          {/* Alignment */}
          <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
            <AlignLeft size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
            <AlignCenter size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
            <AlignRight size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
            <AlignJustify size={14} />
          </Btn>

          <Sep />

          {/* Lists & indent */}
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
            <List size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
            <ListOrdered size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')} title="Indent">
            <IndentIncrease size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')} title="Outdent">
            <IndentDecrease size={14} />
          </Btn>

          <Sep />

          {/* Color & highlight */}
          <div className="relative">
            <Btn onClick={() => colorInputRef.current?.click()} title="Text Color">
              <Palette size={14} />
            </Btn>
            <input ref={colorInputRef} type="color" onChange={handleColorChange} className="absolute opacity-0 w-0 h-0 pointer-events-none" tabIndex={-1} />
          </div>
          <Btn onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} active={editor.isActive('highlight')} title="Highlight">
            <Highlighter size={14} />
          </Btn>

          <Sep />

          {/* Link, Image, Table, HR */}
          <Btn onClick={insertLink} active={editor.isActive('link')} title="Insert Link">
            <LinkIcon size={14} />
          </Btn>
          <Btn onClick={handleImageUpload} title="Insert Image">
            <ImagePlus size={14} />
          </Btn>
          <Btn onClick={insertTable} title="Insert Table">
            <TableIcon size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
            <Minus size={14} />
          </Btn>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageSelected} className="hidden" />

          <Sep />

          {/* Undo / Redo */}
          <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
            <Undo2 size={14} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
            <Redo2 size={14} />
          </Btn>
        </div>
      )}

      {/* ── A4 Paper area — single continuous paper with page break lines ── */}
      <div className="bg-gray-100 p-6 overflow-auto" style={{ minHeight: 800 }}>
        <div className="mx-auto relative" style={{ width: MEMO_A4_WIDTH_PX }}>
          <div
            ref={paperRef}
            className="bg-white shadow-lg ring-1 ring-gray-200"
            style={{ minHeight: MEMO_A4_HEIGHT_PX }}
          >
            <EditorContent editor={editor} />
          </div>
          {/* Page break indicator lines */}
          {Array.from({ length: numPages - 1 }).map((_, i) => {
            const y = (i + 1) * MEMO_A4_HEIGHT_PX;
            return (
              <div
                key={i}
                className="absolute left-0 right-0 pointer-events-none flex items-center"
                style={{ top: y, zIndex: 20 }}
              >
                <div className="flex-1 border-t border-dashed border-gray-400" />
                <span className="mx-2 text-[10px] text-gray-400 bg-white px-2 rounded-sm whitespace-nowrap">
                  Page {i + 2}
                </span>
                <div className="flex-1 border-t border-dashed border-gray-400" />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer bar ── */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-400">
        <span>A4 (210mm × 297mm) · {numPages} page{numPages > 1 ? 's' : ''}</span>
        <span>Tab = indent · Shift+Tab = outdent · Shift+Enter = line break · Ctrl+A = select all</span>
      </div>
    </div>
  );
};

export default MemoEditor;

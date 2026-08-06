import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  RemoveFormatting,
  ChevronDown,
  Pilcrow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type BlockValue = 'paragraph' | `h${HeadingLevel}`;

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text.trim());
}

/** Convert legacy markdown-ish plain text into simple HTML for the panel editor. */
export function markdownishToHtml(text: string): string {
  if (!text?.trim()) return '';
  if (looksLikeHtml(text)) return text;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string) =>
    escape(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    out.push(`<${listType}>${listItems.map((i) => `<li>${inline(i)}</li>`).join('')}</${listType}>`);
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h1 = trimmed.match(/^#\s+(.+)$/);
    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    const ol = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (h3 || h2 || h1) {
      flushPara();
      flushList();
      const label = (h3 || h2 || h1)![1].replace(/\s*#+\s*$/g, '').trim();
      const level = h3 ? 3 : h2 ? 2 : 1;
      out.push(`<h${level}>${inline(label)}</h${level}>`);
      continue;
    }

    if (ul) {
      flushPara();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ul[1]);
      continue;
    }

    if (ol) {
      flushPara();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ol[1]);
      continue;
    }

    flushList();
    para.push(trimmed);
  }

  flushPara();
  flushList();
  return out.join('') || '<p></p>';
}

function ToolbarIconButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        active
          ? 'border-[#f15a24] bg-[#f15a24] text-white shadow-sm'
          : 'border-transparent bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

function getActiveBlock(editor: NonNullable<ReturnType<typeof useEditor>>): BlockValue {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  return 'paragraph';
}

/**
 * Icon toolbar rich text editor for blog writers.
 * Heading dropdown (H1–H6) + format icons — no markdown typing required.
 */
export function BlogRichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
          class: 'blog-link',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write your article here…',
      }),
    ],
    content: markdownishToHtml(value || ''),
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          'blog-rich-editor min-h-[200px] px-4 py-3 focus:outline-none text-gray-800',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  if (!editor) return null;

  const activeBlock = getActiveBlock(editor);

  const setBlock = (next: BlockValue) => {
    const chain = editor.chain().focus();
    if (next === 'paragraph') {
      chain.setParagraph().run();
      return;
    }
    const level = Number(next.slice(1)) as HeadingLevel;
    chain.setHeading({ level }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Paste link URL (https://…)', prev || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className={cn('rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm', className)}>
      <style>{`
        .blog-rich-editor p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .blog-rich-editor { line-height: 1.75; font-size: 1rem; }
        .blog-rich-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.75rem; color: #111827; line-height: 1.3; }
        .blog-rich-editor h2 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.65rem; color: #111827; line-height: 1.3; }
        .blog-rich-editor h3 { font-size: 1.25rem; font-weight: 700; margin: 0.9rem 0 0.55rem; color: #111827; line-height: 1.3; }
        .blog-rich-editor h4 { font-size: 1.125rem; font-weight: 700; margin: 0.8rem 0 0.5rem; color: #111827; line-height: 1.3; }
        .blog-rich-editor h5 { font-size: 1.05rem; font-weight: 700; margin: 0.7rem 0 0.45rem; color: #111827; line-height: 1.3; }
        .blog-rich-editor h6 { font-size: 1rem; font-weight: 700; margin: 0.6rem 0 0.4rem; color: #1f2937; line-height: 1.3; }
        .blog-rich-editor p { margin-bottom: 0.75rem; color: #374151; }
        .blog-rich-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
        .blog-rich-editor ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
        .blog-rich-editor li { margin-bottom: 0.35rem; }
        .blog-rich-editor a,
        .blog-rich-editor a.blog-link {
          color: #f15a24;
          text-decoration: underline;
          font-weight: 700;
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100/80 px-2 py-2">
        <div className="relative mr-1">
          <Pilcrow className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <select
            aria-label="Text style"
            title="Paragraph or heading"
            value={activeBlock}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setBlock(e.target.value as BlockValue)}
            className="h-8 appearance-none rounded-md border border-gray-200 bg-white pl-7 pr-7 text-xs font-semibold text-gray-700 shadow-sm outline-none hover:border-gray-300 focus:border-[#f15a24] focus:ring-1 focus:ring-[#f15a24]"
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>

        <span className="mx-0.5 hidden h-5 w-px bg-gray-300 sm:block" />

        <ToolbarIconButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarIconButton>

        <span className="mx-0.5 hidden h-5 w-px bg-gray-300 sm:block" />

        <ToolbarIconButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarIconButton>

        <span className="mx-0.5 hidden h-5 w-px bg-gray-300 sm:block" />

        <ToolbarIconButton title="Add or edit link" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarIconButton>
      </div>

      <EditorContent editor={editor} />

      <div className="border-t border-gray-100 bg-gray-50/90 px-3 py-1.5 text-[11px] text-gray-500">
        Use the toolbar: pick a heading from the dropdown, then Bold / lists / Link icons.
      </div>
    </div>
  );
}

export default BlogRichTextEditor;

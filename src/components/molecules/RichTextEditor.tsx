"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing...",
}: RichTextEditorProps) {
  const lowlight = createLowlight(common);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // Disable default code block
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block-wrapper',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-placeholder': {
              default: '// Code block',
            },
          };
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 tiptap-editor",
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          // Insert text at current position without creating new paragraphs
          view.dispatch(
            view.state.tr.insertText(text, view.state.selection.from, view.state.selection.to)
          );
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
        active ? "bg-slate-200 dark:bg-slate-700 text-[#2E7D32]" : "text-slate-600 dark:text-slate-400"
      }`}
    >
      {children}
    </button>
  );

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <style jsx global>{`
        .tiptap-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.2;
        }
        .tiptap-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }
        .tiptap-editor h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
        }
        .tiptap-editor ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor li {
          margin: 0.25em 0;
        }
        .tiptap-editor blockquote {
          border-left: 4px solid #2E7D32;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #64748b;
        }
        .dark .tiptap-editor blockquote {
          color: #94a3b8;
        }
        .tiptap-editor p {
          margin: 0.5em 0;
        }
        .tiptap-editor strong {
          font-weight: bold;
        }
        .tiptap-editor em {
          font-style: italic;
        }
        .tiptap-editor u {
          text-decoration: underline;
        }
        .tiptap-editor s {
          text-decoration: line-through;
        }
        .tiptap-editor code {
          background-color: #f1f5f9;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: monospace;
          font-size: 0.9em;
        }
        .dark .tiptap-editor code {
          background-color: #334155;
        }
        .tiptap-editor pre {
          background-color: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 0.5em;
          padding: 1em;
          margin: 1em 0;
          overflow-x: auto;
          position: relative;
        }
        .dark .tiptap-editor pre {
          background-color: #1e293b;
          border-color: #334155;
        }
        .tiptap-editor pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.875em;
          line-height: 1.5;
          color: #334155;
        }
        .dark .tiptap-editor pre code {
          color: #e2e8f0;
        }
        .tiptap-editor pre:has(.is-empty)::before,
        .tiptap-editor pre code.is-empty::before {
          content: '// Code block';
          color: #94a3b8;
          pointer-events: none;
          position: absolute;
          left: 1em;
        }
        .tiptap-editor .is-editor-empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap-editor a {
          color: #2E7D32;
          text-decoration: underline;
        }
        .tiptap-editor[style*="text-align: center"] {
          text-align: center;
        }
        .tiptap-editor[style*="text-align: right"] {
          text-align: right;
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        >
          <AlignRight size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={addLink}
          active={editor.isActive("link")}
          title="Add Link"
        >
          <LinkIcon size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <Redo size={18} />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <div className="overflow-y-auto max-h-[400px]">
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
    </div>
  );
}

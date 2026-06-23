import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2, Bold, Italic, Underline, List, ListOrdered, Link2, Image as ImageIcon } from 'lucide-react';

export interface RichTextEditorRef {
  insertText: (text: string) => void;
  getHtml: () => string;
  setHtml: (html: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({ value, onChange }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [activeStyles, setActiveStyles] = React.useState({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  const updateFormattingState = () => {
    setActiveStyles({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  };

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormattingState);
    return () => document.removeEventListener('selectionchange', updateFormattingState);
  }, []);

  // Sync incoming value only when editor does not match to avoid cursor resetting
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        const sel = window.getSelection();
        if (sel && sel.getRangeAt && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          
          // Move cursor after the inserted text
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editorRef.current.innerHTML += text;
        }
        onChange(editorRef.current.innerHTML);
      }
    },
    getHtml: () => editorRef.current?.innerHTML || '',
    setHtml: (html: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
        onChange(html);
      }
    }
  }));

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
      updateFormattingState();
    }
  };

  const addLink = () => {
    const url = prompt('Insira o endereço do link:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const supabase = createBrowserClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-assets')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('template-assets')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Focus editor and insert image
      if (editorRef.current) {
        editorRef.current.focus();
        execCommand('insertImage', publicUrl);
      }
    } catch (err: any) {
      console.error('Error uploading image:', err);
      alert('Falha ao subir imagem: ' + (err.message || err));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const getButtonClass = (isActive: boolean) => 
    `p-1.5 rounded transition-all cursor-pointer ${isActive ? 'bg-[#EAF2FF] text-[#2D6BFF]' : 'hover:bg-[#EAF2FF] text-[#002B6A]'}`;

  return (
    <div className="border border-[#D8E0EA] rounded-xl overflow-hidden bg-white focus-within:border-[#2D6BFF] transition-all">
      {/* Toolbar */}
      <div className="bg-[#F7FAFF] border-b border-[#D8E0EA] px-3 py-2 flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={getButtonClass(activeStyles.bold)}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={getButtonClass(activeStyles.italic)}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={getButtonClass(activeStyles.underline)}
          title="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </button>
        <div className="w-[1px] h-4 bg-[#D8E0EA] mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={getButtonClass(activeStyles.insertUnorderedList)}
          title="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className={getButtonClass(activeStyles.insertOrderedList)}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-[1px] h-4 bg-[#D8E0EA] mx-1" />
        <button
          type="button"
          onClick={addLink}
          className="p-1.5 rounded hover:bg-[#EAF2FF] text-[#002B6A] transition-all cursor-pointer"
          title="Inserir Link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <label className="p-1.5 rounded hover:bg-[#EAF2FF] text-[#002B6A] transition-all cursor-pointer flex items-center justify-center" title="Subir Imagem">
          <ImageIcon className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
        {isUploading && (
          <Loader2 className="h-4 w-4 animate-spin text-[#2D6BFF] ml-1" />
        )}
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="px-3.5 py-3 min-h-[250px] max-h-[450px] overflow-y-auto outline-none text-sm text-[#061A40] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1"
        style={{ fontFamily: 'inherit' }}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

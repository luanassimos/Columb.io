'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { bulkImportContacts } from '@/app/actions/contact';
import { CreateContactInput } from '@/app/actions/contact';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2, FileCode, ArrowRight } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<CreateContactInput[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setParsedContacts([]);
    setError(null);
    setSuccessCount(null);
    setIsProcessing(false);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentLine += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const headerLine = lines[0];
    const delimiter = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';

    const splitRow = (rowStr: string): string[] => {
      const row: string[] = [];
      let field = '';
      let inQ = false;
      for (let i = 0; i < rowStr.length; i++) {
        const c = rowStr[i];
        const nc = rowStr[i + 1];
        if (c === '"') {
          if (inQ && nc === '"') {
            field += '"';
            i++;
          } else {
            inQ = !inQ;
          }
        } else if (c === delimiter && !inQ) {
          row.push(field.trim());
          field = '';
        } else {
          field += c;
        }
      }
      row.push(field.trim());
      return row;
    };

    const headers = splitRow(lines[0]).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const results: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitRow(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, index) => {
        let val = values[index] ?? '';
        val = val.replace(/^["']|["']$/g, '').trim();
        obj[h] = val;
      });
      results.push(obj);
    }

    return results;
  };

  const parseJSON = (text: string): Record<string, any>[] => {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      if (Array.isArray(data.leads)) return data.leads;
      if (Array.isArray(data.contacts)) return data.contacts;
      if (Array.isArray(data.data)) return data.data;
    }
    throw new Error('Formato JSON inválido. O arquivo deve conter um array de objetos.');
  };

  const normalizeItem = (item: Record<string, any>): CreateContactInput => {
    const getKey = (...keys: string[]): string => {
      for (const k of keys) {
        for (const itemKey of Object.keys(item)) {
          if (itemKey.toLowerCase().trim() === k.toLowerCase()) {
            const val = item[itemKey];
            if (val !== undefined && val !== null) return String(val).trim();
          }
        }
      }
      return '';
    };

    const name = getKey('name', 'nome', 'contact_name', 'full_name', 'lead_name', 'display_name') || 'Contato Importado';
    const company = getKey('company', 'empresa', 'organization', 'company_name', 'role', 'cargo') || name || 'Empresa';
    const email = getKey('email', 'e-mail', 'mail', 'contact_email');
    const phone = getKey('phone', 'telefone', 'tel', 'mobile', 'celular') || undefined;
    const city = getKey('city', 'cidade', 'location', 'localizacao', 'region', 'regiao') || undefined;
    const address = getKey('address', 'endereco', 'rua', 'location_address') || undefined;
    const maps_url = getKey('maps_url', 'url_maps', 'google_maps', 'yelp_url', 'maps') || undefined;
    const linkedin_url = getKey('linkedin_url', 'linkedin', 'url_linkedin', 'profile_url') || undefined;

    const rawTags = getKey('tags', 'tag', 'categoria', 'category');
    let tags: string[] = ['Imported'];
    if (Array.isArray(item.tags)) {
      const customTags = item.tags.map(t => String(t).trim()).filter(Boolean);
      if (customTags.length > 0) tags = customTags;
    } else if (rawTags) {
      const customTags = rawTags.split(/[,;]/).map(t => t.trim()).filter(Boolean);
      if (customTags.length > 0) tags = customTags;
    }

    const ratingNum = Number(getKey('rating', 'estrelas', 'classificacao'));
    const rating = !isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5 ? ratingNum : 0;

    return {
      name,
      company,
      email,
      phone,
      city,
      address,
      maps_url,
      linkedin_url,
      tags,
      status: 'new',
      rating,
    };
  };

  const processFile = async (selectedFile: File) => {
    setError(null);
    setSuccessCount(null);
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      let rawItems: Record<string, any>[] = [];

      if (selectedFile.name.endsWith('.json')) {
        rawItems = parseJSON(text);
      } else {
        rawItems = parseCSV(text);
      }

      if (rawItems.length === 0) {
        throw new Error('Nenhum registro encontrado no arquivo.');
      }

      const normalized = rawItems.map(normalizeItem);
      setParsedContacts(normalized);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo.');
      setParsedContacts([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedContacts.length === 0) return;
    setIsUploading(true);
    setError(null);

    const res = await bulkImportContacts(parsedContacts);
    setIsUploading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessCount(res.count || parsedContacts.length);
      router.refresh();
      setTimeout(() => {
        handleClose();
      }, 1800);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#061A40]/30 z-[200] transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-2xl z-[201] space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#D8E0EA] pb-4">
          <div>
            <h3 className="text-lg font-bold text-[#002B6A]">Importar Leads (CSV ou JSON)</h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Faça upload de um arquivo contendo seus contatos em formato CSV ou JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-[#475569] hover:bg-[#EAF2FF] transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Success Alert */}
        {successCount !== null && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            Sucesso! {successCount} leads importados para a sua lista de contatos.
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            {error}
          </div>
        )}

        {/* Upload Zone */}
        {successCount === null && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv, .json, text/csv, application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#D8E0EA] hover:border-[#2D6BFF] bg-[#F7FAFF] hover:bg-[#EAF2FF]/50 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="h-12 w-12 rounded-full bg-white border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto shadow-sm group-hover:scale-105 transition-transform">
                {file?.name.endsWith('.json') ? (
                  <FileCode className="h-6 w-6" />
                ) : (
                  <FileText className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-[#002B6A]">
                  {file ? file.name : 'Clique para selecionar ou arraste o arquivo aqui'}
                </p>
                <p className="text-xs text-[#475569] mt-1">
                  Suporta arquivos <strong>.CSV</strong> ou <strong>.JSON</strong>
                </p>
              </div>
            </div>

            {/* Processing State */}
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-[#2D6BFF]">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando e validando dados do arquivo...
              </div>
            )}

            {/* Preview Section */}
            {parsedContacts.length > 0 && !isProcessing && (
              <div className="bg-slate-50 border border-[#D8E0EA] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#002B6A]">
                    Contatos Encontrados: {parsedContacts.length}
                  </span>
                  <span className="text-[10px] bg-[#EAF2FF] text-[#2D6BFF] px-2 py-0.5 rounded-full font-semibold">
                    Pronto para importar
                  </span>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white text-xs divide-y">
                  {parsedContacts.slice(0, 5).map((c, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-[#002B6A] block truncate">{c.name}</span>
                        <span className="text-[10px] text-[#475569] block truncate">{c.company} • {c.email || 'Sem e-mail'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.phone || c.city || '—'}</span>
                    </div>
                  ))}
                  {parsedContacts.length > 5 && (
                    <div className="px-3 py-1.5 text-center text-[10px] text-[#475569] italic bg-slate-50">
                      ... e mais {parsedContacts.length - 5} contatos
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-3 pt-2 border-t border-[#D8E0EA]">
          <button
            type="button"
            disabled={isUploading}
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-[#475569] bg-[#F7FAFF] hover:bg-[#EAF2FF] border border-[#D8E0EA] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={parsedContacts.length === 0 || isUploading || isProcessing}
            onClick={handleConfirmImport}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
            ) : (
              <>Importar {parsedContacts.length > 0 ? `${parsedContacts.length} Contatos` : ''} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

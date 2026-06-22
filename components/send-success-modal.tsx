'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Send } from 'lucide-react';
import type { EmailSendMode } from '@/lib/email-mode';

interface SendSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSendMode?: EmailSendMode;
}

export default function SendSuccessModal({ isOpen, onClose, emailSendMode = 'mock' }: SendSuccessModalProps) {
  const images = [
    '/fly01.webp',
    '/fly02.webp',
    '/fly03.webp',
    '/fly02.webp'
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'takeoff' | 'sent'>('idle');
  const [mounted, setMounted] = useState(false);

  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    emailSendMode?: EmailSendMode;
    newJobsQueued?: number;
    duplicateJobsSkipped?: number;
    sentCount?: number;
    mockedCount?: number;
    dryRunCount?: number;
    failedCount?: number;
    retriedCount?: number;
    skippedCount?: number;
    message?: string;
  } | null>(null);
  const visibleMode = result?.emailSendMode || emailSendMode;
  const visibleModeLabel = visibleMode === 'dry_run' ? 'dry run' : visibleMode;
  const isLive = visibleMode === 'live';

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Cycle images for wing flap
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle flying animation stages and fetch campaign processor
  useEffect(() => {
    if (!isOpen) {
      setAnimationPhase('idle');
      setStatus('idle');
      setErrorMessage(null);
      setResult(null);
      return;
    }

    setAnimationPhase('idle');
    setStatus('sending');

    const startTime = Date.now();

    // 1. Start takeoff / flying to the right after 600ms
    const takeoffTimer = setTimeout(() => {
      setAnimationPhase('takeoff');
    }, 600);

    let isSubscribed = true;

    // 2. Perform API call to force process campaigns
    fetch('/api/send?force=true')
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isSubscribed) return;

        // Ensure the takeoff animation runs for at least 1.4s total before showing success
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1400 - elapsed);

        setTimeout(() => {
          if (!isSubscribed) return;
          setResult(data);
          setAnimationPhase('sent');
          setStatus('success');
        }, remaining);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error('[Outreach Send] Error triggering queue:', err);
        setErrorMessage(err.message || 'Falha ao processar campanha');
        setStatus('error');
      });

    return () => {
      isSubscribed = false;
      clearTimeout(takeoffTimer);
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-[6px] transition-all">
      {/* Inline styles for takeoff keyframes */}
      <style>{`
        @keyframes flyRight {
          0% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
          }
          20% {
            transform: translate(-55%, -45%) scale(1.05) rotate(-5deg);
            opacity: 1;
          }
          100% {
            transform: translate(320px, -180px) scale(0.4) rotate(15deg);
            opacity: 0;
          }
        }
        .animate-pigeon-fly {
          animation: flyRight 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      <div className="relative w-full max-w-md bg-white rounded-3xl border border-[#D8E0EA] p-8 shadow-2xl overflow-hidden mx-4 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#475569]/60 hover:text-[#002B6A] hover:bg-[#EAF2FF] p-1.5 rounded-full transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Animation Container */}
        <div className="relative w-full h-40 bg-[#EAF2FF]/50 border border-[#D8E0EA]/40 rounded-2xl flex items-center justify-center overflow-hidden mb-6">
          
          {/* Animated Pigeon */}
          {animationPhase !== 'sent' && status !== 'error' && (
            <div
              className={`absolute top-1/2 left-1/2 ${
                animationPhase === 'takeoff' ? 'animate-pigeon-fly' : '-translate-x-1/2 -translate-y-1/2'
              }`}
            >
              <img
                src={images[currentIndex]}
                alt="Pigeon flying"
                className="w-20 h-20 object-contain mix-blend-multiply"
              />
            </div>
          )}

          {/* Success Checkmark Indicator (fades in) */}
          <div
            className={`absolute transition-all duration-500 scale-75 transform ${
              status === 'success' ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
            } flex flex-col items-center justify-center`}
          >
            <div className="h-16 w-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-2">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>
          </div>

          {/* Error Indicator (fades in) */}
          <div
            className={`absolute transition-all duration-500 scale-75 transform ${
              status === 'error' ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
            } flex flex-col items-center justify-center`}
          >
            <div className="h-16 w-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 mb-2">
              <X className="h-8 w-8 stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Message and Status */}
        <div className="space-y-2 min-h-[120px] flex flex-col justify-center items-center">
          {status === 'success' ? (
            <div className="animate-loading-delay space-y-3 w-full">
              <h3 className="text-xl font-bold text-[#002B6A]">Disparo Concluído!</h3>
              
              <div className="text-xs text-[#475569] space-y-1.5 bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left max-w-sm mx-auto shadow-sm">
                <div className={`flex justify-between rounded-lg px-2 py-1 font-bold ${
                  isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  <span>Modo de envio:</span>
                  <strong className="uppercase">{visibleModeLabel}</strong>
                </div>
                {result?.newJobsQueued !== undefined && (
                  <div className="flex justify-between">
                    <span>E-mails enfileirados:</span>
                    <strong className="text-[#002B6A]">{result.newJobsQueued}</strong>
                  </div>
                )}
                {result?.duplicateJobsSkipped !== undefined && result.duplicateJobsSkipped > 0 && (
                  <div className="flex justify-between">
                    <span>Duplicados ignorados:</span>
                    <strong className="text-slate-500">{result.duplicateJobsSkipped}</strong>
                  </div>
                )}
                {result?.sentCount !== undefined && (
                  <div className="flex justify-between">
                    <span>E-mails enviados:</span>
                    <strong className="text-emerald-600">{result.sentCount}</strong>
                  </div>
                )}
                {result?.mockedCount !== undefined && (
                  <div className="flex justify-between">
                    <span>E-mails mockados:</span>
                    <strong className="text-amber-600">{result.mockedCount}</strong>
                  </div>
                )}
                {result?.dryRunCount !== undefined && (
                  <div className="flex justify-between">
                    <span>Dry runs:</span>
                    <strong className="text-amber-600">{result.dryRunCount}</strong>
                  </div>
                )}
                {result?.failedCount !== undefined && result.failedCount > 0 && (
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-rose-500">
                    <span>Falhas no envio:</span>
                    <strong>{result.failedCount}</strong>
                  </div>
                )}
                {result?.retriedCount !== undefined && result.retriedCount > 0 && (
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-amber-600">
                    <span>Retentativas agendadas:</span>
                    <strong>{result.retriedCount}</strong>
                  </div>
                )}
                {result?.skippedCount !== undefined && result.skippedCount > 0 && (
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-slate-500">
                    <span>Ignorados:</span>
                    <strong>{result.skippedCount}</strong>
                  </div>
                )}
                {result?.message && (
                  <p className="text-[11px] italic text-[#475569]/80 border-t border-slate-100 pt-1.5 text-center mt-1">
                    {result.message}
                  </p>
                )}
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="animate-loading-delay w-full">
              <h3 className="text-xl font-bold text-[#002B6A]">Erro no Processamento</h3>
              <p className="text-xs text-[#475569] mt-1">
                Não foi possível executar a campanha ou processar a fila.
              </p>
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3.5 rounded-2xl mt-3 max-w-sm mx-auto leading-normal text-left font-medium">
                <strong>Detalhes do erro:</strong><br />
                {errorMessage}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-[#002B6A] flex items-center justify-center gap-2">
                <Send className="h-4.5 w-4.5 text-[#2D6BFF] animate-pulse" />
                <span>Processando campanhas...</span>
              </h3>
              <p className="text-xs text-[#475569] mt-1.5 leading-normal max-w-xs mx-auto">
                Buscando campanhas ativas, gerando destinatários e transmitindo via SMTP.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#002B6A] hover:bg-[#001D47] text-white text-xs font-bold rounded-xl transition-all"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

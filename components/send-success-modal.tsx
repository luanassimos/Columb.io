'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Check, X } from 'lucide-react';
import type { EmailSendMode } from '@/lib/email-mode';

interface SendSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSendMode?: EmailSendMode;
  campaignId?: string;
}

const FLY_FRAMES = [
  '/fly01.webp',
  '/fly02.webp',
  '/fly03.webp',
  '/fly02.webp',
];

export default function SendSuccessModal({ isOpen, onClose, campaignId }: SendSuccessModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'takeoff' | 'sent'>('idle');
  const [mounted, setMounted] = useState(false);

  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Cycle images for wing flap
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % FLY_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle flying animation stages and fetch campaign processor
  useEffect(() => {
    if (!isOpen) {
      setAnimationPhase('idle');
      setStatus('idle');
      return;
    }

    setAnimationPhase('idle');
    setStatus('sending');

    let isSubscribed = true;

    // 2. Perform API call to force process campaigns
    const url = campaignId ? `/api/send?force=true&campaign_id=${campaignId}` : '/api/send?force=true';
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then(() => {
        if (!isSubscribed) return;

        // Start flight animation upon successful request completion
        setAnimationPhase('takeoff');

        // Let the takeoff animation run for 1s (matching keyframes duration) before showing success state
        setTimeout(() => {
          if (!isSubscribed) return;
          setAnimationPhase('sent');
          setStatus('success');

          // Auto-close modal 1.5 seconds after success checkmark appears
          setTimeout(() => {
            if (isSubscribed) {
              onClose();
            }
          }, 1500);
        }, 1000);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error('[Outreach Send] Error triggering queue:', err);
        setStatus('error');
      });

    return () => {
      isSubscribed = false;
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

        /* Light CSS Clouds */
        .cloud {
          background: #ffffff;
          border-radius: 100px;
          position: absolute;
          width: 80px;
          height: 25px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
        }
        .cloud::after, .cloud::before {
          content: '';
          position: absolute;
          background: #ffffff;
          z-index: -1;
        }
        .cloud::after {
          width: 35px;
          height: 35px;
          top: -15px;
          left: 10px;
          border-radius: 100px;
        }
        .cloud::before {
          width: 45px;
          height: 45px;
          top: -25px;
          right: 10px;
          border-radius: 100px;
        }

        @keyframes drift {
          0% { transform: translateX(260px); }
          100% { transform: translateX(-160px); }
        }
        .cloud-1 {
          animation: drift 25s linear infinite;
        }
        .cloud-2 {
          animation: drift 15s linear infinite;
        }
        .cloud-3 {
          animation: drift 35s linear infinite;
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
        <div className="relative w-full h-40 bg-gradient-to-b from-[#EAF2FF] to-[#D5E3FC] border border-[#D8E0EA]/40 rounded-2xl flex items-center justify-center overflow-hidden mb-6">
          {/* Drifting Clouds */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
            <div className="cloud cloud-1 top-6 scale-75 opacity-80" style={{ left: '-80px', animationDelay: '0s' }}></div>
            <div className="cloud cloud-2 top-16 scale-50 opacity-60" style={{ left: '-80px', animationDelay: '-5s' }}></div>
            <div className="cloud cloud-3 top-4 scale-[0.6] opacity-75" style={{ left: '-80px', animationDelay: '-12s' }}></div>
          </div>
          
          {/* Animated Pigeon */}
          {animationPhase !== 'sent' && status !== 'error' && (
            <div
              className={`absolute top-1/2 left-1/2 ${
                animationPhase === 'takeoff' ? 'animate-pigeon-fly' : '-translate-x-1/2 -translate-y-1/2'
              }`}
            >
              <Image
                src={FLY_FRAMES[currentIndex]}
                alt="Pigeon flying"
                width={80}
                height={80}
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



        {/* Bottom Actions */}
        <div className="mt-6">
          {status === 'sending' ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
          ) : status === 'error' ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

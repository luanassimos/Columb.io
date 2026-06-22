'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { RefreshCw } from 'lucide-react';
import SendSuccessModal from './send-success-modal';

const FLY_FRAMES = [
  '/fly01.webp',
  '/fly02.webp',
  '/fly03.webp',
  '/fly02.webp',
];

export default function FlyLoadingCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % FLY_FRAMES.length);
    }, 150); // 150ms per frame for a balanced wing flap/animation

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card rounded-2xl border border-[#D8E0EA] p-6 text-center max-w-sm mx-auto shadow-sm flex flex-col items-center justify-center space-y-4 bg-white/60 backdrop-blur-sm w-full">
      <div className="relative w-36 h-36 flex items-center justify-center overflow-hidden bg-[#EAF2FF] rounded-full border border-[#D8E0EA]/60">
        <Image
          src={FLY_FRAMES[currentIndex]}
          alt="Outbound Animation"
          width={96}
          height={96}
          className="w-24 h-24 object-contain transition-all duration-150 transform hover:scale-105 mix-blend-multiply"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2 text-[#002B6A] font-bold">
          <RefreshCw className="h-4 w-4 animate-spin text-[#2D6BFF]" />
          <span>Fila de Disparo Ativa</span>
        </div>
        <p className="text-[11px] text-[#475569] max-w-[240px] leading-relaxed">
          Simulação de atividade de envio em segundo plano. As mensagens estão sendo processadas pelas regras de workspace.
        </p>
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-1 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white text-[11px] font-bold rounded-lg transition-all shadow-sm cursor-pointer w-full"
      >
        Simular Envio (Testar Animação)
      </button>

      <SendSuccessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

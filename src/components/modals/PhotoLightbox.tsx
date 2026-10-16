import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';
import { isPdf } from '../../lib/utils';

export const PhotoLightbox = ({
  selectedFullImage,
  setSelectedFullImage
}: any) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {selectedFullImage && (
        <div
          key="lightbox-bg"
          className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 p-4 sm:p-6 backdrop-blur-xs"
          style={{ zIndex: 99999 }}
          onClick={() => setSelectedFullImage(null)}
        >
          <div
            className="w-full max-w-6xl flex items-center justify-end gap-3 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={selectedFullImage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors"
            >
              <ExternalLink size={15} />
              Abrir em Nova Aba
            </a>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-bold transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFullImage(null);
              }}
            >
              <X size={16} />
              Fechar (Esc)
            </button>
          </div>

          {isPdf(selectedFullImage) ? (
            <iframe
              src={selectedFullImage}
              title="Documento PDF"
              className="w-full max-w-6xl h-[82vh] bg-white rounded-xl shadow-2xl border border-zinc-700"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={selectedFullImage}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl bg-zinc-950/40"
              alt="Ficha Ampliada"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};


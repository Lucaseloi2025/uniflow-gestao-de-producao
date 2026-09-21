import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const PhotoLightbox = ({
  selectedFullImage,
  setSelectedFullImage
}: any) => {
  return (
    <AnimatePresence>
      {selectedFullImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedFullImage(null)}>
          <button 
            className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFullImage(null);
            }}
          >
            <X size={32} />
          </button>
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            src={selectedFullImage}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            alt="Ampliada"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

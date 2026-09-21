import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';

export const InfoModal = ({ isOpen, onClose, title, description }: { isOpen: boolean, onClose: () => void, title: string, description: string }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-4 text-indigo-600">
            <AlertCircle size={28} />
            <h3 className="text-xl font-bold">{title}</h3>
          </div>
          
          <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
          
          <button
            onClick={onClose}
            className="w-full mt-6 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
          >
            Entendi
          </button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

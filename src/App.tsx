import React from 'react';
import { Phone, MessageCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-stone-800/30 rounded-full blur-3xl pointer-events-none" />

      <motion.main
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-stone-900/90 border border-stone-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10 text-center space-y-8"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono uppercase tracking-widest">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>Mensaje Directo</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 leading-relaxed sm:leading-snug tracking-tight font-display">
            Lo defendiste a él antes de ver nuestra relación.
          </h1>
          <p className="text-lg sm:text-xl font-medium text-amber-200/90 tracking-wide font-display">
            Llama a Alberto, Paola.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="tel:"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-black text-sm rounded-2xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            <Phone className="w-5 h-5 text-stone-950" />
            <span>Llamar a Alberto</span>
          </a>

          <a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5 text-emerald-400" />
            <span>Enviar Mensaje</span>
          </a>
        </div>

        <div className="pt-6 border-t border-stone-800/80 text-stone-500 text-xs font-mono">
          <span>Comunicación Directa</span>
        </div>
      </motion.main>
    </div>
  );
}

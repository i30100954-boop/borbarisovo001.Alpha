import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { DialogueSequence } from '../types/game';

interface DialogueBoxProps {
  dialogue: DialogueSequence;
  lineIndex: number;
  onAdvance: () => void;
}

export function DialogueBox({ dialogue, lineIndex, onAdvance }: DialogueBoxProps) {
  const current = dialogue.lines[lineIndex];
  const isLast = lineIndex >= dialogue.lines.length - 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
        e.preventDefault();
        onAdvance();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onAdvance]);

  if (!current) return null;

  const buttonText = isLast
    ? dialogue.actionLabel || 'Закрыть'
    : 'Дальше';

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-40 px-4 pointer-events-none flex justify-center"
      role="dialog"
      aria-live="polite"
      aria-label={`Диалог: ${current.speaker.name}`}
    >
      <div className="pointer-events-auto w-full max-w-3xl bg-[#111B2B]/95 border border-slate-600/70 rounded-xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-4">
          {/* Portrait or clean monogram */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-slate-800 border border-slate-600/60 shrink-0 flex items-center justify-center">
            {current.speaker.portrait ? (
              <img
                src={current.speaker.portrait}
                alt={current.speaker.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className="font-display text-2xl font-extrabold"
                style={{ color: current.speaker.accentColor }}
              >
                {current.speaker.name.slice(0, 1)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="font-display font-bold"
                  style={{ color: current.speaker.accentColor }}
                >
                  {current.speaker.name}
                </span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-xs text-slate-400">{current.speaker.role}</span>
              </div>
              <span className="font-mono-nums text-xs text-slate-400">
                {lineIndex + 1} / {dialogue.lines.length}
              </span>
            </div>

            <p className="text-sm sm:text-base text-slate-100 leading-relaxed mt-2">
              {current.text}
            </p>

            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Нажми Space / E или кнопку справа
              </span>
              <button
                type="button"
                onClick={onAdvance}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
              >
                <span>{buttonText}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

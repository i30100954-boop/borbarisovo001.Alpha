import { useState } from 'react';
import { Dumbbell, Flame, Footprints, Home, Shield, Skull, Swords, X } from 'lucide-react';
import { TrainingConfig, TrainingStartTarget } from '../types/game';

interface TrainingModalProps {
  initialHardcore: boolean;
  onConfirm: (config: TrainingConfig) => void;
  onClose: () => void;
}

export function TrainingModal({
  initialHardcore,
  onConfirm,
  onClose,
}: TrainingModalProps) {
  const [hardcore, setHardcore] = useState(initialHardcore);
  const [startTarget, setStartTarget] = useState<TrainingStartTarget>('PHASE1');

  const handleToggleHardcore = (nextHardcore: boolean) => {
    setHardcore(nextHardcore);
    if (!nextHardcore && startTarget === 'PHASE3') {
      setStartTarget('PHASE2');
    }
  };

  const handleSelectTarget = (target: TrainingStartTarget) => {
    if (target === 'PHASE3' && !hardcore) {
      setHardcore(true);
    }
    setStartTarget(target);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080E1A]/90 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Настройка режима тренировки"
    >
      <div className="w-full max-w-3xl bg-[#131F33] border border-slate-600/80 rounded-xl overflow-hidden shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-700/70 bg-[#101929]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Главное меню"
              title="Главное меню"
              className="inline-flex items-center gap-1.5 bg-[#1A283F] hover:bg-slate-700/70 border border-slate-700/60 hover:border-amber-400/70 rounded-lg px-3 py-2 text-slate-200 hover:text-amber-300 font-display font-bold text-xs transition-colors shrink-0 whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Меню</span>
            </button>
            <Dumbbell className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-50">
                Тренировка против Димы
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Выбери сложность, стартовую фазу или сразу отработку добивки ногой
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
            aria-label="Вернуться в главное меню"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Difficulty Selector */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              01. Сложность босса
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggleHardcore(false)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  !hardcore
                    ? 'bg-sky-950/60 border-sky-400 text-slate-50'
                    : 'bg-[#0B1320] border-slate-700/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-base text-sky-300">
                    Обычный режим
                  </span>
                  <span className="font-mono-nums text-xs font-bold text-slate-300">
                    5000 HP · 2 фазы
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Классическая скорость Димы, AIZO в 1-й фазе и sans v2 во 2-й фазе.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleToggleHardcore(true)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  hardcore
                    ? 'bg-rose-950/60 border-rose-400 text-slate-50'
                    : 'bg-[#0B1320] border-slate-700/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display font-bold text-base text-rose-300">
                    <Flame className="w-4 h-4" />
                    ХАРДКОР
                  </span>
                  <span className="font-mono-nums text-xs font-bold text-rose-200">
                    9000 HP · 3 фазы
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Бронепластины, быстрый бег, Jane! на 5000 HP (+20% урон) и вертушка проводом в 3-й фазе.
                </p>
              </button>
            </div>
          </div>

          {/* Start Phase / Stomp Finisher Selector */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              02. Стартовая фаза или добивка
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectTarget('PHASE1')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  startTarget === 'PHASE1'
                    ? 'bg-sky-950/55 border-sky-400'
                    : 'bg-[#0B1320] border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 font-display font-bold text-sm text-sky-300">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Фаза 1 ({hardcore ? '9000 HP' : '5000 HP'})</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Старт с самого начала боя: кастрюля на голове, музыка AIZO, сестра и прыжок.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTarget('PHASE2')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  startTarget === 'PHASE2'
                    ? 'bg-amber-950/55 border-amber-400'
                    : 'bg-[#0B1320] border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 font-display font-bold text-sm text-amber-300">
                  <Flame className="w-4 h-4 shrink-0" />
                  <span>
                    Фаза 2 ({hardcore ? '5000 HP · Jane!' : 'Last Breath · 1500 стамины'})
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {hardcore
                    ? 'Дима сбрасывается до 5000 HP, включает Jane! и получает +20% урона.'
                    : 'Шлем сразу сбит, играет sans v2 — отработка уклонений, лазеров и тарана.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTarget('PHASE3')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  startTarget === 'PHASE3'
                    ? 'bg-rose-950/60 border-rose-400'
                    : 'bg-[#0B1320] border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-display font-bold text-sm text-rose-300">
                    <Skull className="w-4 h-4 shrink-0" />
                    <span>Фаза 3 (ХАРДКОР)</span>
                  </div>
                  {!hardcore && (
                    <span className="text-[10px] font-bold text-rose-300">
                      Включит Хардкор
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Последний вздох в Хардкоре: 1 HP, 1500 стамины, sans v2, +20% урон и круговой провод.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTarget('STOMP')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  startTarget === 'STOMP'
                    ? 'bg-emerald-950/55 border-emerald-400'
                    : 'bg-[#0B1320] border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 font-display font-bold text-sm text-emerald-300">
                  <Footprints className="w-4 h-4 shrink-0" />
                  <span>Добивка Димы ногой</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Дима уже на 1 HP и 0 стамины прямо перед тобой — жми [F] или ЛКМ для добивки!
                </p>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Выбрано:{' '}
              <strong className={hardcore ? 'text-rose-300' : 'text-sky-300'}>
                {hardcore ? 'ХАРДКОР' : 'Обычный'}
              </strong>{' '}
              ·{' '}
              <strong className="text-slate-100">
                {startTarget === 'PHASE1'
                  ? 'Фаза 1'
                  : startTarget === 'PHASE2'
                  ? 'Фаза 2'
                  : startTarget === 'PHASE3'
                  ? 'Фаза 3'
                  : 'Добивка ногой'}
              </strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors whitespace-nowrap"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => onConfirm({ hardcore, startTarget })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
              >
                <Swords className="w-4 h-4" />
                <span>Выбрать бойца и начать</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

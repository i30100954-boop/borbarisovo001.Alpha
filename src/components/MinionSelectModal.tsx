import { ArrowLeft, Bird, Flame, Heart, Home, Sparkles, Swords, X } from 'lucide-react';
import { FighterId, GameProgress, MinionId } from '../types/game';

interface MinionSelectModalProps {
  fighter: FighterId;
  progress: GameProgress;
  onSelectMinion: (minion: MinionId) => void;
  onBack: () => void;
  onClose: () => void;
}

export function MinionSelectModal({
  fighter,
  progress,
  onSelectMinion,
  onBack,
  onClose,
}: MinionSelectModalProps) {
  const fighterLabel =
    fighter === 'LUPIK'
      ? progress.lupikGilbertSkin
        ? 'Лупик · Гилберт'
        : 'Лупик'
      : fighter === 'EGOR'
      ? progress.egorPickleSkin
        ? 'Егор · Огурчик'
        : 'Егор'
      : progress.artemTankSkin
      ? 'Артём · Королевский тигр'
      : 'Артём';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080E1A]/90 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Выбор миньона для 3D боя с Димой"
    >
      <div className="w-full max-w-4xl bg-[#131F33] border border-slate-600/80 rounded-xl overflow-hidden shadow-2xl my-auto">
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
            <Swords className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-50 truncate">
                Выбери миньона-помощника против Димы {progress.hardcore ? '(ХАРДКОР · 9000 HP)' : ''}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Выбран боец: <strong className="text-sky-300">{fighterLabel}</strong> · Приказы в бою на [3] и [4] · Прыжок на [Пробел]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад к бойцам</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Minion 1: ИЛИХЕ (Толстый Луффи) */}
          <div className="bg-[#0B1320] border border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
                <div className="w-16 h-16 rounded-lg bg-red-950/70 border border-yellow-500/60 flex items-center justify-center shrink-0">
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg text-yellow-300">
                    ИЛИХЕ
                  </div>
                  <div className="text-xs text-amber-400 font-semibold mt-0.5">
                    Скин: Толстый Луффи (One Piece)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Танковый урон пузом · Фруктовый хил
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Flame className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-100">[3] Удар большим пузом:</strong> Разбегается и влетает пузом в Диму, нанося{' '}
                    <strong className="font-mono-nums text-yellow-300">100 урона</strong> (КД <span className="font-mono-nums">30 сек</span>, во 2-й фазе <span className="font-mono-nums">6 сек</span>).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Heart className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-100">[4] Бросок фрукта:</strong> Кидает герою фрукт, мгновенно восстанавливая{' '}
                    <strong className="font-mono-nums text-emerald-300">+10% HP</strong> (КД <span className="font-mono-nums">12 сек</span>).
                  </div>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onSelectMinion('ILIHE')}
              className="w-full py-3 px-4 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              Взять ИЛИХЕ в 3D бой
            </button>
          </div>

          {/* Minion 2: Макс (Индюк) */}
          <div className="bg-[#0B1320] border border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
                <div className="w-16 h-16 rounded-lg bg-orange-950/70 border border-orange-500/60 flex items-center justify-center shrink-0">
                  <Bird className="w-8 h-8 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg text-orange-300">
                    Макс · Индюк
                  </div>
                  <div className="text-xs text-orange-400 font-semibold mt-0.5">
                    Скин: Боевой Индюк
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Воздушный налёт клювом · Бафф урона и регена
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Bird className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-100">[3] Налёт и удар клювом:</strong> Подлетает к боссу и бьёт его своим клювом, нанося{' '}
                    <strong className="font-mono-nums text-orange-300">50 урона</strong> (КД <span className="font-mono-nums">25 сек</span>).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Heart className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-100">[4] Бафф герою:</strong> Даёт герою{' '}
                    <strong className="font-mono-nums text-amber-300">+10 урона</strong> на <span className="font-mono-nums">20 сек</span> и реген{' '}
                    <strong className="font-mono-nums text-emerald-300">+1 HP каждые 2 сек</strong> на <span className="font-mono-nums">20 сек</span> (КД <span className="font-mono-nums">20 сек</span>).
                  </div>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onSelectMinion('MAKS')}
              className="w-full py-3 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              Взять Макса (Индюка) в 3D бой
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

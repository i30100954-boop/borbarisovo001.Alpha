import { Check, Home, ShoppingBag, X } from 'lucide-react';
import { ASSETS, GameProgress, PRICES } from '../types/game';

interface ShopModalProps {
  progress: GameProgress;
  onBuyKhrumki: () => void;
  onBuyGazyava: () => void;
  onBuyBoth: () => void;
  onClose: () => void;
}

export function ShopModal({
  progress,
  onBuyKhrumki,
  onBuyGazyava,
  onBuyBoth,
  onClose,
}: ShopModalProps) {
  const bothBought = progress.hasKhrumki && progress.hasGazyava;
  const bothCost = PRICES.KHRUMKI + PRICES.GAZYAVA;
  const canAffordKhrumki = progress.money >= PRICES.KHRUMKI;
  const canAffordGazyava = progress.money >= PRICES.GAZYAVA;
  const canAffordBoth = progress.money >= bothCost;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080E1A]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Магаз Продукты"
    >
      <div className="w-full max-w-2xl bg-[#131F33] border border-slate-600/80 rounded-xl overflow-hidden shadow-2xl">
        {/* Top bar */}
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
            <ShoppingBag className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-50 truncate">
                Магаз «Продукты»
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Тёплый прилавок рядом с домом Борбарисово 001
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">Твой баланс</div>
              <div className="font-mono-nums text-base font-bold text-amber-400">
                {progress.money} коп.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              aria-label="Выйти из магаза"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Artwork */}
            <div className="md:col-span-5 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/60">
              <img
                src={ASSETS.SHOP_SNACKS}
                alt="Хрумки и газява на прилавке"
                referrerPolicy="no-referrer"
                className="w-full h-44 md:h-full object-cover"
              />
            </div>

            {/* Product list */}
            <div className="md:col-span-7 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                {/* Item 1: Хрумки */}
                <div className="bg-[#0B1320] border border-slate-700/70 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-display font-bold text-base text-slate-100">
                      Хрумки (Чипсы)
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Рифлёные, с солью и хрустом на весь подъезд
                    </div>
                  </div>
                  {progress.hasKhrumki ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 whitespace-nowrap shrink-0">
                      <Check className="w-4 h-4" />
                      Куплено
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAffordKhrumki}
                      onClick={onBuyKhrumki}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-mono-nums text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      Купить · {PRICES.KHRUMKI} коп.
                    </button>
                  )}
                </div>

                {/* Item 2: Газява */}
                <div className="bg-[#0B1320] border border-slate-700/70 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-display font-bold text-base text-slate-100">
                      Газява (Газировка)
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Ледяная бутылка, шипит как зимний ветер
                    </div>
                  </div>
                  {progress.hasGazyava ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 whitespace-nowrap shrink-0">
                      <Check className="w-4 h-4" />
                      Куплено
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAffordGazyava}
                      onClick={onBuyGazyava}
                      className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-mono-nums text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                    >
                      Купить · {PRICES.GAZYAVA} коп.
                    </button>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                {!progress.hasKhrumki && !progress.hasGazyava ? (
                  <button
                    type="button"
                    disabled={!canAffordBoth}
                    onClick={onBuyBoth}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    Взять всё сразу · {bothCost} коп.
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">
                    {bothBought
                      ? 'Всё взято! Пора возвращаться всем вместе домой.'
                      : 'Осталось докупить второй товар.'}
                  </span>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    bothBought
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-display'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {bothBought ? 'Идти с братвой домой' : 'Выйти'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

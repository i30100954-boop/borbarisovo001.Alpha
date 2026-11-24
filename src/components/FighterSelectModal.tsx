import { Crosshair, Home, Shield, Swords, X } from 'lucide-react';
import { ASSETS, FighterId, GameProgress } from '../types/game';

interface FighterSelectModalProps {
  progress: GameProgress;
  isBossRush?: boolean;
  isTraining?: boolean;
  bossId?: 'DIMA' | 'WILD_CUCUMBER';
  onSelectFighter: (fighter: FighterId) => void;
  onClose: () => void;
}

export function FighterSelectModal({
  progress,
  isBossRush = false,
  isTraining = false,
  bossId = 'DIMA',
  onSelectFighter,
  onClose,
}: FighterSelectModalProps) {
  const artemHp = progress.artemTankSkin ? 200 : 100;
  const artemBonusDmg = progress.artemTankSkin ? 8 : 0;
  const isWild = bossId === 'WILD_CUCUMBER';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080E1A]/90 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isWild ? 'Выбор бойца перед 3D ПВП с Wild Огурцом' : 'Выбор бойца перед 3D ПВП с Димой'}
    >
      <div className="w-full max-w-5xl bg-[#131F33] border border-slate-600/80 rounded-xl overflow-hidden shadow-2xl my-auto">
        {/* Header */}
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
            <Swords className={`w-5 h-5 shrink-0 ${isWild ? 'text-purple-400' : 'text-rose-400'}`} />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-50 truncate">
                {isTraining ? 'Тренировка · ' : isBossRush ? 'Boss Rush · ' : ''}
                {isWild
                  ? 'Выбери бойца против Wild Огурца'
                  : `Выбери бойца для 3D ПВП с Димой ${progress.hardcore ? '· ХАРДКОР' : ''}`}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {isWild
                  ? 'Wild Огурец (10 000 HP · 3 фазы · Through Patches of Violet) · Далее выбор миньона (ИЛИХЕ / Макс) · Скины F1 / F2 / F3'
                  : `Дима · Кастрюльный Рыцарь (${progress.hardcore ? '9000 HP · Броня · 3 фазы' : '5000 HP'}) · Далее выбор миньона (ИЛИХЕ / Макс) · Скины F1 / F2 / F3`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
            aria-label={isBossRush || isTraining ? 'Назад' : 'Вернуться назад'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Fighters Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* Fighter 1: Лупик */}
          <div className="bg-[#0B1320] border border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <img
                  src={progress.lupikGilbertSkin ? ASSETS.PORTRAIT_GILBERT : ASSETS.PORTRAIT_LUPIK}
                  alt={progress.lupikGilbertSkin ? 'Лупик · Гилберт' : 'Лупик'}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-600/60 shrink-0"
                />
                <div>
                  <div className="font-display font-bold text-base text-sky-300">
                    {progress.lupikGilbertSkin ? 'Лупик · Гилберт' : 'Лупик'}
                  </div>
                  <div className="font-mono-nums text-xs text-emerald-400 font-semibold mt-0.5">
                    100 HP · Быстрый стрелок
                  </div>
                  <div className="text-[11px] text-slate-400">
                    F3: {progress.lupikGilbertSkin ? 'Гилберт (активен)' : 'Обычный скин'}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                <li>
                  <strong className="text-slate-100">ЛКМ — Дробовик:</strong> 25 урона, перезарядка 2 сек, высокая скорость.
                </li>
                <li>
                  <strong className="text-amber-300">Способка 2 (ПКМ / 2) — Разъярённый Гилберт:</strong> Бежит с ножом на Диму и режет ему пузо на <strong>100 урона</strong> + хилит себе <strong>30 HP</strong> (КД 30 сек).
                </li>
                <li>
                  <strong className="text-rose-400">Ульта (Q) — Rage:</strong> x2 урон (50 урона) и ускорение бега на 8 сек.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onSelectFighter('LUPIK')}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              Выбрать Лупика → Миньон
            </button>
          </div>

          {/* Fighter 2: Егор */}
          <div className="bg-[#0B1320] border border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div
                  className={`w-14 h-14 rounded-lg flex items-center justify-center font-display text-xl font-extrabold border shrink-0 ${
                    progress.egorPickleSkin
                      ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {progress.egorPickleSkin ? 'ОГ' : 'ЕГ'}
                </div>
                <div>
                  <div className="font-display font-bold text-base text-amber-300">
                    {progress.egorPickleSkin ? 'Егор · Огурчик' : 'Егор'}
                  </div>
                  <div className="font-mono-nums text-xs text-emerald-400 font-semibold mt-0.5">
                    100 HP · Огуречный темповик
                  </div>
                  <div className="text-[11px] text-slate-400">
                    F2: {progress.egorPickleSkin ? 'Огурчик (активен)' : 'Обычный скин'}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                <li>
                  <strong className="text-slate-100">ЛКМ / 2 — Шашлык / Огурец:</strong> Шашлык наносит <strong>32 урона</strong> (КД 1.1с, до 5 шт.); когда шашлык кончается — бесконечные огурцы по <strong>16 урона</strong> (КД 0.85с).
                </li>
                <li>
                  <strong className="text-amber-300">Способка 1 (ПКМ / 1) — Собака-шашлычница:</strong> Пёс кусает босса (<strong>25 урона</strong>), возвращается с <strong>+3 шашлыками</strong> и огурцом (<strong>+15 HP</strong>, КД 14с).
                </li>
                <li>
                  <strong className="text-emerald-400">Ульта (Q) — Радар-пёс &amp; Рассол:</strong> 8с замедления босса (-15%), +20% урона, а каждое <strong>4-е попадание ЛКМ</strong> роняет с неба солёный огурец (<strong>40 урона</strong>, до 2 раз).
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onSelectFighter('EGOR')}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              Выбрать Егора → Миньон
            </button>
          </div>

          {/* Fighter 3: Артём */}
          <div className="bg-[#0B1320] border border-slate-700/70 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div
                  className={`w-14 h-14 rounded-lg flex items-center justify-center font-display text-xl font-extrabold border shrink-0 ${
                    progress.artemTankSkin
                      ? 'bg-amber-950 border-amber-400/70 text-amber-300'
                      : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  {progress.artemTankSkin ? 'KT' : 'АР'}
                </div>
                <div>
                  <div className="font-display font-bold text-base text-emerald-300">
                    {progress.artemTankSkin ? 'Артём · Королевский тигр' : 'Артём'}
                  </div>
                  <div className="font-mono-nums text-xs text-emerald-400 font-semibold mt-0.5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{artemHp} HP · +{artemBonusDmg} урона</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    F1: {progress.artemTankSkin ? 'Королевский тигр (активен)' : 'Обычный скин'}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                <li>
                  <strong className="text-slate-100">ЛКМ / 2 — 88-мм орудие:</strong> <strong>{52 + artemBonusDmg} урона</strong>, КД 3.0 сек (серия точных попаданий ускоряет перезарядку до 2.2 сек).
                </li>
                <li>
                  <strong className="text-emerald-300">Способка 1 (ПКМ / 1) — Броня «Ромб» и ремонт:</strong> 3.5 сек снижает входящий урон на <strong>60%</strong>, чинит <strong>+20 HP</strong> и бьёт гусеницами вблизи (<strong>30 урона</strong>, КД 15с).
                </li>
                <li>
                  <strong className="text-amber-400">Ульта (Q) — Арт-корректировка «67001»:</strong> Копится за 260 урона с ЛКМ; 3 точных снаряда с неба (<strong>315 урона</strong>) и замедление босса (-20% на 4с).
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onSelectFighter('ARTEM')}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Crosshair className="w-4 h-4" />
              <span>Выбрать Артёма → Миньон</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

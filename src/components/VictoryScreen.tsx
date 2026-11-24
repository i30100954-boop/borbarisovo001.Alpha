import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Dumbbell,
  Flame,
  Heart,
  Home,
  Lock,
  Package,
  RotateCcw,
  Shield,
  ShoppingBag,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react';
import { ASSETS, GameProgress, TrainingStartTarget } from '../types/game';
import {
  AchievementDefinition,
  AchievementIconKey,
  AchievementRarity,
  evaluateAchievements,
} from '../utils/achievements';

interface VictoryScreenProps {
  progress: GameProgress;
  isBossRush?: boolean;
  isTraining?: boolean;
  trainingTarget?: TrainingStartTarget | null;
  bossId?: 'DIMA' | 'WILD_CUCUMBER';
  onPlayAgain: () => void;
  onBossRushAgain?: () => void;
  onBackToMenu?: () => void;
}

const RARITY_STYLES: Record<
  AchievementRarity,
  { label: string; card: string; iconBox: string; badge: string }
> = {
  COMMON: {
    label: 'Обычное',
    card: 'bg-[#0B1320] border-emerald-500/40',
    iconBox: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    badge: 'text-emerald-300',
  },
  RARE: {
    label: 'Редкое',
    card: 'bg-[#0B1320] border-amber-500/45',
    iconBox: 'bg-amber-500/15 border-amber-500/45 text-amber-300',
    badge: 'text-amber-300',
  },
  LEGENDARY: {
    label: 'Легендарное',
    card: 'bg-[#0E1324] border-purple-500/55',
    iconBox: 'bg-purple-500/20 border-purple-400/55 text-purple-300',
    badge: 'text-purple-300',
  },
};

function AchievementIcon({ icon, className }: { icon: AchievementIconKey; className?: string }) {
  switch (icon) {
    case 'swords':
      return <Swords className={className} />;
    case 'shopping':
      return <ShoppingBag className={className} />;
    case 'package':
      return <Package className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'wind':
      return <Wind className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'skull':
      return <Skull className={className} />;
  }
}

export function VictoryScreen({
  progress,
  isBossRush = false,
  isTraining = false,
  trainingTarget = null,
  bossId = 'DIMA',
  onPlayAgain,
  onBossRushAgain,
  onBackToMenu,
}: VictoryScreenProps) {
  const [showLocked, setShowLocked] = useState(false);

  const quickMode = isBossRush || isTraining;
  const isWild = bossId === 'WILD_CUCUMBER';
  const trainingTargetLabel =
    trainingTarget === 'CUTSCENE'
      ? '3D-Катсцена'
      : trainingTarget === 'STOMP'
      ? 'Добивка ногой'
      : trainingTarget === 'PHASE3'
      ? 'Фаза 3'
      : trainingTarget === 'PHASE2'
      ? 'Фаза 2'
      : 'Фаза 1';

  const { unlocked, locked, totalForMode } = evaluateAchievements(progress, {
    isBossRush,
    isTraining,
  });

  return (
    <div className="min-h-screen w-full bg-[#0B1320] flex items-center justify-center px-4 py-8 sm:p-6 relative overflow-x-hidden">
      <div className="absolute inset-0">
        <img
          src={ASSETS.TITLE_BACKDROP}
          alt="Вечернее Борбарисово 001"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[#0B1320]/80" />
      </div>

      <div className="relative z-10 w-full max-w-3xl bg-[#131F33] border border-slate-700/70 rounded-xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/60">
          <button
            type="button"
            onClick={onBackToMenu || onPlayAgain}
            aria-label="Главное меню"
            title="Главное меню"
            className="inline-flex items-center gap-1.5 bg-[#1A283F] hover:bg-slate-700/70 border border-slate-700/60 hover:border-amber-400/70 rounded-lg px-3 py-2 text-slate-200 hover:text-amber-300 font-display font-bold text-xs transition-colors shrink-0 whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Меню</span>
          </button>
          <span className="text-xs font-mono-nums text-slate-400">
            {isTraining ? 'Режим тренировки' : isBossRush ? 'Режим Boss Rush' : 'Основной режим'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-700/60">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-amber-500/40">
            <img
              src={ASSETS.PORTRAIT_LUPIK}
              alt="Лупик дома с братвой"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className={`text-xs font-medium mb-1 ${isWild ? 'text-purple-400' : progress.hardcore ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isTraining
                ? `ТРЕНИРОВКА ЗАВЕРШЕНА · ${trainingTargetLabel}`
                : isBossRush
                ? isWild
                  ? 'BOSS RUSH · WILD ОГУРЕЦ ПОВЕРЖЕН!'
                  : progress.hardcore
                  ? 'BOSS RUSH · ХАРДКОР ПРОЙДЕН!'
                  : 'BOSS RUSH ПРОЙДЕН!'
                : progress.hardcore
                ? 'РЕЖИМ ХАРДКОР ПРОЙДЕН! · Подъезд №1, 2 этаж'
                : 'Миссия выполнена · Подъезд №1, 2 этаж'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-50 text-balance">
              {isTraining
                ? `Тренировка (${trainingTargetLabel}) пройдена!`
                : isBossRush
                ? isWild
                  ? 'Wild Огурец (10 000 HP) повержен в Boss Rush!'
                  : progress.hardcore
                  ? 'Хардкорный Дима (9000 HP) повержен в Boss Rush!'
                  : 'Дима (5000 HP) повержен в Boss Rush!'
                : progress.hardcore
                ? 'Легендарный хардкор пройден! Время хрустеть!'
                : 'Все дома! Время хрустеть и пить газяву'}
            </h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              {isTraining
                ? 'Отличная отработка против Димы! Можно выбрать другую фазу, сложность, бойца или вернуться в главное меню.'
                : isBossRush
                ? isWild
                  ? 'Легендарный 3D-замес против Wild Огурца через все 3 фазы и разлом измерений! Можно выбрать другого бойца или вернуться в меню.'
                  : `Отличный 3D замес против Кастрюльного Рыцаря Димы! Можно сразу выбрать другого бойца или миньона и протестировать новую связку.`
                : `${progress.lupikGilbertSkin ? 'Лупик (Гилберт)' : 'Лупик'}, ${
                    progress.egorPickleSkin ? 'Егор (Огурчик)' : 'Егор'
                  } и ${
                    progress.artemTankSkin ? 'Артём (Королевский тигр)' : 'Артём'
                  } прошли морозный вечер достойно: отжали лавеху у Главного Нефора, закупились в магазе, одолели Диму в 3D ПВП и вернулись домой.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-700/60">
          {quickMode ? (
            <>
              <div>
                <div className="text-xs text-slate-400">Режим</div>
                <div className={`font-display text-lg font-bold mt-1 ${isTraining ? 'text-emerald-300' : isWild ? 'text-purple-300' : 'text-sky-300'}`}>
                  {isTraining ? 'Тренировка' : 'Boss Rush'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Босс</div>
                <div className={`font-display text-lg font-bold mt-1 ${isWild ? 'text-purple-300' : progress.hardcore ? 'text-rose-400' : 'text-amber-400'}`}>
                  {isWild ? 'Wild Огурец' : progress.hardcore ? 'ХАРДКОР' : 'Обычный'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">{isTraining ? 'Сценарий' : 'HP Босса'}</div>
                <div className="font-mono-nums text-lg font-bold text-slate-100 mt-1">
                  {isTraining ? trainingTargetLabel : `${isWild ? '10000' : progress.hardcore ? '9000' : '5000'} HP`}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">{isWild ? 'Статус Огурца' : 'Статус Димы'}</div>
                <div className="font-display text-lg font-bold text-emerald-400 mt-1">
                  {isWild ? 'Расколот' : 'Втоптан'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-slate-400">Остаток лавехи</div>
                <div className="font-mono-nums text-xl font-bold text-amber-400 mt-1">
                  {progress.money} коп.
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Состав дома</div>
                <div className="font-display text-lg font-bold text-emerald-400 mt-1">
                  3 / 3 пацана
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Трофей из магаза</div>
                <div className="text-sm font-semibold text-slate-100 mt-1.5">
                  Хрумки + Газява
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Точность QTE</div>
                <div className="font-mono-nums text-xl font-bold text-sky-300 mt-1">
                  {progress.qteBestAccuracy}%
                </div>
              </div>
            </>
          )}
        </div>

        {/* Achievements Section */}
        <section className="py-5 border-b border-slate-700/60" aria-label="Достижения прохождения">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="font-display text-base font-bold text-slate-100">
                Достижения прохождения
              </h2>
            </div>

            {!isTraining && (
              <div className="flex items-center gap-3">
                {progress.lastBossStats && (
                  <span className="text-[11px] font-mono-nums text-slate-400">
                    Макс. комбо: x{progress.bestCombo} · Уклонений: {progress.bestDodgeEvades} · Урон по себе:{' '}
                    {progress.lastBossStats.damageTaken}
                  </span>
                )}
                <span className="font-mono-nums text-xs font-bold px-2.5 py-1 rounded-md bg-[#0B1320] border border-amber-500/40 text-amber-300">
                  {unlocked.length} / {totalForMode}
                </span>
              </div>
            )}
          </div>

          {isTraining ? (
            <div className="bg-[#0B1320] border border-slate-700/70 rounded-lg px-4 py-3 text-xs text-slate-400">
              В режиме тренировки достижения не засчитываются — открывай их в Основном режиме или Boss Rush.
            </div>
          ) : (
            <>
              {unlocked.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unlocked.map((ach: AchievementDefinition) => {
                    const st = RARITY_STYLES[ach.rarity];
                    return (
                      <div
                        key={ach.id}
                        className={`rounded-lg border p-3.5 flex items-start gap-3 ${st.card}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${st.iconBox}`}
                        >
                          <AchievementIcon icon={ach.icon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-sm text-slate-100 truncate">
                              {ach.title}
                            </span>
                            <span className={`text-[10px] font-mono-nums font-bold shrink-0 ${st.badge}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-snug">
                            {ach.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#0B1320] border border-slate-700/70 rounded-lg px-4 py-3 text-xs text-slate-400">
                  За это прохождение достижения не открыты.
                </div>
              )}

              {locked.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowLocked((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showLocked ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>
                      {showLocked
                        ? `Скрыть закрытые достижения (${locked.length})`
                        : `Показать, что ещё можно открыть (${locked.length})`}
                    </span>
                  </button>

                  {showLocked && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                      {locked.map((ach) => (
                        <div
                          key={ach.id}
                          className="rounded-lg border border-slate-800 bg-[#0B1320]/60 p-3 flex items-start gap-2.5 opacity-75"
                        >
                          <div className="w-8 h-8 rounded-md bg-slate-800/80 border border-slate-700/70 flex items-center justify-center text-slate-500 shrink-0">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-xs text-slate-300 truncate">
                              {ach.title}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {ach.hint}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <div className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-xs text-slate-400">
            Борбарисово 001 · {quickMode ? 'Быстрая 3D-арена без подъезда и QTE' : 'Хрумки (67 коп.) · Газява (52 коп.) · Отжим (+300 коп.)'}
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {quickMode && onBossRushAgain && (
              <button
                type="button"
                onClick={onBossRushAgain}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
              >
                {isTraining ? <Dumbbell className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
                <span>{isTraining ? 'Настройки тренировки' : 'Сменить бойца / миньона'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onPlayAgain}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{quickMode ? 'В главное меню' : 'Играть снова'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

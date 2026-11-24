import { Dumbbell, Home, RotateCcw, Swords } from 'lucide-react';
import { ASSETS, GameProgress, TrainingStartTarget } from '../types/game';

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

  return (
    <div className="min-h-screen w-full bg-[#0B1320] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={ASSETS.TITLE_BACKDROP}
          alt="Вечернее Борбарисово 001"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[#0B1320]/80" />
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-[#131F33] border border-slate-700/70 rounded-xl p-6 sm:p-8 shadow-2xl">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-slate-700/60">
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

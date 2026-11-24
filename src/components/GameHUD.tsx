import { Home, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { GameProgress, QuestStage, SceneId } from '../types/game';

interface GameHUDProps {
  scene: SceneId;
  progress: GameProgress;
  questStage: QuestStage;
  moneyDelta: { amount: number; id: number } | null;
  muted: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  onBackToMenu?: () => void;
}

function getQuestText(stage: QuestStage, progress: GameProgress): { step: string; title: string } {
  const friendsCount = (progress.egorJoined ? 1 : 0) + (progress.artemJoined ? 1 : 0);
  switch (stage) {
    case 'GATHER_FRIENDS':
      return {
        step: 'Этап 1 из 5',
        title: `Собери друзей на 2 этаже (${friendsCount}/2)`,
      };
    case 'GO_TO_GARAGES':
      return {
        step: 'Этап 2 из 5',
        title: 'Выходи во двор и иди за гаражи к Главному Нефору',
      };
    case 'FIGHT_NEFOR':
      return {
        step: 'Этап 2 из 5',
        title: 'Отбири лавеху у Главного Нефора (QTE)',
      };
    case 'GO_TO_SHOP':
      return {
        step: 'Этап 3 из 5',
        title: 'Зайди в магаз за Хрумками (67 коп.) и Газявой (52 коп.)',
      };
    case 'FIGHT_DIMA':
      return {
        step: 'Этап 4 из 5',
        title: `Иди за магаз и победи Главного Злодея Диму в 3D ПВП (${progress.hardcore ? '9000' : '5000'} HP)`,
      };
    case 'RETURN_HOME':
      return {
        step: 'Этап 5 из 5',
        title: 'Возвращайтесь всем составом домой в Кв. 5 (2 этаж)',
      };
    case 'COMPLETED':
      return {
        step: 'Выполнено',
        title: 'Дима повержен, вся братва дома с хрумками и газявой',
      };
  }
}

export function GameHUD({
  scene,
  progress,
  questStage,
  moneyDelta,
  muted,
  onToggleMute,
  onRestart,
  onBackToMenu,
}: GameHUDProps) {
  const quest = getQuestText(questStage, progress);
  const maxBarMoney = 300;
  const barPercent = Math.max(0, Math.min(100, (progress.money / maxBarMoney) * 100));

  return (
    <header className="w-full bg-[#111B2B] border-b border-slate-700/50 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
        {/* Zone 1: Menu Button + Location & Quest */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              aria-label="Главное меню"
              title="Главное меню"
              className="inline-flex items-center gap-1.5 bg-[#1A283F] hover:bg-slate-700/70 border border-slate-700/60 hover:border-amber-400/70 rounded-lg px-3 py-2 text-slate-200 hover:text-amber-300 font-display font-bold text-xs transition-colors shrink-0 whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Меню</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-sky-300">
                {scene === 'ENTRANCE' ? 'Подъезд №1 · 2 этаж' : 'Борбарисово 001 · Двор'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{quest.step}</span>
              {progress.hardcore && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-rose-400">РЕЖИМ ХАРДКОР</span>
                </>
              )}
            </div>
            <p className="text-sm sm:text-base font-semibold text-slate-100 truncate mt-0.5">
              {quest.title}
            </p>
          </div>
        </div>

        {/* Zone 2: Money Bar ("Бар денег") */}
        <div className="w-full lg:w-72 shrink-0 bg-[#0B1320] border border-slate-700/60 rounded-lg px-3.5 py-2 relative">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Бар денег</span>
            <div className="flex items-center gap-2">
              {moneyDelta && (
                <span
                  key={moneyDelta.id}
                  className={`font-mono-nums text-xs font-bold ${
                    moneyDelta.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {moneyDelta.amount >= 0 ? `+${moneyDelta.amount}` : moneyDelta.amount} коп.
                </span>
              )}
              <span className="font-mono-nums text-sm font-bold text-amber-400">
                {progress.money} / 300 коп.
              </span>
            </div>
          </div>
          <div
            className="h-2.5 w-full bg-slate-800 rounded-sm overflow-hidden border border-slate-700/70"
            role="progressbar"
            aria-valuenow={progress.money}
            aria-valuemin={0}
            aria-valuemax={300}
            aria-label="Бар денег в копейках"
          >
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-300 ease-out"
              style={{ width: `${barPercent}%` }}
            />
          </div>
        </div>

        {/* Zone 3: Squad, Bag & Utility Actions */}
        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
          <div className="text-xs text-slate-300 flex items-center gap-2 whitespace-nowrap">
            <span>
              Братва:{' '}
              <strong className="font-semibold text-slate-100">Лупик</strong>
              {' · '}
              <span className={progress.egorJoined ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                Егор {progress.egorJoined ? '✓' : '—'}
              </span>
              {' · '}
              <span className={progress.artemJoined ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                Артём {progress.artemJoined ? '✓' : '—'}
              </span>
            </span>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">|</span>
            <span className="hidden sm:inline">
              <span className={progress.hasKhrumki ? 'text-amber-300 font-semibold' : 'text-slate-500'}>
                Хрумки {progress.hasKhrumki ? '✓' : '0'}
              </span>
              {' · '}
              <span className={progress.hasGazyava ? 'text-sky-300 font-semibold' : 'text-slate-500'}>
                Газява {progress.hasGazyava ? '✓' : '0'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-[#1A283F] hover:bg-slate-700/70 text-slate-200 border border-slate-700/60 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              title={muted ? 'Включить звук' : 'Выключить звук'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A283F] hover:bg-slate-700/70 text-xs font-medium text-slate-200 border border-slate-700/60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
              title="Начать заново"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сброс</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

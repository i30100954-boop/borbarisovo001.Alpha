import { Dumbbell, Film, Flame, Play, Swords, Wifi } from 'lucide-react';
import { ASSETS } from '../types/game';
import { MultiplayerPanel, MultiplayerPanelProps } from './MultiplayerPanel';

interface TitleScreenProps {
  onStart: (hardcore: boolean) => void;
  onStartBossRush: (hardcore: boolean, bossId?: 'DIMA' | 'WILD_CUCUMBER') => void;
  onStartTraining: () => void;
  onWatchCutscene?: () => void;
  mpClient: MultiplayerPanelProps['client'];
  onOpenLobby?: () => void;
}

export function TitleScreen({
  onStart,
  onStartBossRush,
  onStartTraining,
  onWatchCutscene,
  mpClient,
  onOpenLobby,
}: TitleScreenProps) {
  const scrollToMultiplayer = () => {
    if (mpClient.status === 'CONNECTED' && onOpenLobby) {
      onOpenLobby();
      return;
    }
    const el = document.getElementById('multiplayer-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen w-full bg-[#0B1320] flex flex-col justify-between relative overflow-x-hidden">
      {/* Full-bleed atmospheric winter backdrop */}
      <div className="absolute inset-0">
        <img
          src={ASSETS.TITLE_BACKDROP}
          alt="Зимний двор дома Борбарисово 001"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1320] via-[#0B1320]/75 to-[#0B1320]/50" />
      </div>

      {/* Top clean header line */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
        <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          Борбарисово 001
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-xs text-slate-300 flex items-center gap-2 whitespace-nowrap">
            <span>Зимний район</span>
            <span aria-hidden="true">·</span>
            <span>Подъезд, 2 этаж</span>
            <span aria-hidden="true">·</span>
            <span>Сюжетное приключение</span>
          </div>
          <button
            type="button"
            onClick={scrollToMultiplayer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sky-300 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>
              {mpClient.status === 'CONNECTED'
                ? `В лобби (${mpClient.players.length})`
                : 'Сетевая игра · LAN / Radmin VPN'}
            </span>
          </button>
        </div>
      </header>

      {/* Main focal hero */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-amber-400 mb-3">
              Зима на районе · Главный герой — Лупик
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-50 leading-[1.08] tracking-tight text-balance mb-5">
              Ровный пацан в Борбарисово 001
            </h1>
            <p className="text-base sm:text-lg text-slate-200 max-w-xl leading-relaxed mb-7">
              На улице мороз и снег по колено. Собери Егора и Артёма на своём 2 этаже,
              сходи за гаражи к Главному Нефору на QTE «Отбири лавеху», закупи Хрумки и Газяву в магазе,
              победи Диму в 3D ПВП и вернись с братвой домой.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onStart(false)}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-display font-bold text-base transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20 focus-visible:outline-2 focus-visible:outline-white"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Начать игру</span>
              </button>

              <button
                type="button"
                onClick={() => onStart(true)}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-display font-extrabold text-base border border-rose-300/40 transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-rose-600/30 focus-visible:outline-2 focus-visible:outline-white"
              >
                <Flame className="w-5 h-5" />
                <span>Режим ХАРДКОР</span>
              </button>
            </div>

            {/* Quick Boss Rush & Training Modes */}
            <div className="mt-5 pt-4 border-t border-slate-700/60 max-w-2xl">
              <div className="text-xs font-semibold text-sky-300 mb-2.5 flex items-center gap-2">
                <Swords className="w-4 h-4 shrink-0" />
                <span>Быстрые режимы · Сразу на 3D-арену с Димой или Wild Огурцом (без подъезда и QTE)</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onStartBossRush(false, 'DIMA')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131F33] hover:bg-slate-800 text-sky-300 border border-sky-400/50 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Swords className="w-4 h-4" />
                  <span>Boss Rush · Обычный</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartBossRush(true, 'DIMA')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131F33] hover:bg-rose-950/60 text-rose-300 border border-rose-500/50 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Flame className="w-4 h-4" />
                  <span>Boss Rush · ХАРДКОР</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartBossRush(true, 'WILD_CUCUMBER')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131F33] hover:bg-purple-950/70 text-purple-200 border border-purple-400/60 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white shadow-md shadow-purple-900/30"
                >
                  <Swords className="w-4 h-4 text-purple-300" />
                  <span>Boss Rush · Wild Огурец</span>
                </button>
                <button
                  type="button"
                  onClick={onStartTraining}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131F33] hover:bg-emerald-950/60 text-emerald-300 border border-emerald-400/50 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Dumbbell className="w-4 h-4" />
                  <span>Тренировка (фазы / добивка)</span>
                </button>
                <button
                  type="button"
                  onClick={scrollToMultiplayer}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#131F33] hover:bg-sky-950/60 text-amber-300 border border-amber-400/50 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Создать сервер / Сеть</span>
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-xs sm:text-sm text-slate-300">
              <div>
                Управление: A / D или стрелки · E — действие · в 3D бою [F] Рывок · [Пробел] Прыжок
              </div>
              <div className="text-rose-300 font-medium">
                ХАРДКОР: QTE x2 букв (V B C H J G) · Дима 9000 HP в бронепластинах · 3 фазы (Jane + sans v2) · Вертушка проводом
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#131F33]/90 border border-slate-700/60 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 pb-5 border-b border-slate-700/60">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-600/50">
                  <img
                    src={ASSETS.PORTRAIT_LUPIK}
                    alt="Портрет Лупика"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-100">
                    План на вечер
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Лупик · Егор · Артём
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-3 text-sm text-slate-200">
                <li className="flex items-baseline justify-between gap-3">
                  <span>01. Собрать Егора и Артёма на 2 этаже</span>
                  <span className="font-mono-nums text-xs text-slate-400 shrink-0">Подъезд</span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>02. QTE «Отбири лавеху» у Главного Нефора</span>
                  <span className="font-mono-nums text-xs text-amber-400 shrink-0">+300 коп.</span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>03. Купить Хрумки и Газяву в магазе</span>
                  <span className="font-mono-nums text-xs text-sky-300 shrink-0">67 + 52 коп.</span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>04. Одолеть Диму за магазом и вернуться домой</span>
                  <span className="font-mono-nums text-xs text-rose-400 shrink-0">5000 / 9000 HP</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </main>

      {/* Embedded Host Launcher & LAN / Radmin VPN Connection Section */}
      <section
        id="multiplayer-section"
        className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-6 pt-2"
      >
        <MultiplayerPanel client={mpClient} />
      </section>

      {/* 3D Cutscene Showcase Section (below multiplayer) */}
      {onWatchCutscene && (
        <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-6 pt-0">
          <div className="bg-gradient-to-r from-purple-950/80 via-[#101426]/90 to-purple-950/80 border border-purple-500/50 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-purple-900/60 border border-purple-400/50 flex items-center justify-center shrink-0 shadow-lg text-purple-300">
                <Film className="w-7 h-7" />
              </div>
              <div>
                <div className="font-display font-black text-base sm:text-lg text-purple-100 flex items-center gap-2.5 flex-wrap">
                  <span>3D-Катсцена · Разлом измерений</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/50">
                    23 сек · Through Patches of Violet
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                  Дуэль в профиль: Обыкновенный Огурец против Wild Огурца! Обмен ударами, треск разбитого стекла, фиолетовые молнии и динамическая смена измерений.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onWatchCutscene}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-display font-extrabold text-sm shadow-xl shadow-purple-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 border border-purple-300/40 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Смотреть 3D-анимацию</span>
            </button>
          </div>
        </section>
      )}

      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 text-xs text-slate-400 flex items-center justify-between">
        <span>Борбарисово 001 · Зимний выпуск</span>
        <span className="font-mono-nums">Хрумки 67 коп. · Газява 52 коп.</span>
      </footer>
    </div>
  );
}

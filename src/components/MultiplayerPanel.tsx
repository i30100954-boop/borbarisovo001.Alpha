import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Download,
  Flame,
  Gamepad2,
  Globe,
  Loader2,
  LogOut,
  MessageSquare,
  Play,
  Send,
  Server,
  Shield,
  Swords,
  Terminal,
  User,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  downloadServerJsFile,
  POWERSHELL_HOST_COMMAND,
} from '../network/serverTemplate';
import { MultiplayerClientState } from '../network/useMultiplayerClient';
import { FighterId, LobbyMode, MinionId, NetPlayer } from '../types/game';

export interface MultiplayerPanelProps {
  client: MultiplayerClientState & {
    localPlayer: NetPlayer | null;
    connect: (
      nickname: string,
      hostInput: string,
      fighter?: FighterId,
      minion?: MinionId
    ) => void;
    disconnect: () => void;
    updatePlayer: (
      patch: Partial<{
        nickname: string;
        fighter: FighterId;
        minion: MinionId;
        ready: boolean;
      }>
    ) => void;
    updateSettings: (patch: Partial<{ mode: LobbyMode; hardcore: boolean }>) => void;
    sendChat: (text: string) => void;
    startMatch: () => void;
  };
  onBackToMenu?: () => void;
  compact?: boolean;
}

const FIGHTER_LABELS: Record<FighterId, string> = {
  LUPIK: 'Лупик (Дробовик)',
  EGOR: 'Егор (Шашлык)',
  ARTEM: 'Артём (Орудие)',
};

const MINION_LABELS: Record<MinionId, string> = {
  ILIHE: 'ИЛИХЕ',
  MAKS: 'Макс (Индюк)',
};

export function MultiplayerPanel({
  client,
  onBackToMenu,
  compact = false,
}: MultiplayerPanelProps) {
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem('borbarisovo_nick') || 'Лупик';
    } catch {
      return 'Лупик';
    }
  });
  const [hostInput, setHostInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('borbarisovo_host');
      if (saved) return saved;
      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'http:' &&
        window.location.hostname
      ) {
        return window.location.hostname;
      }
      return 'localhost';
    } catch {
      return 'localhost';
    }
  });
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [downloadedServer, setDownloadedServer] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const copyTimerRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [client.chat.length]);

  const handleCopyCommand = async () => {
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(POWERSHELL_HOST_COMMAND);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = POWERSHELL_HOST_COMMAND;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    if (copied) {
      setCopiedCmd(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedCmd(false), 2600);
    }
  };

  const handleDownloadServer = () => {
    downloadServerJsFile();
    setDownloadedServer(true);
  };

  const handleConnectSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim() || 'Лупик';
    const cleanHost = hostInput.trim() || 'localhost';
    try {
      localStorage.setItem('borbarisovo_nick', cleanNick);
      localStorage.setItem('borbarisovo_host', cleanHost);
    } catch {
      // ignore storage failure
    }
    client.connect(cleanNick, cleanHost);
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    client.sendChat(chatInput);
    setChatInput('');
  };

  // ===========================================================================
  // CONNECTED ROOM LOBBY VIEW
  // ===========================================================================
  if (client.status === 'CONNECTED' && client.localPlayer) {
    const me = client.localPlayer;
    const isHost = me.isHost;

    return (
      <div className="w-full bg-[#131F33]/95 border border-sky-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Top Lobby Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-extrabold text-slate-50">
                  Лобби комнаты · LAN / Radmin VPN
                </h2>
                <span className="text-[11px] font-mono-nums font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                  {client.connectedAddress}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Игроков в комнате: <strong className="text-slate-200">{client.players.length}</strong> ·{' '}
                {isHost
                  ? 'Вы Хост — настройте режим и нажмите «Начать игру»'
                  : 'Ожидайте запуска матча от Хоста'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToMenu && (
              <button
                type="button"
                onClick={onBackToMenu}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                На главный экран
              </button>
            )}
            <button
              type="button"
              onClick={client.disconnect}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Отключиться</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Players & Loadout */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0B1320]/90 border border-slate-700/70 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-sky-300">
                  <Users className="w-4 h-4" />
                  <span>Пацаны в комнате</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Готовы: {client.players.filter((p) => p.ready).length} / {client.players.length}
                </span>
              </div>

              <div className="space-y-2">
                {client.players.map((p) => {
                  const isMe = p.id === me.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border ${
                        isMe
                          ? 'bg-sky-950/35 border-sky-400/50'
                          : 'bg-slate-900/70 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.isHost ? (
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-sm text-slate-100 truncate">
                              {p.nickname}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40">
                                ВЫ
                              </span>
                            )}
                            {p.isHost && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                ХОСТ
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {FIGHTER_LABELS[p.fighter]} · Миньон: {MINION_LABELS[p.minion]}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${
                          p.ready
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-800 border-slate-600/60 text-slate-400'
                        }`}
                      >
                        {p.ready ? 'Готов ✓' : 'Готовится...'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Local Player Loadout */}
            <div className="bg-[#0B1320]/90 border border-slate-700/70 rounded-xl p-4 space-y-3">
              <div className="text-xs font-display font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                <span>Ваш боец и миньон</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">Боец</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['LUPIK', 'EGOR', 'ARTEM'] as FighterId[]).map((fid) => (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => client.updatePlayer({ fighter: fid })}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                          me.fighter === fid
                            ? 'bg-sky-500 text-slate-950 border-sky-300'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {fid === 'LUPIK' ? 'Лупик' : fid === 'EGOR' ? 'Егор' : 'Артём'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">Миньон</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['ILIHE', 'MAKS'] as MinionId[]).map((mid) => (
                      <button
                        key={mid}
                        type="button"
                        onClick={() => client.updatePlayer({ minion: mid })}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                          me.minion === mid
                            ? 'bg-amber-400 text-slate-950 border-amber-200'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {mid === 'ILIHE' ? 'ИЛИХЕ' : 'Макс'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => client.updatePlayer({ ready: !me.ready })}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-display font-bold text-xs sm:text-sm transition-colors ${
                    me.ready
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{me.ready ? 'Вы готовы к бою ✓' : 'Нажать «Готов»'}</span>
                </button>

                {isHost && (
                  <button
                    type="button"
                    onClick={client.startMatch}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Начать совместную игру</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Host Settings + Room Chat */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            <div className="bg-[#0B1320]/90 border border-slate-700/70 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-display font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <Swords className="w-4 h-4" />
                  <span>Режим комнаты {isHost ? '(Хост)' : '(Только хост)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {[
                  {
                    id: 'BOSS_RUSH' as LobbyMode,
                    title: '3D-Босс Дима (Кооп Boss Rush)',
                    sub: client.settings.hardcore ? '9000 HP · 3 фазы' : '5000 HP · 2 фазы',
                    icon: Swords,
                  },
                  {
                    id: 'WILD_CUCUMBER' as LobbyMode,
                    title: '3D-Босс Wild Огурец (Портал)',
                    sub: '10 000 HP · 3 фазы · Общий урон по боссу',
                    icon: Zap,
                  },
                  {
                    id: 'STORY' as LobbyMode,
                    title: 'Сюжет: Борбарисово 001 (Кооп)',
                    sub: 'Подъезд, гаражи, магаз и боссы',
                    icon: Shield,
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = client.settings.mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => client.updateSettings({ mode: opt.id })}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2.5 ${
                        active
                          ? 'bg-purple-950/50 border-purple-400 text-slate-100'
                          : 'bg-slate-900/70 border-slate-700/70 text-slate-300 hover:bg-slate-800 disabled:opacity-70'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-purple-300' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{opt.title}</div>
                        <div className="text-[11px] text-slate-400">{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {client.settings.mode !== 'WILD_CUCUMBER' && (
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => client.updateSettings({ hardcore: !client.settings.hardcore })}
                  className={`w-full inline-flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                    client.settings.hardcore
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                      : 'bg-slate-900/70 border-slate-700 text-slate-300 disabled:opacity-70'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>Сложность ХАРДКОР</span>
                  </span>
                  <span>{client.settings.hardcore ? 'ВКЛ (9000 HP)' : 'ВЫКЛ'}</span>
                </button>
              )}
            </div>

            {/* Room Chat */}
            <div className="bg-[#0B1320]/90 border border-slate-700/70 rounded-xl p-4 flex-1 flex flex-col min-h-[210px]">
              <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>Чат комнаты</span>
              </div>
              <div className="flex-1 max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs mb-3">
                {client.chat.length === 0 ? (
                  <div className="text-slate-500 italic">Сообщений пока нет...</div>
                ) : (
                  client.chat.map((m) => (
                    <div
                      key={m.id}
                      className={m.isSystem ? 'text-amber-300/90 italic' : 'text-slate-200'}
                    >
                      {!m.isSystem && (
                        <span className="font-bold text-sky-300">{m.senderName}: </span>
                      )}
                      <span>{m.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Написать пацанам..."
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  aria-label="Отправить сообщение"
                  className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // PRE-CONNECTION VIEW: HOST LAUNCHER PANEL + CONNECT FORM
  // ===========================================================================
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>Сетевая игра · LAN (192.168.x.x) и Radmin VPN (26.x.x.x)</span>
          </div>
          {!compact && (
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-50 mt-1">
              Создать сервер (Хост) или подключиться к другу
            </h2>
          )}
        </div>
        {onBackToMenu && (
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Назад на главный экран
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT BLOCK: «Для хоста (запуск сервера)» */}
        <section
          aria-label="Для хоста (запуск сервера)"
          className="lg:col-span-7 bg-[#131F33]/95 border border-amber-500/40 rounded-xl p-5 shadow-xl flex flex-col justify-between gap-4"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-extrabold text-amber-300">
                    Для хоста (запуск сервера)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Поднимите комнату у себя на ПК (слушает <span className="font-mono-nums text-amber-200">0.0.0.0:3000</span> для Radmin VPN и LAN)
                  </p>
                </div>
              </div>
            </div>

            {/* Step 1: Download server.js */}
            <div className="bg-[#0B1320]/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-100">
                  Шаг 1. Скачайте актуальный файл сервера
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Браузер сохранит готовый <code className="text-sky-300">server.js</code> прямо в папку «Загрузки» (Downloads)
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadServer}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
                  downloadedServer
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{downloadedServer ? 'server.js скачан ✓' : 'Скачать server.js'}</span>
              </button>
            </div>

            {/* Step 2: Ready Windows PowerShell Command + Copy Button */}
            <div className="bg-[#0B1320]/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-100">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span>Шаг 2. Запустите команду в Windows PowerShell</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  Использует npm.cmd (обходит запрет скриптов PowerShell)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 overflow-x-auto">
                  <code className="font-mono text-xs text-emerald-300 whitespace-nowrap select-all">
                    {POWERSHELL_HOST_COMMAND}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-display font-bold text-xs transition-colors whitespace-nowrap shrink-0 ${
                    copiedCmd
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Скопировано! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Скопировать</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 space-y-1">
            <div>
              <strong className="text-slate-200">Шаг 3:</strong> Хост подключается к{' '}
              <code className="text-amber-300">localhost</code>, а друзья вводят ваш IP из{' '}
              <strong className="text-sky-300">Radmin VPN</strong> (например,{' '}
              <code className="text-sky-300">26.x.x.x:3000</code>) или локальной сети{' '}
              <code className="text-sky-300">192.168.x.x:3000</code>.
            </div>
            <div>
              <strong className="text-slate-200">Совет для друзей (чтобы браузер не блокировал ws://):</strong>{' '}
              раздавайте игру по <code className="text-emerald-300">http://&lt;ваш-Radmin-IP&gt;:4173/</code>{' '}
              через <code className="text-slate-300">npm.cmd run preview -- --port 4173 --host</code>.
            </div>
          </div>
        </section>

        {/* RIGHT BLOCK: Connect Form */}
        <section
          aria-label="Подключиться к серверу"
          className="lg:col-span-5 bg-[#131F33]/95 border border-sky-500/40 rounded-xl p-5 shadow-xl flex flex-col justify-between"
        >
          <form onSubmit={handleConnectSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/50 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="font-display text-base sm:text-lg font-extrabold text-sky-300">
                  Подключиться к комнате
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Введите никнейм и IP хоста (порт 3000)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-200 mb-1.5 block">
                  Никнейм
                </span>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={20}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ваш ник (например, Лупик)"
                    className="w-full bg-[#0B1320] border border-slate-700 focus:border-sky-400 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-200">
                    IP-адрес хоста
                  </span>
                  <button
                    type="button"
                    onClick={() => setHostInput('localhost')}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                  >
                    Вставить localhost
                  </button>
                </div>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    placeholder="localhost или 26.142.15.10:3000"
                    className="w-full bg-[#0B1320] border border-slate-700 focus:border-sky-400 rounded-lg pl-9 pr-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  По умолчанию <code className="text-slate-300">localhost</code> · Radmin VPN:{' '}
                  <code className="text-slate-300">26.x.x.x:3000</code> · LAN:{' '}
                  <code className="text-slate-300">192.168.x.x:3000</code>
                </span>
              </label>
            </div>

            {client.errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-rose-950/60 border border-rose-500/60 rounded-lg px-3 py-2.5 text-xs text-rose-200"
              >
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{client.errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={client.status === 'CONNECTING'}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-display font-extrabold text-sm shadow-lg shadow-sky-500/20 transition-colors"
            >
              {client.status === 'CONNECTING' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Подключение к {hostInput || 'localhost'}...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Подключиться</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between gap-2">
            <span>Протокол: WebSockets (ws)</span>
            <span className="font-mono-nums text-slate-300">Порт: 3000</span>
          </div>
        </section>
      </div>
    </div>
  );
}

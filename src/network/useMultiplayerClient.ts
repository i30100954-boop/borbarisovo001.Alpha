import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FighterId,
  LobbyMode,
  MinionId,
  NetBossEvent,
  NetBossState,
  NetChatMessage,
  NetConnectionStatus,
  NetMatchState,
  NetPlayer,
  NetPlayerPose,
  NetRemoteAttackEvent,
  NetRemotePlayerState,
  NetRoomSettings,
  SceneId,
} from '../types/game';

export interface MultiplayerClientState {
  status: NetConnectionStatus;
  errorMessage: string | null;
  connectedAddress: string;
  localPlayerId: string | null;
  players: NetPlayer[];
  settings: NetRoomSettings;
  match: NetMatchState;
  chat: NetChatMessage[];
}

export function normalizeWebSocketUrl(rawHost: string): {
  wsUrl: string;
  displayHost: string;
  isLocalLoopback: boolean;
} {
  let trimmed = rawHost.trim();
  if (!trimmed) trimmed = 'localhost';

  let protocol = 'ws:';
  if (/^wss:\/\//i.test(trimmed)) {
    protocol = 'wss:';
    trimmed = trimmed.replace(/^wss:\/\//i, '');
  } else if (/^ws:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^ws:\/\//i, '');
  }

  trimmed = trimmed.replace(/\/+$/, '');
  const hasPort = /:\d+$/.test(trimmed);
  const hostWithPort = hasPort ? trimmed : `${trimmed}:3000`;
  const hostnameOnly = hostWithPort.split(':')[0].toLowerCase();
  const isLocalLoopback =
    hostnameOnly === 'localhost' || hostnameOnly === '127.0.0.1' || hostnameOnly === '::1';

  return {
    wsUrl: `${protocol}//${hostWithPort}`,
    displayHost: hostWithPort,
    isLocalLoopback,
  };
}

interface UseMultiplayerClientOptions {
  onGameStarted?: (snapshot: {
    players: NetPlayer[];
    settings: NetRoomSettings;
    match: NetMatchState;
  }) => void;
  onReturnedToLobby?: () => void;
  onRemoteBossHpSync?: (payload: {
    sharedBossHp: number;
    maxBossHp: number;
    attackerId: string;
    attackerName: string;
    amount: number;
  }) => void;
}

const DEFAULT_MATCH: NetMatchState = {
  status: 'LOBBY',
  bossId: 'DIMA',
  sharedBossHp: 5000,
  maxBossHp: 5000,
  startedAt: null,
};

export function useMultiplayerClient(options?: UseMultiplayerClientOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const wsRef = useRef<WebSocket | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const remoteStatesRef = useRef<Record<string, NetRemotePlayerState>>({});
  const bossStateRef = useRef<NetBossState | null>(null);
  const attackListenersRef = useRef<Set<(ev: NetRemoteAttackEvent) => void>>(new Set());
  const bossEventListenersRef = useRef<Set<(ev: NetBossEvent) => void>>(new Set());
  const remoteHitListenersRef = useRef<
    Set<(hit: { sharedBossHp: number; maxBossHp: number; attackerId: string; attackerName: string; amount: number }) => void>
  >(new Set());

  const [state, setState] = useState<MultiplayerClientState>({
    status: 'DISCONNECTED',
    errorMessage: null,
    connectedAddress: 'localhost:3000',
    localPlayerId: null,
    players: [],
    settings: { mode: 'BOSS_RUSH', hardcore: false },
    match: DEFAULT_MATCH,
    chat: [],
  });

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    localPlayerIdRef.current = null;
    remoteStatesRef.current = {};
    bossStateRef.current = null;
    setState((prev) => ({
      ...prev,
      status: 'DISCONNECTED',
      errorMessage: null,
      localPlayerId: null,
      players: [],
      match: DEFAULT_MATCH,
      chat: [],
    }));
  }, []);

  const connect = useCallback(
    (
      nickname: string,
      hostInput: string,
      initialFighter: FighterId = 'LUPIK',
      initialMinion: MinionId = 'ILIHE'
    ) => {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const cleanNick = nickname.trim().slice(0, 20) || 'Лупик';
      const { wsUrl, displayHost, isLocalLoopback } = normalizeWebSocketUrl(hostInput);

      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        wsUrl.startsWith('ws://') &&
        !isLocalLoopback
      ) {
        setState((prev) => ({
          ...prev,
          status: 'ERROR',
          connectedAddress: displayHost,
          errorMessage: `Браузер блокирует ws:// со страницы HTTPS для удалённого IP (${displayHost}). Для игры с друзьями по Radmin VPN / LAN запустите клиент по http://localhost:4173 (хост) и http://<IP-хоста>:4173 (друзья) через vite preview --port 4173 --host.`,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: 'CONNECTING',
        errorMessage: null,
        connectedAddress: displayHost,
      }));

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'ERROR',
          errorMessage:
            err instanceof Error
              ? `Неверный адрес сервера: ${err.message}`
              : 'Не удалось создать WebSocket подключение',
        }));
        return;
      }

      wsRef.current = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        ws.send(
          JSON.stringify({
            type: 'hello',
            nickname: cleanNick,
            fighter: initialFighter,
            minion: initialMinion,
          })
        );
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'welcome') {
          const pid = String(msg.playerId || '');
          const snapshot = msg.state as {
            players: NetPlayer[];
            settings: NetRoomSettings;
            match: NetMatchState;
            chat: NetChatMessage[];
          };
          localPlayerIdRef.current = pid;
          const nextRemote: Record<string, NetRemotePlayerState> = {};
          const coopStates = Array.isArray(msg.coopStates)
            ? (msg.coopStates as Array<NetRemotePlayerState>)
            : [];
          const now = Date.now();
          for (const cs of coopStates) {
            if (cs?.id && cs.id !== pid) {
              nextRemote[cs.id] = { ...cs, updatedAt: now };
            }
          }
          remoteStatesRef.current = nextRemote;
          bossStateRef.current = (msg.bossState as NetBossState | null) || null;
          setState((prev) => ({
            ...prev,
            status: 'CONNECTED',
            errorMessage: null,
            localPlayerId: pid,
            players: snapshot?.players || [],
            settings: snapshot?.settings || prev.settings,
            match: snapshot?.match || prev.match,
            chat: snapshot?.chat || [],
          }));
          return;
        }

        if (msg.type === 'lobby:state') {
          const snapshot = msg.state as {
            players: NetPlayer[];
            settings: NetRoomSettings;
            match: NetMatchState;
            chat: NetChatMessage[];
          };
          if (snapshot?.players) {
            const activeIds = new Set(snapshot.players.map((p) => p.id));
            for (const key of Object.keys(remoteStatesRef.current)) {
              if (!activeIds.has(key)) {
                delete remoteStatesRef.current[key];
              }
            }
          }
          setState((prev) => ({
            ...prev,
            players: snapshot?.players || prev.players,
            settings: snapshot?.settings || prev.settings,
            match: snapshot?.match || prev.match,
            chat: snapshot?.chat || prev.chat,
          }));
          return;
        }

        if (msg.type === 'chat:message') {
          const chatMsg = msg.message as NetChatMessage;
          if (!chatMsg?.id) return;
          setState((prev) => {
            if (prev.chat.some((c) => c.id === chatMsg.id)) return prev;
            return {
              ...prev,
              chat: [...prev.chat.slice(-39), chatMsg],
            };
          });
          return;
        }

        if (msg.type === 'player:state') {
          const pid = String(msg.playerId || '');
          if (!pid || pid === localPlayerIdRef.current) return;
          const s = msg.state as NetPlayerPose | undefined;
          if (!s) return;
          remoteStatesRef.current[pid] = {
            ...s,
            id: pid,
            nickname: String(msg.nickname || 'Союзник'),
            updatedAt: Date.now(),
          };
          return;
        }

        if (msg.type === 'player:attack') {
          const pid = String(msg.playerId || '');
          if (!pid || pid === localPlayerIdRef.current) return;
          const ev: NetRemoteAttackEvent = {
            playerId: pid,
            nickname: String(msg.nickname || 'Союзник'),
            fighter: (msg.fighter as FighterId) || 'LUPIK',
            kind:
              msg.kind === 'SHASHLIK' || msg.kind === 'SHELL'
                ? msg.kind
                : 'SHOTGUN',
            x: Number(msg.x) || 0,
            y: Number(msg.y) || 1.5,
            z: Number(msg.z) || 0,
            vx: Number(msg.vx) || 0,
            vy: Number(msg.vy) || 0,
            vz: Number(msg.vz) || -20,
          };
          for (const cb of attackListenersRef.current) {
            cb(ev);
          }
          return;
        }

        if (msg.type === 'boss:state') {
          const s = msg.state as NetBossState | undefined;
          if (s) {
            bossStateRef.current = s;
          }
          return;
        }

        if (msg.type === 'boss:event') {
          const ev = msg.event as NetBossEvent | undefined;
          if (ev && typeof ev.type === 'string') {
            for (const cb of bossEventListenersRef.current) {
              cb(ev);
            }
          }
          return;
        }

        if (msg.type === 'game:started') {
          const snapshot = msg.state as {
            players: NetPlayer[];
            settings: NetRoomSettings;
            match: NetMatchState;
            chat: NetChatMessage[];
          };
          remoteStatesRef.current = {};
          bossStateRef.current = null;
          setState((prev) => ({
            ...prev,
            players: snapshot?.players || prev.players,
            settings: snapshot?.settings || prev.settings,
            match: snapshot?.match || prev.match,
            chat: snapshot?.chat || prev.chat,
          }));
          if (snapshot) {
            optionsRef.current?.onGameStarted?.(snapshot);
          }
          return;
        }

        if (msg.type === 'game:returned_lobby') {
          const snapshot = msg.state as {
            players: NetPlayer[];
            settings: NetRoomSettings;
            match: NetMatchState;
            chat: NetChatMessage[];
          };
          remoteStatesRef.current = {};
          bossStateRef.current = null;
          setState((prev) => ({
            ...prev,
            players: snapshot?.players || prev.players,
            settings: snapshot?.settings || prev.settings,
            match: snapshot?.match || prev.match,
          }));
          optionsRef.current?.onReturnedToLobby?.();
          return;
        }

        if (msg.type === 'boss:hp_sync') {
          const sharedBossHp = Number(msg.sharedBossHp);
          const maxBossHp = Number(msg.maxBossHp);
          const attackerId = String(msg.attackerId || '');
          const attackerName = String(msg.attackerName || '');
          const amount = Number(msg.amount || 0);
          const updatedPlayers = msg.players as NetPlayer[] | undefined;

          setState((prev) => ({
            ...prev,
            players: updatedPlayers || prev.players,
            match: {
              ...prev.match,
              sharedBossHp: Number.isFinite(sharedBossHp) ? sharedBossHp : prev.match.sharedBossHp,
              maxBossHp: Number.isFinite(maxBossHp) ? maxBossHp : prev.match.maxBossHp,
            },
          }));
          for (const cb of remoteHitListenersRef.current) {
            cb({
              sharedBossHp,
              maxBossHp,
              attackerId,
              attackerName,
              amount,
            });
          }
          optionsRef.current?.onRemoteBossHpSync?.({
            sharedBossHp,
            maxBossHp,
            attackerId,
            attackerName,
            amount,
          });
        }
      };

      ws.onerror = () => {
        if (!opened) {
          setState((prev) => ({
            ...prev,
            status: 'ERROR',
            errorMessage: `Не удалось подключиться к ${displayHost}. Проверьте, запущен ли server.js и открыт ли порт 3000 в Radmin VPN / LAN.`,
          }));
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          localPlayerIdRef.current = null;
          remoteStatesRef.current = {};
          bossStateRef.current = null;
          setState((prev) => ({
            ...prev,
            status: opened ? 'DISCONNECTED' : 'ERROR',
            localPlayerId: null,
            errorMessage: opened
              ? 'Соединение с сервером закрыто.'
              : prev.errorMessage || `Сервер ${displayHost} не отвечает.`,
          }));
        }
      };
    },
    []
  );

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const updatePlayer = useCallback(
    (patch: Partial<{ nickname: string; fighter: FighterId; minion: MinionId; ready: boolean; scene: SceneId; x: number; hp: number }>) => {
      sendRaw({ type: 'player:update', ...patch });
    },
    [sendRaw]
  );

  const updateSettings = useCallback(
    (patch: Partial<{ mode: LobbyMode; hardcore: boolean }>) => {
      sendRaw({ type: 'lobby:settings', ...patch });
    },
    [sendRaw]
  );

  const sendChat = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendRaw({ type: 'lobby:chat', text: text.trim() });
    },
    [sendRaw]
  );

  const startMatch = useCallback(() => {
    sendRaw({ type: 'game:start' });
  }, [sendRaw]);

  const returnToLobby = useCallback(() => {
    sendRaw({ type: 'game:return_lobby' });
  }, [sendRaw]);

  const sendBossDamage = useCallback(
    (amount: number, sourceKind: string) => {
      sendRaw({ type: 'boss:damage', amount, sourceKind });
    },
    [sendRaw]
  );

  const sendPlayerState = useCallback(
    (pose: NetPlayerPose) => {
      sendRaw({ type: 'player:state', state: pose });
    },
    [sendRaw]
  );

  const sendPlayerAttack = useCallback(
    (ev: Omit<NetRemoteAttackEvent, 'playerId' | 'nickname'>) => {
      sendRaw({ type: 'player:attack', ...ev });
    },
    [sendRaw]
  );

  const subscribeRemoteAttack = useCallback(
    (cb: (ev: NetRemoteAttackEvent) => void) => {
      attackListenersRef.current.add(cb);
      return () => {
        attackListenersRef.current.delete(cb);
      };
    },
    []
  );

  const sendBossState = useCallback(
    (bossState: NetBossState) => {
      sendRaw({ type: 'boss:state', state: bossState });
    },
    [sendRaw]
  );

  const sendBossEvent = useCallback(
    (ev: NetBossEvent) => {
      sendRaw({ type: 'boss:event', event: ev });
    },
    [sendRaw]
  );

  const sendBossStomp = useCallback(() => {
    sendRaw({ type: 'boss:stomp' });
  }, [sendRaw]);

  const subscribeBossEvent = useCallback(
    (cb: (ev: NetBossEvent) => void) => {
      bossEventListenersRef.current.add(cb);
      return () => {
        bossEventListenersRef.current.delete(cb);
      };
    },
    []
  );

  const subscribeRemoteBossHit = useCallback(
    (
      cb: (hit: {
        sharedBossHp: number;
        maxBossHp: number;
        attackerId: string;
        attackerName: string;
        amount: number;
      }) => void
    ) => {
      remoteHitListenersRef.current.add(cb);
      return () => {
        remoteHitListenersRef.current.delete(cb);
      };
    },
    []
  );

  const localPlayer = state.players.find((p) => p.id === state.localPlayerId) || null;

  return {
    ...state,
    localPlayer,
    remoteStatesRef,
    bossStateRef,
    connect,
    disconnect,
    updatePlayer,
    updateSettings,
    sendChat,
    startMatch,
    returnToLobby,
    sendBossDamage,
    sendPlayerState,
    sendPlayerAttack,
    subscribeRemoteAttack,
    sendBossState,
    sendBossEvent,
    sendBossStomp,
    subscribeBossEvent,
    subscribeRemoteBossHit,
  };
}

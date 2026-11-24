const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;

const MAX_CHAT_HISTORY = 40;

const players = new Map(); // id -> { id, ws, nickname, fighter, minion, ready, isHost, scene, x, hp, damageDealt }
const settings = {
  mode: 'BOSS_RUSH', // 'STORY' | 'BOSS_RUSH' | 'WILD_CUCUMBER'
  hardcore: false,
};
const match = {
  status: 'LOBBY', // 'LOBBY' | 'IN_GAME'
  bossId: 'DIMA',
  sharedBossHp: 5000,
  maxBossHp: 5000,
  startedAt: null,
  bossState: null,
  bossSyncLogged: false,
};
const chatHistory = [];
let nextPlayerSeq = 1;

function getMaxBossHp() {
  if (settings.mode === 'WILD_CUCUMBER') return 10000;
  return settings.hardcore ? 9000 : 5000;
}

function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const radmin = [];
  const lan = [];
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const info of entries) {
      if (info.family !== 'IPv4' || info.internal) continue;
      if (info.address.startsWith('26.')) {
        radmin.push({ name, address: info.address });
      } else {
        lan.push({ name, address: info.address });
      }
    }
  }
  return { radmin, lan };
}

function getSnapshot() {
  const playerList = [];
  for (const p of players.values()) {
    playerList.push({
      id: p.id,
      nickname: p.nickname,
      fighter: p.fighter,
      minion: p.minion,
      ready: p.ready,
      isHost: p.isHost,
      scene: p.scene,
      x: p.x,
      hp: p.hp,
      damageDealt: p.damageDealt,
    });
  }
  return {
    players: playerList,
    settings: { ...settings },
    match: { ...match },
    chat: chatHistory.slice(-MAX_CHAT_HISTORY),
  };
}

function sendJson(ws, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload, excludeId = null) {
  const raw = JSON.stringify(payload);
  for (const p of players.values()) {
    if (excludeId && p.id === excludeId) continue;
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(raw);
    }
  }
}

function ensureHostExists() {
  let hasHost = false;
  for (const p of players.values()) {
    if (p.isHost) {
      hasHost = true;
      break;
    }
  }
  if (!hasHost && players.size > 0) {
    const first = players.values().next().value;
    if (first) {
      first.isHost = true;
      first.ready = true;
    }
  }
}

function addSystemChat(text) {
  const msg = {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderId: 'SYSTEM',
    senderName: 'Сервер',
    text,
    ts: Date.now(),
    isSystem: true,
  };
  chatHistory.push(msg);
  if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
  broadcast({ type: 'chat:message', message: msg });
}

const DIST_DIR = path.join(__dirname, 'dist');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (reqPath === '/health') {
    const { radmin, lan } = getLocalNetworkAddresses();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        ok: true,
        game: 'Борбарисово 001',
        port: PORT,
        players: players.size,
        status: match.status,
        radminIps: radmin.map((r) => `${r.address}:${PORT}`),
        lanIps: lan.map((l) => `${l.address}:${PORT}`),
      })
    );
    return;
  }

  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
    const candidate = path.resolve(DIST_DIR, safeRel);
    const inDist = candidate === DIST_DIR || candidate.startsWith(DIST_DIR + path.sep);
    const targetFile =
      inDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        ? candidate
        : indexHtmlPath;
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = fs.statSync(targetFile).size;
    const rangeHeader = req.headers.range;
    if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
      const [startStr, endStr] = rangeHeader.replace(/^bytes=/i, '').split('-');
      let start = startStr ? parseInt(startStr, 10) : 0;
      let end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      if (!startStr && endStr) {
        const suffixLen = parseInt(endStr, 10);
        start = Math.max(0, fileSize - suffixLen);
        end = fileSize - 1;
      }
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        res.end();
        return;
      }
      end = Math.min(end, fileSize - 1);
      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(targetFile, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(targetFile).pipe(res);
    return;
  }

  if (reqPath === '/') {
    const { radmin, lan } = getLocalNetworkAddresses();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        ok: true,
        game: 'Борбарисово 001',
        port: PORT,
        players: players.size,
        status: match.status,
        radminIps: radmin.map((r) => `${r.address}:${PORT}`),
        lanIps: lan.map((l) => `${l.address}:${PORT}`),
      })
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('WebSocket server is running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const playerId = `p${nextPlayerSeq++}`;
  const isFirst = players.size === 0;
  const player = {
    id: playerId,
    ws,
    nickname: `Пацан #${nextPlayerSeq - 1}`,
    fighter: 'LUPIK',
    minion: 'ILIHE',
    ready: isFirst,
    isHost: isFirst,
    scene: 'ENTRANCE',
    x: 175,
    hp: 100,
    damageDealt: 0,
    coopState: null,
    isAlive: true,
  };

  players.set(playerId, player);
  const remoteIp = req.socket?.remoteAddress || 'unknown';
  console.log(`[+] Подключился игрок ${playerId} (${remoteIp}). Всего в комнате: ${players.size}`);

  const coopStates = [];
  for (const p of players.values()) {
    if (p.id !== playerId && p.coopState) {
      coopStates.push({
        id: p.id,
        nickname: p.nickname,
        ...p.coopState,
      });
    }
  }

  sendJson(ws, {
    type: 'welcome',
    playerId,
    state: getSnapshot(),
    coopStates,
    bossState: match.bossState,
  });
  broadcast({ type: 'lobby:state', state: getSnapshot() }, playerId);

  ws.on('pong', () => {
    player.isAlive = true;
  });

  ws.on('message', (rawData) => {
    let msg;
    try {
      msg = JSON.parse(String(rawData));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'hello') {
      const nick = String(msg.nickname || '').trim().slice(0, 20);
      if (nick) player.nickname = nick;
      if (msg.fighter === 'LUPIK' || msg.fighter === 'EGOR' || msg.fighter === 'ARTEM') {
        player.fighter = msg.fighter;
      }
      if (msg.minion === 'ILIHE' || msg.minion === 'MAKS') {
        player.minion = msg.minion;
      }
      addSystemChat(`${player.nickname} зашёл в комнату`);
      broadcast({ type: 'lobby:state', state: getSnapshot() });
      return;
    }

    if (msg.type === 'player:update') {
      if (typeof msg.nickname === 'string') {
        const clean = msg.nickname.trim().slice(0, 20);
        if (clean) player.nickname = clean;
      }
      if (msg.fighter === 'LUPIK' || msg.fighter === 'EGOR' || msg.fighter === 'ARTEM') {
        player.fighter = msg.fighter;
      }
      if (msg.minion === 'ILIHE' || msg.minion === 'MAKS') {
        player.minion = msg.minion;
      }
      if (typeof msg.ready === 'boolean') {
        player.ready = msg.ready;
      }
      if (msg.scene === 'ENTRANCE' || msg.scene === 'STREET') {
        player.scene = msg.scene;
      }
      if (typeof msg.x === 'number' && Number.isFinite(msg.x)) {
        player.x = msg.x;
      }
      if (typeof msg.hp === 'number' && Number.isFinite(msg.hp)) {
        player.hp = Math.max(0, Math.round(msg.hp));
      }
      broadcast({ type: 'lobby:state', state: getSnapshot() });
      return;
    }

    if (msg.type === 'lobby:settings') {
      if (!player.isHost) return;
      if (msg.mode === 'STORY' || msg.mode === 'BOSS_RUSH' || msg.mode === 'WILD_CUCUMBER') {
        settings.mode = msg.mode;
      }
      if (typeof msg.hardcore === 'boolean') {
        settings.hardcore = msg.hardcore;
      }
      match.bossId = settings.mode === 'WILD_CUCUMBER' ? 'WILD_CUCUMBER' : 'DIMA';
      match.maxBossHp = getMaxBossHp();
      match.sharedBossHp = match.maxBossHp;
      broadcast({ type: 'lobby:state', state: getSnapshot() });
      return;
    }

    if (msg.type === 'lobby:chat') {
      const text = String(msg.text || '').trim().slice(0, 220);
      if (!text) return;
      const chatMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: player.id,
        senderName: player.nickname,
        text,
        ts: Date.now(),
        isSystem: false,
      };
      chatHistory.push(chatMsg);
      if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
      broadcast({ type: 'chat:message', message: chatMsg });
      return;
    }

    if (msg.type === 'game:start') {
      if (!player.isHost) return;
      for (const p of players.values()) {
        p.damageDealt = 0;
        p.coopState = null;
      }
      match.status = 'IN_GAME';
      match.bossId = settings.mode === 'WILD_CUCUMBER' ? 'WILD_CUCUMBER' : 'DIMA';
      match.maxBossHp = getMaxBossHp();
      match.sharedBossHp = match.maxBossHp;
      match.startedAt = Date.now();
      match.bossState = null;
      match.bossSyncLogged = false;
      addSystemChat(
        `Хост ${player.nickname} запустил игру (${settings.mode}${settings.hardcore ? ' · ХАРДКОР' : ''})!`
      );
      broadcast({ type: 'game:started', state: getSnapshot() });
      return;
    }

    if (msg.type === 'game:return_lobby') {
      if (!player.isHost) return;
      for (const p of players.values()) {
        p.coopState = null;
      }
      match.status = 'LOBBY';
      match.sharedBossHp = getMaxBossHp();
      match.maxBossHp = getMaxBossHp();
      match.startedAt = null;
      match.bossState = null;
      match.bossSyncLogged = false;
      broadcast({ type: 'game:returned_lobby', state: getSnapshot() });
      return;
    }

    if (msg.type === 'player:state') {
      const s = msg.state && typeof msg.state === 'object' ? msg.state : msg;
      const safeNum = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
      const fighter =
        s.fighter === 'LUPIK' || s.fighter === 'EGOR' || s.fighter === 'ARTEM'
          ? s.fighter
          : player.fighter;
      const minion =
        s.minion === 'ILIHE' || s.minion === 'MAKS'
          ? s.minion
          : player.minion;
      const screen =
        s.screen === 'LOBBY' || s.screen === 'PLAYING' || s.screen === 'BOSS_3D' || s.screen === 'OTHER'
          ? s.screen
          : 'OTHER';
      const scene = s.scene === 'STREET' ? 'STREET' : 'ENTRANCE';
      const pose = {
        screen,
        scene,
        worldX: safeNum(s.worldX, player.x),
        worldFacing: s.worldFacing === -1 ? -1 : 1,
        x: Math.max(-20, Math.min(20, safeNum(s.x, 0))),
        y: Math.max(-2, Math.min(20, safeNum(s.y, 0))),
        z: Math.max(-20, Math.min(20, safeNum(s.z, 9))),
        yaw: safeNum(s.yaw, 0),
        hp: Math.max(0, Math.min(1000, Math.round(safeNum(s.hp, player.hp)))),
        maxHp: Math.max(1, Math.min(1000, Math.round(safeNum(s.maxHp, 100)))),
        fighter,
        minion,
        isKingTiger: Boolean(s.isKingTiger),
        isPickle: Boolean(s.isPickle),
        isGilbert: Boolean(s.isGilbert),
        moving: Boolean(s.moving),
        dashing: Boolean(s.dashing),
        attacking: Boolean(s.attacking),
      };
      player.coopState = pose;
      player.hp = pose.hp;
      broadcast(
        {
          type: 'player:state',
          playerId: player.id,
          nickname: player.nickname,
          state: pose,
        },
        playerId
      );
      return;
    }

    if (msg.type === 'player:attack') {
      const safeNum = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
      const kind =
        msg.kind === 'SHOTGUN' || msg.kind === 'SHASHLIK' || msg.kind === 'CUCUMBER' || msg.kind === 'SHELL'
          ? msg.kind
          : 'SHOTGUN';
      const fighter =
        msg.fighter === 'LUPIK' || msg.fighter === 'EGOR' || msg.fighter === 'ARTEM'
          ? msg.fighter
          : player.fighter;
      broadcast(
        {
          type: 'player:attack',
          playerId: player.id,
          nickname: player.nickname,
          fighter,
          kind,
          x: safeNum(msg.x, 0),
          y: safeNum(msg.y, 1.5),
          z: safeNum(msg.z, 0),
          vx: safeNum(msg.vx, 0),
          vy: safeNum(msg.vy, 0),
          vz: safeNum(msg.vz, -20),
        },
        playerId
      );
      return;
    }

    if (msg.type === 'boss:state') {
      if (!player.isHost || match.status !== 'IN_GAME') return;
      if (!msg.state || typeof msg.state !== 'object') return;
      match.bossState = msg.state;
      if (!match.bossSyncLogged) {
        match.bossSyncLogged = true;
        console.log(`[BOSS-SYNC] Хост ${player.nickname} (${player.id}) синхронизирует общего босса (${match.bossId})`);
      }
      broadcast(
        {
          type: 'boss:state',
          state: msg.state,
        },
        playerId
      );
      return;
    }

    if (msg.type === 'boss:event') {
      if (!player.isHost || match.status !== 'IN_GAME') return;
      if (!msg.event || typeof msg.event !== 'object' || typeof msg.event.type !== 'string') return;
      broadcast(
        {
          type: 'boss:event',
          event: msg.event,
        },
        playerId
      );
      return;
    }

    if (msg.type === 'boss:stomp') {
      if (match.status !== 'IN_GAME') return;
      broadcast(
        {
          type: 'boss:event',
          event: { type: 'STOMP_WON', stomperId: player.id },
        },
        playerId
      );
      return;
    }

    if (msg.type === 'boss:damage') {
      const dmg = Math.max(0, Math.min(2000, Math.round(Number(msg.amount) || 0)));
      if (dmg <= 0 || match.status !== 'IN_GAME') return;
      player.damageDealt += dmg;
      match.sharedBossHp = Math.max(0, match.sharedBossHp - dmg);
      broadcast({
        type: 'boss:hp_sync',
        sharedBossHp: match.sharedBossHp,
        maxBossHp: match.maxBossHp,
        attackerId: player.id,
        attackerName: player.nickname,
        amount: dmg,
        sourceKind: String(msg.sourceKind || 'HIT'),
        players: getSnapshot().players,
      });
      return;
    }
  });

  ws.on('close', () => {
    const leftName = player.nickname;
    const wasHost = player.isHost;
    players.delete(playerId);
    ensureHostExists();
    if (players.size === 0) {
      match.status = 'LOBBY';
      match.startedAt = null;
      match.bossState = null;
    }
    console.log(`[-] Отключился ${leftName} (${playerId}). Осталось: ${players.size}`);
    if (players.size > 0) {
      addSystemChat(`${leftName} вышел из комнаты${wasHost ? ' (назначен новый хост)' : ''}`);
      broadcast({ type: 'lobby:state', state: getSnapshot() });
    }
  });
});

const heartbeat = setInterval(() => {
  for (const [id, p] of players.entries()) {
    if (!p.isAlive) {
      p.ws.terminate();
      players.delete(id);
      ensureHostExists();
      continue;
    }
    p.isAlive = false;
    p.ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('');
    console.error('==========================================================');
    console.error(`  ОШИБКА: Порт ${PORT} УЖЕ ЗАНЯТ другим процессом!`);
    console.error('  Скорее всего, работает СТАРЫЙ server.cjs в другом окне.');
    console.error('  Выполни в cmd: taskkill /F /IM node.exe');
    console.error('  И затем снова: node server.cjs');
    console.error('==========================================================');
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  const { radmin, lan } = getLocalNetworkAddresses();
  const hasDist = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  console.log('');
  console.log('==========================================================');
  console.log('  БОРБАРИСОВО 001 — WebSocket Сервер (LAN / Radmin VPN)');
  console.log('==========================================================');
  console.log(`  Слушает:   0.0.0.0:${PORT}`);
  console.log(`  Локально:  localhost:${PORT}`);
  if (radmin.length > 0) {
    for (const r of radmin) {
      console.log(`  Radmin VPN (${r.name}): ${r.address}:${PORT}`);
      if (hasDist) {
        console.log(`  Ссылка на игру (Radmin): http://${r.address}:${PORT}/`);
      }
    }
  } else {
    console.log('  Radmin VPN: сеть 26.x.x.x не найдена (подключитесь к Radmin VPN)');
  }
  if (lan.length > 0) {
    for (const l of lan) {
      console.log(`  LAN (${l.name}):        ${l.address}:${PORT}`);
    }
  }
  console.log('==========================================================');
  console.log('  Ожидаем игроков... Нажмите Ctrl+C для остановки.');
  console.log('');
});

import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { soundFX } from '../audio/soundFx';
import {
  FighterId,
  GameProgress,
  InteractableZone,
  MinionId,
  NetPlayerPose,
  NetRemotePlayerState,
  QuestStage,
  SceneId,
} from '../types/game';

interface WorldCanvasProps {
  scene: SceneId;
  playerX: number;
  setPlayerX: (x: number) => void;
  progress: GameProgress;
  questStage: QuestStage;
  isModalOpen: boolean;
  onInteract: (zoneId: string) => void;
  coopLocalPlayerId?: string | null;
  coopFighter?: FighterId;
  coopMinion?: MinionId;
  coopRemoteStatesRef?: MutableRefObject<Record<string, NetRemotePlayerState>>;
  onCoopSyncState?: (pose: NetPlayerPose) => void;
}

interface Snowflake {
  x: number;
  y: number;
  r: number;
  speedY: number;
  drift: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
  alpha: number;
  softHalo: boolean;
}

interface BreathPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const VIEW_W = 1120;
const VIEW_H = 500;
const ENTRANCE_WORLD_W = 1120;
const STREET_WORLD_W = 3750;

export function WorldCanvas({
  scene,
  playerX,
  setPlayerX,
  progress,
  questStage,
  isModalOpen,
  onInteract,
  coopLocalPlayerId = null,
  coopFighter = 'LUPIK',
  coopMinion = 'ILIHE',
  coopRemoteStatesRef,
  onCoopSyncState,
}: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coopLocalIdRef = useRef(coopLocalPlayerId);
  coopLocalIdRef.current = coopLocalPlayerId;
  const coopFighterRef = useRef(coopFighter);
  coopFighterRef.current = coopFighter;
  const coopMinionRef = useRef(coopMinion);
  coopMinionRef.current = coopMinion;
  const coopRemoteStatesRefProp = useRef(coopRemoteStatesRef);
  coopRemoteStatesRefProp.current = coopRemoteStatesRef;
  const onCoopSyncStateRef = useRef(onCoopSyncState);
  onCoopSyncStateRef.current = onCoopSyncState;
  const remote2dXRef = useRef<Record<string, number>>({});

  // Live physics refs so rAF runs at steady 60fps without React re-render lag
  const posRef = useRef(playerX);
  const lastSyncedXRef = useRef(playerX);
  const lastSceneRef = useRef<SceneId>(scene);
  const facingRef = useRef<1 | -1>(1);
  const walkPhaseRef = useRef(0);
  const stepCooldownRef = useRef(0);
  const cameraXRef = useRef(0);

  const egorPosRef = useRef(playerX - 58);
  const artemPosRef = useRef(playerX - 114);

  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const touchMoveRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  const snowRef = useRef<Snowflake[]>([]);
  const puffsRef = useRef<BreathPuff[]>([]);
  const puffTimerRef = useRef(0);

  const [activeZone, setActiveZone] = useState<InteractableZone | null>(null);

  // Sync ONLY on genuine external jumps (scene transition or game reset), never on self-sync
  useEffect(() => {
    const sceneChanged = lastSceneRef.current !== scene;
    const externalJump = Math.abs(playerX - lastSyncedXRef.current) > 2;
    if (!sceneChanged && !externalJump) return;

    lastSceneRef.current = scene;
    lastSyncedXRef.current = playerX;
    posRef.current = playerX;
    egorPosRef.current = Math.max(70, playerX - 56);
    artemPosRef.current = Math.max(50, playerX - 110);
    if (scene === 'ENTRANCE') {
      cameraXRef.current = 0;
    } else {
      cameraXRef.current = Math.max(0, Math.min(STREET_WORLD_W - VIEW_W, playerX - VIEW_W * 0.4));
    }
  }, [playerX, scene]);

  // Initialize multi-depth snowflakes once
  useEffect(() => {
    const flakes: Snowflake[] = [];
    for (let i = 0; i < 95; i++) {
      const layer = i < 48 ? 0 : i < 80 ? 1 : 2;
      flakes.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        r: layer === 0 ? 0.9 + Math.random() * 0.9 : layer === 1 ? 1.8 + Math.random() * 1.1 : 2.8 + Math.random() * 1.3,
        speedY: layer === 0 ? 18 + Math.random() * 14 : layer === 1 ? 32 + Math.random() * 20 : 46 + Math.random() * 24,
        drift: -6 + Math.random() * 14,
        swayFreq: 0.7 + Math.random() * 1.1,
        swayAmp: layer === 0 ? 6 + Math.random() * 6 : 10 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        alpha: layer === 0 ? 0.22 + Math.random() * 0.22 : layer === 1 ? 0.4 + Math.random() * 0.3 : 0.26 + Math.random() * 0.24,
        softHalo: layer === 2,
      });
    }
    snowRef.current = flakes;
  }, []);

  // Build interactable zones based on current scene & progress
  const zones = useMemo<InteractableZone[]>(() => {
    if (scene === 'ENTRANCE') {
      const canFinish =
        progress.egorJoined &&
        progress.artemJoined &&
        progress.hasKhrumki &&
        progress.hasGazyava &&
        progress.dimaDefeated;

      const list: InteractableZone[] = [
        {
          id: 'DOOR_LUPIK',
          scene: 'ENTRANCE',
          x: 155,
          width: 110,
          label: 'Кв. 5 · Хата Лупика',
          actionText: canFinish ? 'Зайти домой (Финал)' : 'Осмотреть дверь',
        },
        {
          id: 'DOOR_EGOR',
          scene: 'ENTRANCE',
          x: 415,
          width: 110,
          label: 'Кв. 6 · Дверь Егора',
          actionText: progress.egorJoined ? 'Егор уже с тобой' : 'Постучать Егору',
        },
        {
          id: 'DOOR_ARTEM',
          scene: 'ENTRANCE',
          x: 675,
          width: 110,
          label: 'Кв. 7 · Дверь Артёма',
          actionText: progress.artemJoined ? 'Артём уже с тобой' : 'Постучать Артёму',
        },
        {
          id: 'STAIRS_OUT',
          scene: 'ENTRANCE',
          x: 965,
          width: 130,
          label: 'Лестница вниз · Двор',
          actionText: 'Выйти во двор',
          disabledReason:
            !progress.egorJoined || !progress.artemJoined
              ? 'Сначала собери Егора и Артёма на 2 этаже'
              : undefined,
        },
      ];
      return list;
    }

    // STREET scene
    return [
      {
        id: 'STREET_ENTRANCE',
        scene: 'STREET',
        x: 205,
        width: 140,
        label: 'Подъезд №1 · Борбарисово 001',
        actionText:
          progress.hasKhrumki && progress.hasGazyava
            ? 'Вернуться в подъезд (2 этаж)'
            : 'Зайти в подъезд',
      },
      {
        id: 'NEFOR_SPOT',
        scene: 'STREET',
        x: 1365,
        width: 170,
        label: 'За гаражами · Главный Нефор',
        actionText: progress.neforDefeated
          ? 'Поговорить с Нефором'
          : 'Наехать — Отбири лавеху (QTE)',
      },
      {
        id: 'SHOP_DOOR',
        scene: 'STREET',
        x: 2230,
        width: 160,
        label: 'Магаз «Продукты 24»',
        actionText: 'Зайти в магаз',
        disabledReason: !progress.neforDefeated
          ? 'Денег нет! Сначала отбери лавеху у Нефора за гаражами'
          : undefined,
      },
      {
        id: 'DIMA_SPOT',
        scene: 'STREET',
        x: 2960,
        width: 180,
        label: 'За магазом · Главный Злодей Дима',
        actionText: progress.dimaDefeated
          ? 'Поговорить с поверженным Димой'
          : '3D ПВП от 1-го лица (Босс 5000 HP)',
        disabledReason:
          !progress.hasKhrumki || !progress.hasGazyava
            ? 'Сначала купи Хрумки и Газяву в магазе'
            : undefined,
      },
      {
        id: 'WILD_CUCUMBER_PORTAL',
        scene: 'STREET',
        x: 3450,
        width: 180,
        label: 'Фиолетовая трещина · Wild Огурец',
        actionText: progress.wildCucumberDefeated
          ? 'Посмотреть на закрытую трещину'
          : 'Войти в портал · Wild Огурец (10000 HP)',
        disabledReason: !progress.dimaDefeated
          ? 'Сначала разберись с Димой за магазом!'
          : undefined,
      },
    ];
  }, [progress, scene]);

  const zonesRef = useRef(zones);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const triggerZone = useCallback(
    (zone: InteractableZone | null) => {
      if (!zone || isModalOpen) return;
      onInteract(zone.id);
    },
    [isModalOpen, onInteract]
  );

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'ф' || k === 'arrowleft') {
        keysRef.current.left = true;
      } else if (k === 'd' || k === 'в' || k === 'arrowright') {
        keysRef.current.right = true;
      } else if (k === 'e' || k === 'у' || k === ' ' || k === 'enter') {
        e.preventDefault();
        const found = zonesRef.current.find(
          (z) => Math.abs(posRef.current - z.x) <= z.width * 0.65
        );
        if (found) triggerZone(found);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'ф' || k === 'arrowleft') {
        keysRef.current.left = false;
      } else if (k === 'd' || k === 'в' || k === 'arrowright') {
        keysRef.current.right = false;
      }
    };

    const onBlur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
      touchMoveRef.current.left = false;
      touchMoveRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isModalOpen, triggerZone]);

  // Main Canvas animation + physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snowCtx = snowCanvasRef.current?.getContext('2d') ?? null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let rafId = 0;
    let lastTime = performance.now();
    let lastZoneId: string | null = null;
    let syncTimer = 0;
    let coopSyncTimer = 0;

    const drawCharacter = (
      x: number,
      groundY: number,
      facing: 1 | -1,
      walkPhase: number,
      isMoving: boolean,
      config: {
        name: string;
        jacket: string;
        jacketTrim: string;
        hat: string;
        scarf: string;
        pants: string;
        isNefor?: boolean;
      }
    ) => {
      const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * 3.5 : 0;
      const legSwing = isMoving ? Math.sin(walkPhase) * 9 : 0;
      const armSwing = isMoving ? Math.sin(walkPhase) * 7 : 0;

      ctx.save();
      ctx.translate(x, groundY - bob);

      // Ground shadow
      ctx.fillStyle = 'rgba(6, 12, 22, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, bob + 2, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = config.pants;
      // Back leg
      ctx.beginPath();
      ctx.moveTo(-4, -26);
      ctx.lineTo(-4 - legSwing * 0.7, -3);
      ctx.stroke();
      // Front leg
      ctx.beginPath();
      ctx.moveTo(5, -26);
      ctx.lineTo(5 + legSwing * 0.7, -3);
      ctx.stroke();

      // Boots
      ctx.fillStyle = '#181E29';
      ctx.fillRect(-9 - legSwing * 0.7, -5, 11, 6);
      ctx.fillRect(0 + legSwing * 0.7, -5, 11, 6);

      // Torso (Puffer jacket or coat)
      ctx.fillStyle = config.jacket;
      ctx.beginPath();
      ctx.roundRect(-14, -62, 28, 38, 7);
      ctx.fill();

      // Jacket horizontal puff seams or nefor coat flap
      ctx.strokeStyle = config.jacketTrim;
      ctx.lineWidth = 2;
      if (config.isNefor) {
        ctx.fillStyle = config.jacket;
        ctx.fillRect(-15, -34, 30, 14);
      } else {
        ctx.beginPath();
        ctx.moveTo(-13, -49);
        ctx.lineTo(13, -49);
        ctx.moveTo(-13, -38);
        ctx.lineTo(13, -38);
        ctx.stroke();
      }

      // Scarf
      ctx.fillStyle = config.scarf;
      ctx.beginPath();
      ctx.roundRect(-12, -66, 24, 9, 4);
      ctx.fill();
      ctx.fillRect(facing === 1 ? -10 : 3, -60, 7, 15);

      // Arm
      ctx.strokeStyle = config.jacket;
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(facing * 5 - armSwing * 0.5, -37);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#F2C9AC';
      ctx.beginPath();
      ctx.arc(0, -76, 11, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#141B29';
      ctx.fillRect(facing === 1 ? 3 : -6, -79, 2.5, 3);
      ctx.fillRect(facing === 1 ? 7 : -2, -79, 2.5, 3);

      // Hat or Nefor spiky hair
      if (config.isNefor) {
        ctx.fillStyle = '#1D1D26';
        ctx.beginPath();
        ctx.moveTo(-13, -78);
        ctx.lineTo(-15, -91);
        ctx.lineTo(-5, -86);
        ctx.lineTo(0, -96);
        ctx.lineTo(6, -86);
        ctx.lineTo(15, -92);
        ctx.lineTo(12, -78);
        ctx.closePath();
        ctx.fill();
        // Blonde/white streak
        ctx.strokeStyle = '#D9DEE8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-2, -84);
        ctx.lineTo(2, -94);
        ctx.stroke();
      } else {
        // Winter knit beanie
        ctx.fillStyle = config.hat;
        ctx.beginPath();
        ctx.arc(0, -80, 11.5, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-12, -83, 24, 5);
        // Pompom
        ctx.beginPath();
        ctx.arc(0, -93, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crisp name tag above character
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.78)';
      const tagW = ctx.measureText(config.name).width + 14;
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -118, tagW, 19, 5);
      ctx.fill();
      ctx.fillStyle = config.isNefor ? '#FDA4AF' : '#F8FAFC';
      ctx.fillText(config.name, 0, -104);

      ctx.restore();
    };

    const drawKingTigerTank = (
      x: number,
      groundY: number,
      facing: 1 | -1,
      nowSec: number,
      isMoving: boolean
    ) => {
      const rumble = isMoving ? Math.sin(nowSec * 36) * 1.1 : Math.sin(nowSec * 8) * 0.35;

      ctx.save();
      ctx.translate(x, groundY + rumble);

      // Heavy ground shadow
      ctx.fillStyle = 'rgba(6, 12, 22, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 3 - rumble, 64, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw tank chassis flipped according to facing direction
      ctx.save();
      ctx.scale(facing, 1);

      // Tracks outer loop
      ctx.fillStyle = '#181C24';
      ctx.beginPath();
      ctx.roundRect(-52, -24, 104, 24, 10);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Animated track cleats along bottom/top
      const cleatOffset = isMoving ? (nowSec * 90) % 12 : 0;
      ctx.fillStyle = '#475569';
      for (let tx = -42 + cleatOffset; tx < 42; tx += 12) {
        ctx.fillRect(tx, -25, 4, 2);
        ctx.fillRect(tx, -2, 4, 2);
      }

      // Overlapping King Tiger road wheels
      const wheelPositions = [-39, -24, -9, 6, 21, 36];
      for (let i = 0; i < wheelPositions.length; i++) {
        const wx = wheelPositions[i];
        ctx.fillStyle = i % 2 === 0 ? '#5C6450' : '#4A5240';
        ctx.beginPath();
        ctx.arc(wx, -11, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1E242B';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Wheel hub
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(wx, -11, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Side armored mudguards / skirts
      ctx.fillStyle = '#6B705C';
      ctx.beginPath();
      ctx.moveTo(-54, -22);
      ctx.lineTo(54, -22);
      ctx.lineTo(57, -27);
      ctx.lineTo(-50, -27);
      ctx.closePath();
      ctx.fill();

      // Iconic sloped King Tiger hull (front glacis on right, engine deck on left)
      ctx.fillStyle = '#8B8568'; // Dunkelgelb base
      ctx.beginPath();
      ctx.moveTo(-48, -26);
      ctx.lineTo(-42, -45); // sloped rear armor
      ctx.lineTo(28, -45);
      ctx.lineTo(56, -26); // sharp sloped front glacis
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2B2F26';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ambush winter-olive camo patches on hull
      ctx.fillStyle = '#4A5842';
      ctx.beginPath();
      ctx.moveTo(-30, -44);
      ctx.lineTo(-8, -44);
      ctx.lineTo(-16, -28);
      ctx.lineTo(-38, -28);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#D8E3EE'; // Light winter snow dusting on glacis/deck
      ctx.fillRect(-38, -46, 32, 3);
      ctx.beginPath();
      ctx.moveTo(28, -45);
      ctx.lineTo(44, -34);
      ctx.lineTo(40, -32);
      ctx.lineTo(24, -43);
      ctx.closePath();
      ctx.fill();

      // Sloped Henschel King Tiger Turret
      ctx.fillStyle = '#968F70';
      ctx.beginPath();
      ctx.moveTo(-34, -45);
      ctx.lineTo(-27, -69);
      ctx.lineTo(18, -69);
      ctx.lineTo(29, -45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2B2F26';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Turret camo & tactical number "001"
      ctx.fillStyle = '#4A5842';
      ctx.fillRect(-20, -65, 16, 17);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('001', 4, -53);

      // Commander cupola
      ctx.fillStyle = '#6E6952';
      ctx.fillRect(-16, -77, 13, 8);
      ctx.strokeStyle = '#2B2F26';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-16, -77, 13, 8);

      // Gun mantlet (Saukopf / stepped Tiger II mantlet)
      ctx.fillStyle = '#5F5B48';
      ctx.beginPath();
      ctx.roundRect(22, -64, 13, 14, 3);
      ctx.fill();

      // Long 88mm KwK 43 L/71 gun barrel + muzzle brake
      ctx.fillStyle = '#4F4D3F';
      ctx.fillRect(34, -60, 48, 5.5);
      ctx.strokeStyle = '#242620';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(34, -60, 48, 5.5);
      // Double-baffle muzzle brake
      ctx.fillStyle = '#3B3A30';
      ctx.fillRect(80, -62.5, 11, 10.5);
      ctx.strokeRect(80, -62.5, 11, 10.5);

      ctx.restore();

      // Unflipped name tag above turret
      const label = 'Артём · Королевский тигр';
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.85)';
      const tagW = ctx.measureText(label).width + 16;
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -104, tagW, 20, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#FDE68A';
      ctx.fillText(label, 0, -90);

      ctx.restore();
    };

    const drawPickleEgor = (
      x: number,
      groundY: number,
      facing: 1 | -1,
      walkPhase: number,
      isMoving: boolean
    ) => {
      const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * 4 : 0;
      const legSwing = isMoving ? Math.sin(walkPhase) * 8 : 0;

      ctx.save();
      ctx.translate(x, groundY - bob);

      // Ground shadow
      ctx.fillStyle = 'rgba(6, 12, 22, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, bob + 2, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Little winter boots
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -18);
      ctx.lineTo(-6 - legSwing * 0.7, -3);
      ctx.moveTo(6, -18);
      ctx.lineTo(6 + legSwing * 0.7, -3);
      ctx.stroke();

      // Main bumpy green pickle body
      ctx.fillStyle = '#3B8E3A';
      ctx.beginPath();
      ctx.roundRect(-14, -78, 28, 62, 14);
      ctx.fill();
      ctx.strokeStyle = '#1E5622';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pickle bumps/warts
      ctx.fillStyle = '#256B27';
      ctx.beginPath();
      ctx.arc(-8, -62, 2.6, 0, Math.PI * 2);
      ctx.arc(9, -48, 2.8, 0, Math.PI * 2);
      ctx.arc(-7, -34, 2.4, 0, Math.PI * 2);
      ctx.arc(6, -27, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Cozy yellow scarf around pickle
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.roundRect(-15, -46, 30, 8, 3);
      ctx.fill();

      // Expressive eyes + grin
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(facing === 1 ? 2 : -6, -64, 3.6, 0, Math.PI * 2);
      ctx.arc(facing === 1 ? 8 : 0, -64, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(facing === 1 ? 2 : -7, -65, 2.2, 2.5);
      ctx.fillRect(facing === 1 ? 8 : -1, -65, 2.2, 2.5);

      // Name tag
      const label = 'Егор · Огурчик';
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.85)';
      const tagW = ctx.measureText(label).width + 14;
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -104, tagW, 19, 5);
      ctx.fill();
      ctx.fillStyle = '#86EFAC';
      ctx.fillText(label, 0, -90);

      ctx.restore();
    };

    const drawGilbertLupik = (
      x: number,
      groundY: number,
      facing: 1 | -1,
      walkPhase: number,
      isMoving: boolean
    ) => {
      const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * 3.5 : 0;
      const legSwing = isMoving ? Math.sin(walkPhase) * 9 : 0;

      ctx.save();
      ctx.translate(x, groundY - bob);

      // Shadow
      ctx.fillStyle = 'rgba(6, 12, 22, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, bob + 2, 19, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tactical dark olive legs & boots
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1E241C';
      ctx.beginPath();
      ctx.moveTo(-4, -26);
      ctx.lineTo(-4 - legSwing * 0.7, -3);
      ctx.moveTo(5, -26);
      ctx.lineTo(5 + legSwing * 0.7, -3);
      ctx.stroke();
      ctx.fillStyle = '#0B0D0C';
      ctx.fillRect(-9 - legSwing * 0.7, -5, 11, 6);
      ctx.fillRect(0 + legSwing * 0.7, -5, 11, 6);

      // Tactical torso rig (dark charcoal/olive)
      ctx.fillStyle = '#252B21';
      ctx.beginPath();
      ctx.roundRect(-15, -64, 30, 40, 6);
      ctx.fill();
      ctx.strokeStyle = '#111410';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Shotgun shells on chest rig (red & gold from Gilbert reference)
      const shellColors = ['#991B1B', '#B91C1C', '#A16207'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = shellColors[i];
        ctx.fillRect(-6 + i * 5, -45, 3.5, 10);
      }

      // Tan armband on sleeve (from reference)
      ctx.fillStyle = '#8F8245';
      ctx.fillRect(-16, -53, 8, 6);
      ctx.fillRect(8, -53, 8, 6);

      // Gas mask head (dark matte black)
      ctx.fillStyle = '#111315';
      ctx.beginPath();
      ctx.arc(0, -77, 12, 0, Math.PI * 2);
      ctx.fill();

      // Respirator valve & side filter canister
      ctx.fillStyle = '#26292E';
      ctx.beginPath();
      ctx.arc(facing * 3, -72, 4.2, 0, Math.PI * 2);
      ctx.arc(facing * 9, -71, 4.8, 0, Math.PI * 2);
      ctx.fill();

      // Slanted glowing red tactical visor eyes (Gilbert signature)
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      if (facing === 1) {
        ctx.moveTo(-2, -80);
        ctx.lineTo(3, -78.5);
        ctx.moveTo(6, -78.5);
        ctx.lineTo(10, -80);
      } else {
        ctx.moveTo(-10, -80);
        ctx.lineTo(-6, -78.5);
        ctx.moveTo(-3, -78.5);
        ctx.lineTo(2, -80);
      }
      ctx.stroke();

      // Olive/tan helmet + side white flashlight
      ctx.fillStyle = '#7D7440';
      ctx.beginPath();
      ctx.arc(0, -81, 12.5, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-13, -84, 26, 5);
      // Helmet flashlight on side
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(-facing * 11, -86, 3, 0, Math.PI * 2);
      ctx.fill();

      // Name tag
      const label = 'Лупик · Гилберт';
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.85)';
      const tagW = ctx.measureText(label).width + 14;
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -118, tagW, 19, 5);
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.fillText(label, 0, -104);

      ctx.restore();
    };

    const drawKnightDima = (
      x: number,
      groundY: number,
      defeated: boolean,
      nowSec: number
    ) => {
      const bob = defeated ? 0 : Math.sin(nowSec * 3.2) * 1.6;
      ctx.save();
      ctx.translate(x, groundY + bob);

      // Shadow
      ctx.fillStyle = 'rgba(6, 12, 22, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 2 - bob, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#18181B';
      ctx.beginPath();
      ctx.moveTo(-5, -26);
      ctx.lineTo(-6, -3);
      ctx.moveTo(5, -26);
      ctx.lineTo(6, -3);
      ctx.stroke();

      // Dark burgundy hoodie
      ctx.fillStyle = '#3B1820';
      ctx.beginPath();
      ctx.roundRect(-16, -64, 32, 40, 7);
      ctx.fill();
      ctx.strokeStyle = '#230D13';
      ctx.lineWidth = 2;
      ctx.stroke();

      // White chest print on hoodie
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '800 8px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('КАЗ', 0, -45);

      // Baguette sword in right hand (left side in canvas when facing left)
      ctx.fillStyle = '#D97706';
      ctx.save();
      ctx.translate(-19, -46);
      ctx.rotate(-0.22);
      ctx.beginPath();
      ctx.roundRect(-4, -34, 8, 42, 4);
      ctx.fill();
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Head
      ctx.fillStyle = '#F2C9AC';
      ctx.beginPath();
      ctx.arc(0, -75, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#141B29';
      ctx.fillRect(-6, -77, 2.5, 3);
      ctx.fillRect(-2, -77, 2.5, 3);

      // White enameled cooking pot helmet with dark rim & two side handles!
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.roundRect(-15, -99, 30, 20, 4);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pot handles on left and right
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-16, -89, 4, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, -89, 4, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      // Dark bottom rim of pot
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-16, -81, 32, 3);

      // Round grey pot lid shield held in front
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath();
      ctx.arc(13, -46, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Center knob on pot lid
      ctx.fillStyle = '#1F2937';
      ctx.beginPath();
      ctx.arc(13, -46, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Name tag
      const label = defeated ? 'Дима (повержен)' : 'Дима · Кастрюльный Рыцарь';
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.88)';
      const tagW = ctx.measureText(label).width + 14;
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -124, tagW, 19, 5);
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.fillText(label, 0, -110);

      ctx.restore();
    };

    const drawEntranceScene = (nowSec: number) => {
      // Upper plaster wall
      ctx.fillStyle = '#D2CCBB';
      ctx.fillRect(0, 0, ENTRANCE_WORLD_W, 250);

      // Classic Russian panelka green painted lower wall
      ctx.fillStyle = '#2B5449';
      ctx.fillRect(0, 250, ENTRANCE_WORLD_W, 175);
      ctx.fillStyle = '#1F3E35';
      ctx.fillRect(0, 246, ENTRANCE_WORLD_W, 6);

      // Tiled stairwell floor
      ctx.fillStyle = '#47525E';
      ctx.fillRect(0, 425, ENTRANCE_WORLD_W, 75);
      ctx.strokeStyle = '#36404A';
      ctx.lineWidth = 1.5;
      for (let tx = 0; tx < ENTRANCE_WORLD_W; tx += 56) {
        ctx.beginPath();
        ctx.moveTo(tx, 425);
        ctx.lineTo(tx - 24, 500);
        ctx.stroke();
      }

      // Frosted stairwell window on left-center showing winter dusk + falling snow outside
      ctx.fillStyle = '#182A42';
      ctx.fillRect(265, 70, 90, 130);
      ctx.save();
      ctx.beginPath();
      ctx.rect(265, 70, 90, 130);
      ctx.clip();
      for (let i = 0; i < 14; i++) {
        const wx = 268 + ((8400 + i * 23 + Math.sin(nowSec * 0.8 + i) * 6 + nowSec * 4) % 84);
        const wy = 72 + ((i * 19 + nowSec * (18 + (i % 3) * 7)) % 126);
        ctx.fillStyle = `rgba(226, 238, 252, ${0.35 + (i % 3) * 0.15})`;
        ctx.beginPath();
        ctx.arc(wx, wy, 1.2 + (i % 2) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#EFECE2';
      ctx.lineWidth = 5;
      ctx.strokeRect(265, 70, 90, 130);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(310, 70);
      ctx.lineTo(310, 200);
      ctx.moveTo(265, 135);
      ctx.lineTo(355, 135);
      ctx.stroke();

      // Cast iron radiator under window
      ctx.fillStyle = '#C9C4B7';
      for (let rx = 274; rx < 346; rx += 11) {
        ctx.fillRect(rx, 345, 7, 52);
      }

      // Wall stencil: "БОРБАРИСОВО 001 · 2 ЭТАЖ"
      ctx.fillStyle = '#1E3A32';
      ctx.font = '800 18px Rubik, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('2 ЭТАЖ · БОРБАРИСОВО 001', 42, 48);

      // Notice board
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(520, 115, 92, 68);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(520, 115, 92, 68);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(530, 126, 30, 24);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(568, 128, 34, 38);

      // Helper to draw apartment doors
      const drawAptDoor = (
        dx: number,
        num: string,
        resident: string,
        color: string,
        highlight: boolean
      ) => {
        // Door frame
        ctx.fillStyle = '#272C35';
        ctx.fillRect(dx - 46, 178, 92, 247);
        // Door panel
        ctx.fillStyle = color;
        ctx.fillRect(dx - 40, 184, 80, 241);
        // Inner trim
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 32, 196, 64, 96);
        ctx.strokeRect(dx - 32, 304, 64, 108);
        // Handle
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(dx + 22, 306, 12, 5);
        // Number plate
        ctx.fillStyle = highlight ? '#F59E0B' : '#0F172A';
        ctx.beginPath();
        ctx.roundRect(dx - 28, 212, 56, 26, 4);
        ctx.fill();
        ctx.fillStyle = highlight ? '#0B1320' : '#F8FAFC';
        ctx.font = '700 12px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`КВ ${num}`, dx, 229);

        // Resident name label above door
        ctx.fillStyle = '#1E293B';
        ctx.font = '700 13px Manrope, sans-serif';
        ctx.fillText(resident, dx, 165);
      };

      const readyToGoHome =
        progress.egorJoined &&
        progress.artemJoined &&
        progress.hasKhrumki &&
        progress.hasGazyava;

      drawAptDoor(155, '5', 'ЛУПИК (ДОМ)', '#5A3D2B', readyToGoHome);
      drawAptDoor(415, '6', progress.egorJoined ? 'ЕГОР (С НАМИ)' : 'ЕГОР', '#3F4B5B', !progress.egorJoined);
      drawAptDoor(675, '7', progress.artemJoined ? 'АРТЁМ (С НАМИ)' : 'АРТЁМ', '#4B433B', !progress.artemJoined);

      // Stairwell down on the right
      ctx.fillStyle = '#182436';
      ctx.fillRect(885, 160, 170, 265);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(885, 160, 170, 265);

      // Steps descending
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#384659' : '#2C3848';
        ctx.fillRect(895 + s * 14, 340 + s * 14, 145 - s * 14, 14);
      }

      // Metal handrail
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(885, 310);
      ctx.lineTo(1045, 395);
      ctx.stroke();

      // Exit sign
      const exitGlow = 0.7 + 0.3 * Math.sin(nowSec * 3);
      ctx.fillStyle = progress.egorJoined && progress.artemJoined
        ? `rgba(245, 158, 11, ${exitGlow})`
        : '#334155';
      ctx.beginPath();
      ctx.roundRect(905, 122, 130, 26, 5);
      ctx.fill();
      ctx.fillStyle = progress.egorJoined && progress.artemJoined ? '#0B1320' : '#CBD5E1';
      ctx.font = '700 12px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ВО ДВОР ↓', 970, 139);
    };

    const drawStreetScene = (camX: number, nowSec: number) => {
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      skyGrad.addColorStop(0, '#0B1322');
      skyGrad.addColorStop(0.65, '#172842');
      skyGrad.addColorStop(1, '#253957');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Moon
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.beginPath();
      ctx.arc(920 - camX * 0.08, 72, 24, 0, Math.PI * 2);
      ctx.fill();

      // Distant panelka silhouettes (parallax 0.25)
      ctx.save();
      ctx.translate(-camX * 0.25, 0);
      ctx.fillStyle = '#111D30';
      for (let bx = 40; bx < 2200; bx += 290) {
        const bh = 210 + ((bx * 37) % 80);
        ctx.fillRect(bx, 405 - bh, 210, bh);
        // Distant tiny warm windows
        for (let wy = 405 - bh + 20; wy < 380; wy += 32) {
          for (let wx = bx + 18; wx < bx + 190; wx += 34) {
            if ((wx + wy) % 3 !== 0) {
              ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
              ctx.fillRect(wx, wy, 14, 16);
            }
          }
        }
        ctx.fillStyle = '#111D30';
      }
      ctx.restore();

      // Main world layer
      ctx.save();
      ctx.translate(-camX, 0);

      // Snow ground
      ctx.fillStyle = '#CBD9E8';
      ctx.fillRect(0, 415, STREET_WORLD_W, 85);
      // Darker trodden snowy footpath
      ctx.fillStyle = '#9FB4CA';
      ctx.fillRect(0, 423, STREET_WORLD_W, 18);

      // 1. Panel Building "Борбарисово 001" (left: x 30..440)
      ctx.fillStyle = '#334559';
      ctx.fillRect(40, 45, 380, 370);
      // Roof snow cap
      ctx.fillStyle = '#E2EDF7';
      ctx.fillRect(36, 40, 388, 10);
      // Panel grid lines
      ctx.strokeStyle = '#253445';
      ctx.lineWidth = 2;
      for (let px = 40; px <= 420; px += 76) {
        ctx.beginPath();
        ctx.moveTo(px, 45);
        ctx.lineTo(px, 415);
        ctx.stroke();
      }
      for (let py = 115; py < 415; py += 72) {
        ctx.beginPath();
        ctx.moveTo(40, py);
        ctx.lineTo(420, py);
        ctx.stroke();
      }
      // Apartment windows (lit & dark)
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
          const wx = 58 + col * 76;
          const wy = 66 + row * 72;
          if (row === 3 && col === 2) continue; // entrance slot
          const lit = (row + col) % 2 === 0;
          ctx.fillStyle = lit ? '#FBBF24' : '#1E2D3D';
          ctx.fillRect(wx, wy, 40, 36);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, wy, 40, 36);
        }
      }

      // House plaque "БОРБАРИСОВО 001"
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(285, 290, 122, 30);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(287, 292, 118, 26);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('БОРБАРИСОВО 001', 346, 309);

      // Entrance Canopy & Door (x: 205)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(160, 315, 90, 100);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(172, 328, 66, 87);
      // Canopy with snow
      ctx.fillStyle = '#475569';
      ctx.fillRect(148, 305, 114, 12);
      ctx.fillStyle = '#E2EDF7';
      ctx.fillRect(148, 299, 114, 7);
      // Warm entrance bulb
      ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.beginPath();
      ctx.arc(205, 345, 42, 0, Math.PI * 2);
      ctx.fill();

      // Snowy Bench & Birch trees in courtyard
      ctx.fillStyle = '#78350F';
      ctx.fillRect(520, 392, 68, 8);
      ctx.fillRect(530, 400, 6, 16);
      ctx.fillRect(574, 400, 6, 16);
      ctx.fillStyle = '#E2EDF7';
      ctx.fillRect(520, 388, 68, 5);

      // Birch trees
      const drawBirch = (tx: number, h: number) => {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(tx - 6, 415 - h, 12, h);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(tx - 6, 415 - h * 0.7, 7, 4);
        ctx.fillRect(tx, 415 - h * 0.4, 6, 4);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx, 415 - h + 25);
        ctx.lineTo(tx - 28, 415 - h - 10);
        ctx.moveTo(tx, 415 - h + 40);
        ctx.lineTo(tx + 30, 415 - h + 5);
        ctx.stroke();
      };
      drawBirch(640, 175);
      drawBirch(890, 155);

      // Streetlamp helper
      const drawLamp = (lx: number) => {
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 3, 185, 6, 230);
        ctx.fillRect(lx - 3, 185, 28, 5);
        // Warm glow cone
        const glow = ctx.createRadialGradient(lx + 20, 196, 4, lx + 20, 260, 140);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lx + 20, 240, 140, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(lx + 20, 194, 7, 0, Math.PI * 2);
        ctx.fill();
      };

      drawLamp(470);
      drawLamp(1260);
      drawLamp(1940);

      // Signpost in courtyard (x: 780)
      ctx.fillStyle = '#475569';
      ctx.fillRect(777, 325, 6, 90);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(725, 332, 118, 22);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ЗА ГАРАЖИ →', 784, 347);

      // 2. Garages Zone ("ЗА ГАРАЖАМИ", x: 1050..1620)
      for (let g = 0; g < 4; g++) {
        const gx = 1050 + g * 138;
        ctx.fillStyle = g % 2 === 0 ? '#3E4C5E' : '#354252';
        ctx.fillRect(gx, 255, 130, 160);
        // Garage doors
        ctx.fillStyle = '#293545';
        ctx.fillRect(gx + 12, 276, 106, 139);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx + 65, 276);
        ctx.lineTo(gx + 65, 415);
        ctx.stroke();
        // Snow on garage roof
        ctx.fillStyle = '#E2EDF7';
        ctx.beginPath();
        ctx.roundRect(gx - 4, 245, 138, 13, 5);
        ctx.fill();
      }
      // Graffiti tag on garage
      ctx.fillStyle = '#F59E0B';
      ctx.font = '800 16px Rubik, sans-serif';
      ctx.fillText('ЗА ГАРАЖАМИ', 1365, 232);

      // Главный Нефор NPC standing at x: 1410 (or 1460 after defeat)
      const neforX = progress.neforDefeated ? 1475 : 1405;
      drawCharacter(
        neforX,
        426,
        -1,
        nowSec * 2,
        false,
        {
          name: progress.neforDefeated ? 'Нефор (сдал лавеху)' : 'Главный Нефор',
          jacket: '#1F242D',
          jacketTrim: '#374151',
          hat: '#111827',
          scarf: '#DC2626',
          pants: '#18181B',
          isNefor: true,
        }
      );

      // 3. Corner Shop "МАГАЗ ПРОДУКТЫ" (x: 2040..2460)
      ctx.fillStyle = '#47362B';
      ctx.fillRect(2050, 200, 380, 215);
      // Snow roof
      ctx.fillStyle = '#E2EDF7';
      ctx.beginPath();
      ctx.roundRect(2038, 188, 404, 16, 6);
      ctx.fill();

      // Warm lit shop window
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(2075, 258, 110, 92);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(2088, 300, 22, 36); // chips packet silhouette
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(2125, 294, 14, 42); // soda bottle silhouette
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;
      ctx.strokeRect(2075, 258, 110, 92);

      // Shop Door (x: 2230)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(2205, 268, 72, 147);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(2215, 278, 52, 75);

      // Shop Sign "МАГАЗ 24 · ХРУМКИ И ГАЗЯВА"
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(2070, 212, 340, 34);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(2070, 212, 340, 34);
      ctx.fillStyle = '#FBBF24';
      ctx.font = '800 15px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('МАГАЗ · ПРОДУКТЫ', 2240, 234);

      // 4. Behind the Shop: "ЗА МАГАЗОМ · ГАРАЖИ И БОСС ДИМА" (x: 2560..3320)
      for (let bg = 0; bg < 4; bg++) {
        const gx = 2600 + bg * 165;
        ctx.fillStyle = bg % 2 === 0 ? '#374151' : '#2D3748';
        ctx.fillRect(gx, 248, 154, 167);
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(gx + 14, 272, 126, 143);
        // Corrugated lines
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx + 77, 272);
        ctx.lineTo(gx + 77, 415);
        ctx.stroke();
        // Snow on garage roof
        ctx.fillStyle = '#E2EDF7';
        ctx.beginPath();
        ctx.roundRect(gx - 4, 238, 162, 13, 5);
        ctx.fill();
        // Number plate
        ctx.fillStyle = '#F59E0B';
        ctx.font = '700 11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`0${bg + 1}`, gx + 77, 265);
      }

      drawLamp(2680);
      drawLamp(3140);

      // Crates & spare tires
      ctx.fillStyle = '#5B4028';
      ctx.fillRect(2750, 368, 48, 47);
      ctx.fillRect(3160, 365, 52, 50);

      // Boss Graffiti
      ctx.fillStyle = '#EF4444';
      ctx.font = '800 18px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ГАРАЖИ ЗА МАГАЗОМ · БОСС ДИМА (5000 HP)', 2960, 224);

      // Главный Злодей Дима NPC (Рыцарь-кастрюльник)
      const dimaX = progress.dimaDefeated ? 3040 : 2960;
      drawKnightDima(dimaX, 426, progress.dimaDefeated, nowSec);

      // Purple Crack Portal at x: 3450 (Wild Огурец 10000 HP)
      ctx.save();
      ctx.translate(3450, 310);
      const portalGlow = 0.75 + 0.25 * Math.sin(nowSec * 6);
      ctx.fillStyle = `rgba(168, 85, 247, ${0.35 * portalGlow})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48, 76, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner void
      ctx.fillStyle = progress.wildCucumberDefeated ? '#0f172a' : '#2e1065';
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 62, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lightning arcs inside portal (if active)
      if (!progress.wildCucumberDefeated) {
        ctx.strokeStyle = '#f3e8ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-14 + Math.sin(nowSec * 12) * 8, -35);
        ctx.lineTo(10 + Math.cos(nowSec * 14) * 8, 2);
        ctx.lineTo(-8, 38);
        ctx.stroke();
      }

      ctx.restore();

      // Portal Label
      ctx.fillStyle = progress.wildCucumberDefeated ? '#94a3b8' : '#c084fc';
      ctx.font = '800 16px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        progress.wildCucumberDefeated
          ? 'ФИОЛЕТОВАЯ ТРЕЩИНА (ЗАКРЫТА)'
          : 'ФИОЛЕТОВАЯ ТРЕЩИНА · WILD ОГУРЕЦ (10000 HP)',
        3450,
        215
      );

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const nowSec = now / 1000;

      const worldW = scene === 'ENTRANCE' ? ENTRANCE_WORLD_W : STREET_WORLD_W;
      const moveDir = isModalOpen
        ? 0
        : (keysRef.current.right || touchMoveRef.current.right ? 1 : 0) -
          (keysRef.current.left || touchMoveRef.current.left ? 1 : 0);

      const speed = 260;
      const isMoving = moveDir !== 0;

      if (isMoving) {
        facingRef.current = moveDir > 0 ? 1 : -1;
        posRef.current = Math.max(55, Math.min(worldW - 55, posRef.current + moveDir * speed * dt));
        walkPhaseRef.current += dt * 11;

        stepCooldownRef.current -= dt;
        if (stepCooldownRef.current <= 0) {
          soundFX.playFootstep(scene === 'STREET');
          stepCooldownRef.current = 0.28;
        }
      } else {
        walkPhaseRef.current = 0;
      }

      // Smooth companion following logic
      const targetEgor = posRef.current - facingRef.current * 56;
      const diffEgor = targetEgor - egorPosRef.current;
      const egorMoving = Math.abs(diffEgor) > 4;
      if (egorMoving) {
        egorPosRef.current += diffEgor * Math.min(1, dt * 6);
      }

      const targetArtem = posRef.current - facingRef.current * (progress.artemTankSkin ? 142 : 110);
      const diffArtem = targetArtem - artemPosRef.current;
      const artemMoving = Math.abs(diffArtem) > 4;
      if (artemMoving) {
        artemPosRef.current += diffArtem * Math.min(1, dt * 5);
      }

      // Camera tracking
      const targetCam =
        scene === 'ENTRANCE'
          ? 0
          : Math.max(0, Math.min(STREET_WORLD_W - VIEW_W, posRef.current - VIEW_W * 0.42));
      cameraXRef.current += (targetCam - cameraXRef.current) * Math.min(1, dt * 7);

      // Periodically sync React playerX without re-triggering external jump snap
      syncTimer += dt;
      if (syncTimer > 0.25) {
        syncTimer = 0;
        lastSyncedXRef.current = posRef.current;
        setPlayerX(posRef.current);
      }

      // Periodically broadcast 2D co-op pose when connected
      coopSyncTimer += dt;
      if (coopSyncTimer > 0.075 && onCoopSyncStateRef.current) {
        coopSyncTimer = 0;
        onCoopSyncStateRef.current({
          screen: 'PLAYING',
          scene,
          worldX: posRef.current,
          worldFacing: facingRef.current,
          x: 0,
          y: 0,
          z: 9,
          yaw: 0,
          hp: progress.artemTankSkin ? 200 : 100,
          maxHp: progress.artemTankSkin ? 200 : 100,
          fighter: coopFighterRef.current,
          minion: coopMinionRef.current,
          isKingTiger: progress.artemTankSkin,
          isPickle: progress.egorPickleSkin,
          isGilbert: progress.lupikGilbertSkin,
          moving: isMoving,
          dashing: false,
          attacking: false,
        });
      }

      // Check nearest interactable
      const foundZone =
        zonesRef.current.find((z) => Math.abs(posRef.current - z.x) <= z.width * 0.65) || null;
      if ((foundZone?.id ?? null) !== lastZoneId) {
        lastZoneId = foundZone?.id ?? null;
        setActiveZone(foundZone);
      }

      // Render
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      if (scene === 'ENTRANCE') {
        drawEntranceScene(nowSec);
      } else {
        drawStreetScene(cameraXRef.current, nowSec);
      }

      // Draw Characters in world coordinates
      ctx.save();
      ctx.translate(-cameraXRef.current, 0);

      const groundY = 428;

      if (progress.artemJoined) {
        const artemFacing: 1 | -1 = Math.abs(diffArtem) > 2 ? (diffArtem >= 0 ? 1 : -1) : facingRef.current;
        if (progress.artemTankSkin) {
          drawKingTigerTank(
            artemPosRef.current,
            groundY,
            artemFacing,
            nowSec,
            artemMoving
          );
        } else {
          drawCharacter(
            artemPosRef.current,
            groundY,
            artemFacing,
            artemMoving ? nowSec * 11 : 0,
            artemMoving,
            {
              name: 'Артём',
              jacket: '#166534',
              jacketTrim: '#14532D',
              hat: '#1E293B',
              scarf: '#94A3B8',
              pants: '#1E293B',
            }
          );
        }
      }

      if (progress.egorJoined) {
        const egorFacing: 1 | -1 = Math.abs(diffEgor) > 2 ? (diffEgor >= 0 ? 1 : -1) : facingRef.current;
        if (progress.egorPickleSkin) {
          drawPickleEgor(
            egorPosRef.current,
            groundY,
            egorFacing,
            egorMoving ? nowSec * 11 + 1.2 : 0,
            egorMoving
          );
        } else {
          drawCharacter(
            egorPosRef.current,
            groundY,
            egorFacing,
            egorMoving ? nowSec * 11 + 1.2 : 0,
            egorMoving,
            {
              name: 'Егор',
              jacket: '#B45309',
              jacketTrim: '#92400E',
              hat: '#334155',
              scarf: '#FDE68A',
              pants: '#1E293B',
            }
          );
        }
      }

      // Remote co-op teammates currently in the same 2D scene
      const remoteMap = coopRemoteStatesRefProp.current?.current;
      if (remoteMap) {
        const nowMs = Date.now();
        for (const r of Object.values(remoteMap)) {
          if (!r || r.id === coopLocalIdRef.current) continue;
          if (r.screen !== 'PLAYING' || r.scene !== scene) continue;
          if (nowMs - r.updatedAt > 6000) continue;

          const curX = remote2dXRef.current[r.id] ?? r.worldX;
          const nextX = curX + (r.worldX - curX) * Math.min(1, dt * 12);
          remote2dXRef.current[r.id] = nextX;
          const rFacing: 1 | -1 = r.worldFacing === -1 ? -1 : 1;
          const rWalk = r.moving ? nowSec * 11 : 0;

          if (r.fighter === 'ARTEM' && r.isKingTiger) {
            drawKingTigerTank(nextX, groundY, rFacing, nowSec, r.moving);
          } else if (r.fighter === 'EGOR' && r.isPickle) {
            drawPickleEgor(nextX, groundY, rFacing, rWalk, r.moving);
          } else if (r.fighter === 'LUPIK' && r.isGilbert) {
            drawGilbertLupik(nextX, groundY, rFacing, rWalk, r.moving);
          } else {
            drawCharacter(nextX, groundY, rFacing, rWalk, r.moving, {
              name: r.nickname,
              jacket:
                r.fighter === 'EGOR' ? '#B45309' : r.fighter === 'ARTEM' ? '#166534' : '#0284C7',
              jacketTrim:
                r.fighter === 'EGOR' ? '#92400E' : r.fighter === 'ARTEM' ? '#14532D' : '#0369A1',
              hat: '#0F172A',
              scarf: r.fighter === 'EGOR' ? '#FDE68A' : '#38BDF8',
              pants: '#1E293B',
            });
          }

          if (
            (r.fighter === 'ARTEM' && r.isKingTiger) ||
            (r.fighter === 'EGOR' && r.isPickle) ||
            (r.fighter === 'LUPIK' && r.isGilbert)
          ) {
            ctx.font = '700 11px Rubik, sans-serif';
            ctx.textAlign = 'center';
            const badge = `КООП · ${r.nickname}`;
            const bw = ctx.measureText(badge).width + 12;
            ctx.fillStyle = 'rgba(14, 165, 233, 0.88)';
            ctx.beginPath();
            ctx.roundRect(nextX - bw / 2, groundY - 140, bw, 17, 4);
            ctx.fill();
            ctx.fillStyle = '#0B1320';
            ctx.fillText(badge, nextX, groundY - 128);
          }
        }
      }

      // Main Hero: Лупик (or Gilbert skin on F3)
      if (progress.lupikGilbertSkin) {
        drawGilbertLupik(posRef.current, groundY, facingRef.current, walkPhaseRef.current, isMoving);
      } else {
        drawCharacter(posRef.current, groundY, facingRef.current, walkPhaseRef.current, isMoving, {
          name: 'Лупик',
          jacket: '#1D4ED8',
          jacketTrim: '#1E40AF',
          hat: '#0F172A',
          scarf: '#F59E0B',
          pants: '#1E293B',
        });
      }

      // Cold breath puffs outdoors
      if (scene === 'STREET') {
        puffTimerRef.current -= dt;
        if (puffTimerRef.current <= 0) {
          puffTimerRef.current = 1.6;
          puffsRef.current.push({
            x: posRef.current + facingRef.current * 10,
            y: groundY - 75,
            vx: facingRef.current * 14,
            vy: -14,
            life: 0,
            maxLife: 0.9,
          });
        }
        puffsRef.current = puffsRef.current.filter((p) => {
          p.life += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const alpha = Math.max(0, 1 - p.life / p.maxLife) * 0.45;
          ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 + p.life * 6, 0, Math.PI * 2);
          ctx.fill();
          return p.life < p.maxLife;
        });
      }

      // Highlight prompt marker above active interactable in world
      if (foundZone && !isModalOpen) {
        const pulseY = Math.sin(nowSec * 5) * 4;
        ctx.fillStyle = foundZone.disabledReason ? '#334155' : '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(foundZone.x - 16, 265 + pulseY, 32, 26, 6);
        ctx.fill();
        ctx.fillStyle = foundZone.disabledReason ? '#CBD5E1' : '#0B1320';
        ctx.font = '800 14px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('E', foundZone.x, 283 + pulseY);
      }

      ctx.restore();

      // Lightweight falling snow overlay above WorldCanvas
      if (snowCtx) {
        snowCtx.clearRect(0, 0, VIEW_W, VIEW_H);
        const isStreet = scene === 'STREET';
        const flakeLimit = isStreet ? snowRef.current.length : 40;
        const alphaScale = isStreet ? 1 : 0.34;
        const speedScale = isStreet ? 1 : 0.72;

        for (let i = 0; i < flakeLimit; i++) {
          const flake = snowRef.current[i];
          if (!reducedMotion) {
            flake.y += flake.speedY * speedScale * dt;
            flake.x += (flake.drift + Math.sin(nowSec * flake.swayFreq + flake.phase) * flake.swayAmp) * dt;
            if (flake.y > VIEW_H + 8) {
              flake.y = -8;
              flake.x = Math.random() * VIEW_W;
            }
            if (flake.x > VIEW_W + 8) flake.x = -6;
            if (flake.x < -8) flake.x = VIEW_W + 6;
          }

          const alpha = flake.alpha * alphaScale;
          if (flake.softHalo) {
            snowCtx.fillStyle = `rgba(226, 240, 255, ${alpha * 0.25})`;
            snowCtx.beginPath();
            snowCtx.arc(flake.x, flake.y, flake.r * 2.1, 0, Math.PI * 2);
            snowCtx.fill();
          }
          snowCtx.fillStyle = `rgba(241, 248, 255, ${alpha})`;
          snowCtx.beginPath();
          snowCtx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
          snowCtx.fill();
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    isModalOpen,
    progress.artemJoined,
    progress.artemTankSkin,
    progress.dimaDefeated,
    progress.egorJoined,
    progress.egorPickleSkin,
    progress.hasGazyava,
    progress.hasKhrumki,
    progress.lupikGilbertSkin,
    progress.neforDefeated,
    scene,
    setPlayerX,
  ]);

  // Objective hint arrow for street navigation
  const streetTargetX =
    questStage === 'GO_TO_GARAGES' || questStage === 'FIGHT_NEFOR'
      ? 1365
      : questStage === 'GO_TO_SHOP'
      ? 2230
      : questStage === 'FIGHT_DIMA'
      ? 2960
      : 205;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
      {/* Main Playable 2D Canvas */}
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-700/70 bg-[#0B1320] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="w-full h-auto block aspect-[1120/500] select-none"
        />
        <canvas
          ref={snowCanvasRef}
          width={VIEW_W}
          height={VIEW_H}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none z-10 select-none"
        />

        {/* Street Location Bar (unobtrusive top-left inside frame) */}
        {scene === 'STREET' && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-xs">
            <div className="bg-[#0B1320]/85 border border-slate-700/70 rounded-lg px-3 py-1.5 text-slate-200 backdrop-blur-xs">
              <span>Подъезд 001</span>
              <span className="mx-2 text-slate-500">·</span>
              <span className={questStage === 'GO_TO_GARAGES' || questStage === 'FIGHT_NEFOR' ? 'text-amber-400 font-semibold' : ''}>
                За гаражами
              </span>
              <span className="mx-2 text-slate-500">·</span>
              <span className={questStage === 'GO_TO_SHOP' ? 'text-amber-400 font-semibold' : ''}>
                Магаз
              </span>
              <span className="mx-2 text-slate-500">·</span>
              <span className={questStage === 'FIGHT_DIMA' ? 'text-rose-400 font-semibold' : ''}>
                За магазом (Дима)
              </span>
            </div>

            {Math.abs(playerX - streetTargetX) > 220 && (
              <div className="bg-[#0B1320]/85 border border-amber-500/40 rounded-lg px-3 py-1.5 text-amber-300 font-medium backdrop-blur-xs">
                {playerX < streetTargetX ? 'Иди направо →' : '← Иди налево'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tactile Bottom Controls & Contextual Action Bar (zero overlap with canvas) */}
      <div className="bg-[#111B2B] border border-slate-700/60 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Movement Pad */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={() => {
              touchMoveRef.current.left = true;
            }}
            onMouseUp={() => {
              touchMoveRef.current.left = false;
            }}
            onMouseLeave={() => {
              touchMoveRef.current.left = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              touchMoveRef.current.left = true;
            }}
            onTouchEnd={() => {
              touchMoveRef.current.left = false;
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1A283F] hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-xs font-semibold border border-slate-600/60 select-none whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Налево (A)</span>
          </button>

          <button
            type="button"
            onMouseDown={() => {
              touchMoveRef.current.right = true;
            }}
            onMouseUp={() => {
              touchMoveRef.current.right = false;
            }}
            onMouseLeave={() => {
              touchMoveRef.current.right = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              touchMoveRef.current.right = true;
            }}
            onTouchEnd={() => {
              touchMoveRef.current.right = false;
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1A283F] hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-xs font-semibold border border-slate-600/60 select-none whitespace-nowrap shrink-0 transition-colors"
          >
            <span>Направо (D)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Active Contextual Interaction Button */}
        <div className="flex-1 flex items-center justify-end gap-3 min-w-[240px]">
          {activeZone ? (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-200">
                  {activeZone.label}
                </div>
                {activeZone.disabledReason && (
                  <div className="text-xs text-rose-400">
                    {activeZone.disabledReason}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => triggerZone(activeZone)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white ${
                  activeZone.disabledReason
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>[E] {activeZone.actionText}</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              Подойди к двери, персонажу или входу и нажми E
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

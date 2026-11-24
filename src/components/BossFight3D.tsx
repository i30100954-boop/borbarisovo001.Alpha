import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Bird, Crosshair, Flame, Footprints, Heart, Home, Radar, RotateCcw, Shield, Skull, Sparkles, Utensils, Volume2, VolumeX, Zap } from 'lucide-react';
import { soundFX } from '../audio/soundFx';
import {
  ASSETS,
  BossVictoryStats,
  FighterId,
  GameProgress,
  MinionId,
  NetBossEvent,
  NetBossPhase,
  NetBossState,
  NetPlayer,
  NetPlayerPose,
  NetRemoteAttackEvent,
  NetRemotePlayerState,
  TrainingStartTarget,
} from '../types/game';

interface BossFight3DProps {
  fighter: FighterId;
  minion: MinionId;
  progress: GameProgress;
  isBossRush?: boolean;
  trainingTarget?: TrainingStartTarget | null;
  bossId?: 'DIMA' | 'WILD_CUCUMBER';
  onVictory: (stats?: BossVictoryStats) => void;
  onChangeFighter: () => void;
  onBackToMenu?: () => void;
  onChangeTrainingPhase?: (target: TrainingStartTarget) => void;
  coopPlayersCount?: number;
  coopLocalPlayerId?: string | null;
  coopIsHost?: boolean;
  coopPlayers?: NetPlayer[];
  coopRemoteStatesRef?: MutableRefObject<Record<string, NetRemotePlayerState>>;
  coopBossStateRef?: MutableRefObject<NetBossState | null>;
  coopRemoteHit?: { seq: number; attackerName: string; amount: number } | null;
  onCoopDamageDealt?: (amount: number, sourceKind: string) => void;
  onCoopSyncState?: (pose: NetPlayerPose) => void;
  onCoopAttack?: (ev: Omit<NetRemoteAttackEvent, 'playerId' | 'nickname'>) => void;
  subscribeCoopAttack?: (cb: (ev: NetRemoteAttackEvent) => void) => () => void;
  onCoopSyncBossState?: (bossState: NetBossState) => void;
  onCoopBossEvent?: (ev: NetBossEvent) => void;
  onCoopBossStomp?: () => void;
  subscribeCoopBossEvent?: (cb: (ev: NetBossEvent) => void) => () => void;
  subscribeCoopRemoteHit?: (
    cb: (hit: { sharedBossHp: number; maxBossHp: number; attackerId: string; attackerName: string; amount: number }) => void
  ) => () => void;
}

const ARTEM_AIRSTRIKE_COST = 260;
const ARTEM_AIRSTRIKE_DAMAGE = 315;
const ARTEM_BASE_DMG = 52;
const ARTEM_KT_BONUS_DMG = 8;
const ARTEM_ARMOR_CD = 15;
const ARTEM_ARMOR_DURATION = 3.5;
const ARTEM_ARMOR_HEAL = 20;
const ARTEM_ARMOR_SHOCK_DMG = 30;
const ARTEM_SLOW_DURATION = 4.0;
const EGOR_MAX_SHASHLIK = 5;
const EGOR_SHASHLIK_DMG = 32;
const EGOR_CUCUMBER_DMG = 16;
const EGOR_DOG_BITE_DMG = 25;
const EGOR_DOG_SHASHLIK = 3;
const EGOR_DOG_HEAL = 15;
const EGOR_DOG_CD = 14;
const EGOR_ULT_CD = 26;
const EGOR_ULT_DURATION = 8;
const EGOR_PICKLE_DROP_DMG = 40;
const EGOR_MAX_PICKLE_DROPS = 2;
const DIMA_MAX_STAMINA = 1500;
const PLAYER_MAX_ENERGY = 100;
const PLAYER_DASH_COST = 50;
const PLAYER_DASH_IFRAME_DURATION = 0.15;
const PLAYER_DASH_DURATION = 0.18;
const PLAYER_ENERGY_REGEN_PER_SEC = 12.5;
const PHASE2_INTRO_DURATION = 16.0;
const WILD_PHASE3_INTRO_DURATION = 23.0;
const PHASE2_SPEECH_PART1 = 'Ты пробил моё пузо, но мой жир спас меня.';
const PHASE2_SPEECH_PART2 = ' Пришло время моему жиру высвободится, и показать всю мою мощь';

type BossPhase =
  | 'PHASE1'
  | 'HC_PHASE2'
  | 'PHASE2_INTRO'
  | 'LAST_BREATH'
  | 'EXHAUSTED'
  | 'STOMPING'
  | 'WILD_PHASE3_INTRO'
  | 'WILD_PHASE3';

interface CombatHudState {
  hardcore: boolean;
  playerHp: number;
  maxPlayerHp: number;
  bossHp: number;
  maxBossHp: number;
  bossPhase: BossPhase;
  dimaDmgBoosted: boolean;
  phase2IntroProgress: number;
  phase2IntroRemaining: number;
  wildPhase3IntroProgress: number;
  wildPhase3IntroRemaining: number;
  cutsceneFlash: 'NONE' | 'PURPLE' | 'BW_INVERT';
  sideViewActive: boolean;
  dimaStamina: number;
  maxDimaStamina: number;
  primaryCooldown: number;
  ability1Cooldown: number;
  ultCooldown: number;
  artemDamageCharge: number;
  artemTotalDamage: number;
  artemArmorLeft: number;
  artemHitStreak: number;
  artemSlowLeft: number;
  minion1Cooldown: number;
  minion2Cooldown: number;
  maksBuffLeft: number;
  shashlikCount: number;
  rageLeft: number;
  radarLeft: number;
  radarHitCount: number;
  pickleDropsLeft: number;
  lupikIframe: boolean;
  playerEnergy: number;
  maxPlayerEnergy: number;
  dodgeIframe: boolean;
  playerAirborne: boolean;
  healFlash: boolean;
  damageFlash: boolean;
  sisterActive: boolean;
  dimaGiantActive: boolean;
  dimaDashActive: boolean;
  dimaLasersActive: boolean;
  dimaSpinWireActive: boolean;
  comboCount: number;
  maxComboCount: number;
  damageTakenTotal: number;
  dodgeEvadeCount: number;
  comboPulse: boolean;
  pointerLocked: boolean;
  impaleCutsceneActive: boolean;
  wildRegenActive: boolean;
  playerStunnedLeft: number;
  banner: string | null;
  outcome: 'ACTIVE' | 'WON' | 'LOST';
}

interface Projectile {
  mesh: THREE.Group;
  vx: number;
  vy: number;
  vz: number;
  fromPlayer: boolean;
  damage: number;
  radius: number;
  life: number;
  kind: 'SHOTGUN' | 'SHASHLIK' | 'CUCUMBER' | 'SHELL' | 'MOUSE_WIRE';
  isVisualOnly?: boolean;
}

interface FallingBomb {
  mesh: THREE.Group;
  ring: THREE.Mesh;
  targetX: number;
  targetZ: number;
  y: number;
  delay: number;
  damage: number;
  exploded: boolean;
  isPickleDrop?: boolean;
  isArtemAirstrike?: boolean;
}

interface ThrownFruit {
  mesh: THREE.Group;
  startX: number;
  startZ: number;
  t: number;
  duration: number;
}

interface ExplosionFlash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SkyLaser {
  ring: THREE.Mesh;
  aimLine: THREE.Mesh;
  beam: THREE.Mesh;
  x: number;
  z: number;
  warnTimer: number;
  strikeTimer: number;
  phase: 'WARN' | 'STRIKE';
}

interface FallingDebris {
  mesh: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  life: number;
}

interface BloodDrop {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  splatted: boolean;
  life: number;
}

interface ComboSpark {
  mesh: THREE.Mesh;
  orbitCenter: 'BOSS' | 'PLAYER';
  angle: number;
  radius: number;
  radiusSpeed: number;
  angularSpeed: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface ComboRing {
  mesh: THREE.Mesh;
  orbitCenter: 'BOSS' | 'PLAYER';
  life: number;
  maxLife: number;
  maxScale: number;
  yOffset: number;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _vec3 = new THREE.Vector3();

export function BossFight3D({
  fighter,
  minion,
  progress,
  isBossRush = false,
  trainingTarget = null,
  bossId = 'DIMA',
  onVictory,
  onChangeFighter,
  onBackToMenu,
  onChangeTrainingPhase,
  coopPlayersCount = 1,
  coopLocalPlayerId = null,
  coopIsHost = true,
  coopPlayers,
  coopRemoteStatesRef,
  coopBossStateRef,
  coopRemoteHit = null,
  onCoopDamageDealt,
  onCoopSyncState,
  onCoopAttack,
  subscribeCoopAttack,
  onCoopSyncBossState,
  onCoopBossEvent,
  onCoopBossStomp,
  subscribeCoopBossEvent,
  subscribeCoopRemoteHit,
}: BossFight3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onCoopDamageDealtRef = useRef(onCoopDamageDealt);
  onCoopDamageDealtRef.current = onCoopDamageDealt;
  const coopLocalPlayerIdRef = useRef(coopLocalPlayerId);
  coopLocalPlayerIdRef.current = coopLocalPlayerId;
  const coopIsHostRef = useRef(coopIsHost);
  coopIsHostRef.current = coopIsHost;
  const coopPlayersRef = useRef(coopPlayers);
  coopPlayersRef.current = coopPlayers;
  const coopRemoteStatesRefProp = useRef(coopRemoteStatesRef);
  coopRemoteStatesRefProp.current = coopRemoteStatesRef;
  const coopBossStateRefProp = useRef(coopBossStateRef);
  coopBossStateRefProp.current = coopBossStateRef;
  const onCoopSyncStateRef = useRef(onCoopSyncState);
  onCoopSyncStateRef.current = onCoopSyncState;
  const onCoopAttackRef = useRef(onCoopAttack);
  onCoopAttackRef.current = onCoopAttack;
  const subscribeCoopAttackRef = useRef(subscribeCoopAttack);
  subscribeCoopAttackRef.current = subscribeCoopAttack;
  const onCoopSyncBossStateRef = useRef(onCoopSyncBossState);
  onCoopSyncBossStateRef.current = onCoopSyncBossState;
  const onCoopBossEventRef = useRef(onCoopBossEvent);
  onCoopBossEventRef.current = onCoopBossEvent;
  const onCoopBossStompRef = useRef(onCoopBossStomp);
  onCoopBossStompRef.current = onCoopBossStomp;
  const subscribeCoopBossEventRef = useRef(subscribeCoopBossEvent);
  subscribeCoopBossEventRef.current = subscribeCoopBossEvent;
  const subscribeCoopRemoteHitRef = useRef(subscribeCoopRemoteHit);
  subscribeCoopRemoteHitRef.current = subscribeCoopRemoteHit;
  const pendingRemoteHitsRef = useRef<Array<{ attackerName: string; amount: number }>>([]);
  const lastRemoteHitSeqRef = useRef<number>(0);

  useEffect(() => {
    if (subscribeCoopRemoteHit) return;
    if (coopRemoteHit && coopRemoteHit.seq !== lastRemoteHitSeqRef.current) {
      lastRemoteHitSeqRef.current = coopRemoteHit.seq;
      if (coopRemoteHit.amount > 0) {
        pendingRemoteHitsRef.current.push({
          attackerName: coopRemoteHit.attackerName,
          amount: coopRemoteHit.amount,
        });
      }
    }
  }, [coopRemoteHit, subscribeCoopRemoteHit]);

  const isKingTiger = fighter === 'ARTEM' && progress.artemTankSkin;
  const isPickle = fighter === 'EGOR' && progress.egorPickleSkin;
  const isGilbert = fighter === 'LUPIK' && progress.lupikGilbertSkin;

  const isWildCucumber = bossId === 'WILD_CUCUMBER';
  const isHardcore = progress.hardcore || isWildCucumber;
  const isTraining = trainingTarget !== null;
  const maxBossHp = isWildCucumber ? 10000 : (isHardcore ? 9000 : 5000);
  const bossDisplayName = isWildCucumber ? 'Wild Огурец' : 'Дима · Кастрюльный Рыцарь';
  const maxPlayerHp = isKingTiger ? 200 : 100;
  const artemBonusDmg = isKingTiger ? ARTEM_KT_BONUS_DMG : 0;

  const getInitialTrainingState = useCallback(
    (target: TrainingStartTarget | null) => {
      const bossLabel = isWildCucumber ? 'Wild Огурец' : 'Дима';
      if (target === 'CUTSCENE') {
        return {
          bossPhase: 'WILD_PHASE3_INTRO' as BossPhase,
          bossHp: 2000,
          bossDmgBoost: true,
          dimaStamina: DIMA_MAX_STAMINA,
          potVisible: false,
          bossZ: 0,
          banner:
            '🎬 3D-КАТСЦЕНА СМЕНЫ ИЗМЕРЕНИЙ! Through Patches of Violet (23с IFRAME) · Обыкновенный Огурец против Wild Огурца!',
        };
      }
      if (target === 'STOMP') {
        return {
          bossPhase: 'EXHAUSTED' as BossPhase,
          bossHp: 1,
          bossDmgBoost: isHardcore,
          dimaStamina: 0,
          potVisible: false,
          bossZ: 2.5,
          banner: `ТРЕНИРОВКА · ДОБИВКА НОГОЙ! ${bossLabel} на месте на 1 HP — жми [F] или ЛКМ вблизи!`,
        };
      }
      if (target === 'PHASE3' || (target === 'PHASE2' && !isHardcore)) {
        if (isWildCucumber && target === 'PHASE3') {
          return {
            bossPhase: 'WILD_PHASE3' as BossPhase,
            bossHp: 2000,
            bossDmgBoost: true,
            dimaStamina: DIMA_MAX_STAMINA,
            potVisible: false,
            bossZ: 0,
            banner:
              'ТРЕНИРОВКА · ФАЗА 3 (WILD ОГУРЕЦ)! Вид сбоку, призрачные лапы собаки (удар 20 HP, КД 20с) и Through Patches of Violet!',
          };
        }
        return {
          bossPhase: 'LAST_BREATH' as BossPhase,
          bossHp: 1,
          bossDmgBoost: isHardcore,
          dimaStamina: DIMA_MAX_STAMINA,
          potVisible: false,
          bossZ: -7,
          banner: isHardcore
            ? `ТРЕНИРОВКА · ФАЗА 3 (ХАРДКОР)! ${bossLabel} стоит на месте · sans v2 и вертушка проводом!`
            : `ТРЕНИРОВКА · ФАЗА 2 (Last Breath)! ${bossLabel} стоит на месте · sans v2 и 1500 стамины!`,
        };
      }
      if (target === 'PHASE2' && isHardcore) {
        return {
          bossPhase: 'HC_PHASE2' as BossPhase,
          bossHp: isWildCucumber ? 6000 : 5000,
          bossDmgBoost: true,
          dimaStamina: DIMA_MAX_STAMINA,
          potVisible: true,
          bossZ: -7,
          banner: isWildCucumber
            ? `ТРЕНИРОВКА · ФАЗА 2 (WILD ОГУРЕЦ)! 6000 HP, реген +1 HP/2с и Jane!`
            : `ТРЕНИРОВКА · ФАЗА 2 (ХАРДКОР)! ${bossLabel} стоит на месте · 5000 HP, +20% урон и Jane!`,
        };
      }
      return {
        bossPhase: 'PHASE1' as BossPhase,
        bossHp: maxBossHp,
        bossDmgBoost: false,
        dimaStamina: DIMA_MAX_STAMINA,
        potVisible: true,
        bossZ: -7,
        banner: target === 'PHASE1'
          ? `ТРЕНИРОВКА · ФАЗА 1 (${isWildCucumber ? 'WILD ОГУРЕЦ · 10000 HP' : isHardcore ? 'ХАРДКОР · 9000 HP' : 'Обычный · 5000 HP'})! Босс стоит на месте — тренируй комбо и уклонения!`
          : isWildCucumber
          ? 'WILD ОГУРЕЦ (10000 HP · ХАРДКОР-СКОРОСТЬ)! На 6000 HP — 2-я фаза (реген +1 HP/2с, удар сверху, бросок банки), затем 3-я!'
          : isHardcore
          ? 'ХАРДКОР! Дима (9000 HP, броня, быстрый бег)! На 5000 HP — 2-я фаза (Jane! +20% урон), затем 3-я!'
          : 'Вид от 1-го лица! Дима (Кастрюльный Рыцарь · 5000 HP)! Лазеры и таран включатся во 2-й фазе!',
      };
    },
    [isHardcore, isWildCucumber, maxBossHp]
  );

  const initialTraining = getInitialTrainingState(trainingTarget);

  const [hud, setHud] = useState<CombatHudState>({
    hardcore: isHardcore,
    playerHp: maxPlayerHp,
    maxPlayerHp,
    bossHp: initialTraining.bossHp,
    maxBossHp,
    bossPhase: initialTraining.bossPhase,
    dimaDmgBoosted: initialTraining.bossDmgBoost,
    phase2IntroProgress: 0,
    phase2IntroRemaining: 0,
    wildPhase3IntroProgress: 0,
    wildPhase3IntroRemaining: initialTraining.bossPhase === 'WILD_PHASE3_INTRO' ? WILD_PHASE3_INTRO_DURATION : 0,
    cutsceneFlash: 'NONE',
    sideViewActive:
      initialTraining.bossPhase === 'WILD_PHASE3' || initialTraining.bossPhase === 'WILD_PHASE3_INTRO',
    dimaStamina: initialTraining.dimaStamina,
    maxDimaStamina: DIMA_MAX_STAMINA,
    primaryCooldown: 0,
    ability1Cooldown: 0,
    ultCooldown: 0,
    artemDamageCharge: 0,
    artemTotalDamage: 0,
    artemArmorLeft: 0,
    artemHitStreak: 0,
    artemSlowLeft: 0,
    minion1Cooldown: 0,
    minion2Cooldown: 0,
    maksBuffLeft: 0,
    shashlikCount: fighter === 'EGOR' ? 3 : 0,
    rageLeft: 0,
    radarLeft: 0,
    radarHitCount: 0,
    pickleDropsLeft: 0,
    lupikIframe: false,
    playerEnergy: PLAYER_MAX_ENERGY,
    maxPlayerEnergy: PLAYER_MAX_ENERGY,
    dodgeIframe: false,
    playerAirborne: false,
    healFlash: false,
    damageFlash: false,
    sisterActive: false,
    dimaGiantActive: false,
    dimaDashActive: false,
    dimaLasersActive: false,
    dimaSpinWireActive: false,
    comboCount: 0,
    maxComboCount: 0,
    damageTakenTotal: 0,
    dodgeEvadeCount: 0,
    comboPulse: false,
    pointerLocked: false,
    impaleCutsceneActive: false,
    wildRegenActive: isWildCucumber && initialTraining.bossPhase !== 'PHASE1',
    playerStunnedLeft: 0,
    banner: initialTraining.banner,
    outcome: 'ACTIVE',
  });

  const [retryNonce, setRetryNonce] = useState(0);
  const [audioMuted, setAudioMuted] = useState(soundFX.muted);
  const [musicVolume, setMusicVolume] = useState(0.45);
  const [comboVolume, setComboVolume] = useState(soundFX.comboVolume);
  const musicVolumeRef = useRef(0.45);

  const audioRefs = useRef<{
    aizo: HTMLAudioElement | null;
    jane: HTMLAudioElement | null;
    sans: HTMLAudioElement | null;
    violet: HTMLAudioElement | null;
    stomp: HTMLAudioElement | null;
  }>({ aizo: null, jane: null, sans: null, violet: null, stomp: null });

  const handleToggleFightAudio = useCallback(() => {
    const next = !audioMuted;
    soundFX.muted = next;
    setAudioMuted(next);
    if (audioRefs.current.aizo) audioRefs.current.aizo.muted = next;
    if (audioRefs.current.jane) audioRefs.current.jane.muted = next;
    if (audioRefs.current.sans) audioRefs.current.sans.muted = next;
    if (audioRefs.current.violet) audioRefs.current.violet.muted = next;
    if (audioRefs.current.stomp) audioRefs.current.stomp.muted = next;
  }, [audioMuted]);

  const handleMusicVolumeChange = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(1, nextVol));
      setMusicVolume(clamped);
      musicVolumeRef.current = clamped;
      if (clamped > 0 && audioMuted) {
        soundFX.muted = false;
        setAudioMuted(false);
        if (audioRefs.current.aizo) audioRefs.current.aizo.muted = false;
        if (audioRefs.current.jane) audioRefs.current.jane.muted = false;
        if (audioRefs.current.sans) audioRefs.current.sans.muted = false;
        if (audioRefs.current.violet) audioRefs.current.violet.muted = false;
        if (audioRefs.current.stomp) audioRefs.current.stomp.muted = false;
      }
      if (audioRefs.current.aizo) audioRefs.current.aizo.volume = clamped;
      if (audioRefs.current.jane) audioRefs.current.jane.volume = clamped;
      if (audioRefs.current.sans) audioRefs.current.sans.volume = clamped;
      if (audioRefs.current.violet) audioRefs.current.violet.volume = clamped;
    },
    [audioMuted]
  );

  const handleComboVolumeChange = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(1, nextVol));
      setComboVolume(clamped);
      soundFX.comboVolume = clamped;
      if (clamped > 0 && audioMuted) {
        soundFX.muted = false;
        setAudioMuted(false);
        if (audioRefs.current.aizo) audioRefs.current.aizo.muted = false;
        if (audioRefs.current.jane) audioRefs.current.jane.muted = false;
        if (audioRefs.current.sans) audioRefs.current.sans.muted = false;
        if (audioRefs.current.violet) audioRefs.current.violet.muted = false;
        if (audioRefs.current.stomp) audioRefs.current.stomp.muted = false;
      }
    },
    [audioMuted]
  );

  const actionsRef = useRef<{
    triggerPrimary: () => void;
    triggerAbility1: () => void;
    triggerUlt: () => void;
    triggerJump: () => void;
    triggerDodgeDash: () => void;
    triggerMinion1: () => void;
    triggerMinion2: () => void;
    triggerStompFinisher: () => void;
  }>({
    triggerPrimary: () => {},
    triggerAbility1: () => {},
    triggerUlt: () => {},
    triggerJump: () => {},
    triggerDodgeDash: () => {},
    triggerMinion1: () => {},
    triggerMinion2: () => {},
    triggerStompFinisher: () => {},
  });

  const handleRestartFight = useCallback(() => {
    const setup = getInitialTrainingState(trainingTarget);
    setHud({
      hardcore: isHardcore,
      playerHp: maxPlayerHp,
      maxPlayerHp,
      bossHp: setup.bossHp,
      maxBossHp,
      bossPhase: setup.bossPhase,
      dimaDmgBoosted: setup.bossDmgBoost,
      phase2IntroProgress: 0,
      phase2IntroRemaining: 0,
      wildPhase3IntroProgress: 0,
      wildPhase3IntroRemaining: setup.bossPhase === 'WILD_PHASE3_INTRO' ? WILD_PHASE3_INTRO_DURATION : 0,
      cutsceneFlash: 'NONE',
      sideViewActive: setup.bossPhase === 'WILD_PHASE3' || setup.bossPhase === 'WILD_PHASE3_INTRO',
      dimaStamina: setup.dimaStamina,
      maxDimaStamina: DIMA_MAX_STAMINA,
      primaryCooldown: 0,
      ability1Cooldown: 0,
      ultCooldown: 0,
      artemDamageCharge: 0,
      artemTotalDamage: 0,
      artemArmorLeft: 0,
      artemHitStreak: 0,
      artemSlowLeft: 0,
      minion1Cooldown: 0,
      minion2Cooldown: 0,
      maksBuffLeft: 0,
      shashlikCount: fighter === 'EGOR' ? 3 : 0,
      rageLeft: 0,
      radarLeft: 0,
      radarHitCount: 0,
      pickleDropsLeft: 0,
      lupikIframe: false,
      playerEnergy: PLAYER_MAX_ENERGY,
      maxPlayerEnergy: PLAYER_MAX_ENERGY,
      dodgeIframe: false,
      playerAirborne: false,
      healFlash: false,
      damageFlash: false,
      sisterActive: false,
      dimaGiantActive: false,
      dimaDashActive: false,
      dimaLasersActive: false,
      dimaSpinWireActive: false,
      comboCount: 0,
      maxComboCount: 0,
      damageTakenTotal: 0,
      dodgeEvadeCount: 0,
      comboPulse: false,
      pointerLocked: false,
      impaleCutsceneActive: false,
      wildRegenActive: isWildCucumber && setup.bossPhase !== 'PHASE1',
      playerStunnedLeft: 0,
      banner: setup.banner,
      outcome: 'ACTIVE',
    });
    setRetryNonce((n) => n + 1);
  }, [fighter, getInitialTrainingState, isHardcore, isWildCucumber, maxBossHp, maxPlayerHp, trainingTarget]);

  const handleBackToMenu = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    onBackToMenu?.();
  }, [onBackToMenu]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // =========================================================================
    // FIGHT MUSIC & SOUNDPAD AUDIO SETUP (AIZO -> [Jane! in HC] -> sans v2 -> 1recording.ogg)
    // =========================================================================
    const aizoAudio = new Audio(ASSETS.MUSIC_AIZO);
    aizoAudio.loop = true;
    aizoAudio.volume = musicVolumeRef.current;
    aizoAudio.muted = soundFX.muted;
    const onAizoEnded = () => {
      if (state.bossPhase === 'PHASE1' && state.outcome === 'ACTIVE') {
        aizoAudio.currentTime = 0;
        aizoAudio.play().catch(() => {});
      }
    };
    aizoAudio.addEventListener('ended', onAizoEnded);

    const janeAudio = new Audio(ASSETS.MUSIC_JANE);
    janeAudio.loop = true;
    janeAudio.volume = musicVolumeRef.current;
    janeAudio.muted = soundFX.muted;
    const onJaneEnded = () => {
      if (state.bossPhase === 'HC_PHASE2' && state.outcome === 'ACTIVE') {
        janeAudio.currentTime = 0;
        janeAudio.play().catch(() => {});
      }
    };
    janeAudio.addEventListener('ended', onJaneEnded);

    const sansAudio = new Audio(ASSETS.MUSIC_SANS_V2);
    sansAudio.loop = true;
    sansAudio.volume = musicVolumeRef.current;
    sansAudio.muted = soundFX.muted;
    const onSansEnded = () => {
      if (
        (state.bossPhase === 'PHASE2_INTRO' || state.bossPhase === 'LAST_BREATH') &&
        state.outcome === 'ACTIVE'
      ) {
        sansAudio.currentTime = 0;
        sansAudio.play().catch(() => {});
      }
    };
    sansAudio.addEventListener('ended', onSansEnded);

    const stompAudio = new Audio(ASSETS.SFX_STOMP_PAD);
    stompAudio.volume = 0.92;
    stompAudio.muted = soundFX.muted;

    const getVioletLoopRange = (phase: BossPhase): [number, number] => {
      if (phase === 'PHASE1') return [21, 112];
      if (phase === 'HC_PHASE2') return [112, 186];
      if (phase === 'WILD_PHASE3_INTRO') return [163, 186];
      return [186, 234];
    };

    const violetAudio = new Audio(ASSETS.MUSIC_THROUGH_PATCHES_OF_VIOLET);
    violetAudio.preload = 'auto';
    violetAudio.loop = false;
    violetAudio.volume = musicVolumeRef.current;
    violetAudio.muted = soundFX.muted;

    const initSetup = getInitialTrainingState(trainingTarget);
    let fightActive = true;
    let violetDisposed = false;
    let violetBlobUrl: string | null = null;
    let violetSwitchedToBlob = false;
    let pendingVioletSeek: number | null = null;
    let violetSeekingTarget: number | null = null;
    let lastVioletSeekAt = 0;
    let lastVioletPhase: BossPhase = initSetup.bossPhase;
    const violetFetchCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;

    if (isWildCucumber && typeof fetch !== 'undefined') {
      fetch(ASSETS.MUSIC_THROUGH_PATCHES_OF_VIOLET, violetFetchCtrl ? { signal: violetFetchCtrl.signal } : undefined)
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (!blob || violetDisposed) return;
          violetBlobUrl = URL.createObjectURL(blob);
        })
        .catch(() => {});
    }

    const switchVioletToBlob = (targetSec: number, shouldPlay: boolean) => {
      if (!violetBlobUrl || violetSwitchedToBlob || violetDisposed) return false;
      violetSwitchedToBlob = true;
      pendingVioletSeek = targetSec;
      violetSeekingTarget = targetSec;
      lastVioletSeekAt = performance.now();
      violetAudio.src = violetBlobUrl;
      violetAudio.load();
      if (shouldPlay && fightActive) {
        violetAudio.play().catch(() => {});
      }
      return true;
    };

    const seekVioletTo = (targetSec: number, shouldPlay = true) => {
      if (!isWildCucumber || violetDisposed) return;
      violetSeekingTarget = targetSec;
      lastVioletSeekAt = performance.now();

      if (violetAudio.readyState < 1) {
        pendingVioletSeek = targetSec;
        if (shouldPlay && fightActive && violetAudio.paused) {
          violetAudio.play().catch(() => {});
        }
        return;
      }

      if (violetBlobUrl && !violetSwitchedToBlob && violetAudio.seekable.length > 0) {
        const maxSeekable = violetAudio.seekable.end(violetAudio.seekable.length - 1);
        if (targetSec > maxSeekable + 0.5) {
          switchVioletToBlob(targetSec, shouldPlay);
          return;
        }
      }

      pendingVioletSeek = null;
      try {
        violetAudio.currentTime = targetSec;
      } catch {
        pendingVioletSeek = targetSec;
      }
      if (shouldPlay && fightActive && violetAudio.paused) {
        violetAudio.play().catch(() => {});
      }
    };

    const applyPendingVioletSeek = () => {
      if (!isWildCucumber || violetDisposed) return;
      const target =
        pendingVioletSeek !== null
          ? pendingVioletSeek
          : violetAudio.currentTime < 1
          ? getVioletLoopRange(lastVioletPhase)[0]
          : null;
      if (target !== null) {
        pendingVioletSeek = null;
        violetSeekingTarget = target;
        lastVioletSeekAt = performance.now();
        try {
          violetAudio.currentTime = target;
        } catch {
          pendingVioletSeek = target;
        }
      }
      if (fightActive && violetAudio.paused) {
        violetAudio.play().catch(() => {});
      }
    };

    const onVioletMetadata = () => {
      applyPendingVioletSeek();
    };
    const onVioletCanPlay = () => {
      if (pendingVioletSeek !== null) {
        applyPendingVioletSeek();
      }
    };
    const onVioletSeeked = () => {
      if (!isWildCucumber || violetDisposed) return;
      if (
        violetSeekingTarget !== null &&
        Math.abs(violetAudio.currentTime - violetSeekingTarget) > 2.5 &&
        violetBlobUrl &&
        !violetSwitchedToBlob
      ) {
        switchVioletToBlob(violetSeekingTarget, true);
        return;
      }
      violetSeekingTarget = null;
      if (fightActive && violetAudio.paused) {
        violetAudio.play().catch(() => {});
      }
    };
    const onVioletError = () => {
      if (!isWildCucumber || violetDisposed) return;
      const [vStart] = getVioletLoopRange(lastVioletPhase);
      const target = violetSeekingTarget ?? pendingVioletSeek ?? vStart;
      if (violetBlobUrl && !violetSwitchedToBlob) {
        switchVioletToBlob(target, true);
      }
    };
    const onVioletEnded = () => {
      if (isWildCucumber && fightActive) {
        const [vStart] = getVioletLoopRange(lastVioletPhase);
        seekVioletTo(vStart, true);
      }
    };
    violetAudio.addEventListener('loadedmetadata', onVioletMetadata);
    violetAudio.addEventListener('canplay', onVioletCanPlay);
    violetAudio.addEventListener('seeked', onVioletSeeked);
    violetAudio.addEventListener('error', onVioletError);
    violetAudio.addEventListener('ended', onVioletEnded);

    audioRefs.current = { aizo: aizoAudio, jane: janeAudio, sans: sansAudio, violet: violetAudio, stomp: stompAudio };
    if (isWildCucumber) {
      const [initStart] = getVioletLoopRange(initSetup.bossPhase);
      seekVioletTo(initStart, true);
    } else if (initSetup.bossPhase === 'PHASE1') {
      aizoAudio.play().catch(() => {});
    } else if (initSetup.bossPhase === 'HC_PHASE2') {
      janeAudio.play().catch(() => {});
    } else if (initSetup.bossPhase === 'LAST_BREATH') {
      sansAudio.play().catch(() => {});
    }
    void soundFX.preloadComboAudio();

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 1080;
    const height = container.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1424);
    scene.fog = new THREE.FogExp2(0x0b1424, 0.014);

    // Studio environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(72, width / height, 0.08, 150);
    const eyeHeight = isKingTiger ? 2.05 : 1.75;
    let spawnX = 0;
    const initialCoopPlayers = coopPlayersRef.current;
    const initialLocalCid = coopLocalPlayerIdRef.current;
    if (initialCoopPlayers && initialCoopPlayers.length > 1 && initialLocalCid) {
      const slotIdx = initialCoopPlayers.findIndex((p) => p.id === initialLocalCid);
      if (slotIdx >= 0) {
        spawnX = THREE.MathUtils.clamp((slotIdx - (initialCoopPlayers.length - 1) * 0.5) * 2.5, -10, 10);
      }
    }
    const playerPos = new THREE.Vector3(spawnX, eyeHeight, 9);
    let yaw = 0; // looking toward -Z (Dima)
    let pitch = -0.03;

    // Warm/cool winter garage lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffdfb0, 1.85);
    keyLight.position.set(14, 24, 14);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.left = -26;
      keyLight.shadow.camera.right = 26;
      keyLight.shadow.camera.top = 26;
      keyLight.shadow.camera.bottom = -26;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      keyLight.shadow.radius = 3.2;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    rimLight.position.set(-16, 10, -14);
    scene.add(rimLight);

    // Dynamic Phase 2/3 Boss Threat SpotLight casting sharper, higher-contrast shadows onto the snow
    const bossThreatSpot = new THREE.SpotLight(0xf43f5e, 0, 32, Math.PI * 0.24, 0.45, 1.15);
    bossThreatSpot.position.set(3.5, 10.5, -2.5);
    if (!isSoftwareGl) {
      bossThreatSpot.castShadow = true;
      bossThreatSpot.shadow.mapSize.width = 1024;
      bossThreatSpot.shadow.mapSize.height = 1024;
      bossThreatSpot.shadow.bias = -0.0004;
      bossThreatSpot.shadow.normalBias = 0.015;
    }
    scene.add(bossThreatSpot);
    scene.add(bossThreatSpot.target);

    const disposables: Array<{ dispose: () => void }> = [envTexture];
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposables.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposables.push(m);
      return m;
    };

    // Procedural Snow & Corrugated Metal Door Textures
    const makeSnowTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#c4d6e8';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 950; i++) {
        const v = 180 + Math.floor(Math.random() * 58);
        ctx.fillStyle = `rgb(${v},${v + 8},${Math.min(255, v + 18)})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(18, 18);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    const makeCorrugatedDoorTexture = (baseHex: string, numberText: string) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);
      // Corrugated vertical ribs
      for (let x = 0; x < 256; x += 12) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 4, 256);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 5, 0, 2, 256);
      }
      // Rust bottom weathering
      const rustGrad = ctx.createLinearGradient(0, 200, 0, 256);
      rustGrad.addColorStop(0, 'rgba(120, 53, 15, 0)');
      rustGrad.addColorStop(1, 'rgba(120, 53, 15, 0.58)');
      ctx.fillStyle = rustGrad;
      ctx.fillRect(0, 200, 256, 56);
      // Center seam between double doors
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(126, 0, 4, 256);
      // Number plaque
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(102, 26, 52, 28);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(numberText, 128, 46);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    // Ground extending far past the arena to the horizon
    const textureLoader = new THREE.TextureLoader();
    const groundMaterial = isWildCucumber
      ? trackMat(
          new THREE.MeshStandardMaterial({
            map: textureLoader.load('/assets/aistudio/image_052ef0a2.png', (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.wrapS = THREE.RepeatWrapping;
              t.wrapT = THREE.RepeatWrapping;
              t.repeat.set(16, 16);
            }),
            roughness: 0.7,
            metalness: 0.15,
          })
        )
      : trackMat(
          new THREE.MeshStandardMaterial({
            map: makeSnowTexture(),
            roughness: 0.92,
            metalness: 0.02,
          })
        );

    const ground = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(140, 140)), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const wildLightningBolts: THREE.Group[] = [];
    let wildLightningFlashLight: THREE.PointLight | null = null;
    let wildLightningTimer = 1.6;
    let wildLightningActiveTimer = 0;

    const wildFrontOccludingObjs: THREE.Object3D[] = [];
    if (isWildCucumber) {
      scene.background = new THREE.Color(0x0c0616);
      scene.fog = new THREE.FogExp2(0x130824, 0.02);
      hemiLight.color.setHex(0xa855f7);
      hemiLight.groundColor.setHex(0x140b24);
      hemiLight.intensity = 0.72;
      keyLight.color.setHex(0xd8b4fe);
      keyLight.intensity = 1.15;
      rimLight.color.setHex(0x9333ea);
      rimLight.intensity = 1.25;

      wildLightningFlashLight = new THREE.PointLight(0xd8b4fe, 0, 95, 1.2);
      wildLightningFlashLight.position.set(0, 18, -22);
      scene.add(wildLightningFlashLight);

      const plazaGroup = new THREE.Group();
      const balustradeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b354a, roughness: 0.72, metalness: 0.12 }));
      const balustradeDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x241f31, roughness: 0.82 }));
      const briarMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x1e1328,
          roughness: 0.9,
          emissive: 0x3b0764,
          emissiveIntensity: 0.35,
        })
      );

      const buildBalustradeWall = (x1: number, z1: number, x2: number, z2: number) => {
        const wallGroup = new THREE.Group();
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const spanCount = Math.max(1, Math.round(length / 4.5));

        for (let i = 0; i <= spanCount; i++) {
          const t = i / spanCount;
          const px = x1 + dx * t;
          const pz = z1 + dz * t;
          // Heavy stone pier post
          const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 1.7, 0.76)), balustradeMat);
          post.position.set(px, 0.85, pz);
          post.castShadow = true;
          post.receiveShadow = true;
          // Pier cap & stone sphere finial (like the gothic plaza image)
          const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.2, 0.92)), balustradeDarkMat);
          cap.position.set(px, 1.76, pz);
          const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 10, 10)), balustradeMat);
          finial.position.set(px, 2.04, pz);
          wallGroup.add(post, cap, finial);
        }

        // Top rail, bottom plinth, and vertical balusters rotated along wall span
        const spanBeamGroup = new THREE.Group();
        spanBeamGroup.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
        spanBeamGroup.rotation.y = angle;

        const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.28, length)), balustradeDarkMat);
        plinth.position.y = 0.14;
        const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.22, length)), balustradeMat);
        topRail.position.y = 1.56;
        spanBeamGroup.add(plinth, topRail);

        const balusterCount = Math.floor(length / 0.65);
        for (let b = 1; b < balusterCount; b++) {
          const bz = -length / 2 + (b / balusterCount) * length;
          const bal = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 1.18, 8)), balustradeMat);
          bal.position.set(0, 0.86, bz);
          spanBeamGroup.add(bal);
        }

        wallGroup.add(spanBeamGroup);
        plazaGroup.add(wallGroup);
        return wallGroup;
      };

      buildBalustradeWall(-15.5, -16.5, 15.5, -16.5);
      const frontBalustrade = buildBalustradeWall(-15.5, 15.5, 15.5, 15.5);
      wildFrontOccludingObjs.push(frontBalustrade);
      buildBalustradeWall(-15.5, -16.5, -15.5, 15.5);
      buildBalustradeWall(15.5, -16.5, 15.5, 15.5);

      // Tangled thorny briars (терновник) weaving outside the balustrade
      const briarRingPoints: [number, number][] = [
        [-17, -18], [-11, -18.5], [-4, -18.2], [4, -18.6], [11, -18.3], [17, -18],
        [-17.2, -9], [-17.4, 0], [-17.1, 9], [17.2, -9], [17.4, 0], [17.1, 9],
        [-15, 17.4], [0, 17.6], [15, 17.4],
      ];
      for (let idx = 0; idx < briarRingPoints.length; idx++) {
        const [bx, bz] = briarRingPoints[idx];
        const briarTarget = bz > 15 ? new THREE.Group() : plazaGroup;
        for (let b = 0; b < 5; b++) {
          const vine = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.14, 3.8, 6)), briarMat);
          vine.position.set(bx + (b - 2) * 0.45, 2.2 + (b % 2) * 0.7, bz + ((b % 3) - 1) * 0.35);
          vine.rotation.z = (b % 2 === 0 ? 1 : -1) * (0.45 + b * 0.12);
          vine.rotation.x = 0.22 * ((idx % 3) - 1);
          briarTarget.add(vine);
          const thorn = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.48, 4)), briarMat);
          thorn.position.set(vine.position.x + 0.25, vine.position.y + 0.5, vine.position.z);
          thorn.rotation.z = -0.7;
          briarTarget.add(thorn);
        }
        if (bz > 15) {
          plazaGroup.add(briarTarget);
          wildFrontOccludingObjs.push(briarTarget);
        }
      }

      // 3D Jagged Purple Lightning Bolts in the stormy sky behind the balustrade
      const boltMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.95 })
      );
      const boltGlowMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55 })
      );
      for (const [lx, lz] of [
        [-14, -28],
        [0, -32],
        [15, -27],
        [-22, -16],
        [22, -16],
      ] as [number, number][]) {
        const boltGrp = new THREE.Group();
        boltGrp.position.set(lx, 0, lz);
        let curX = 0;
        let curY = 24;
        for (let seg = 0; seg < 6; seg++) {
          const nextX = curX + (seg % 2 === 0 ? 1.8 : -1.5);
          const nextY = curY - 3.6;
          const segLen = Math.hypot(nextX - curX, nextY - curY);
          const segMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.16, segLen, 5)), boltMat);
          const glowMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.36, 0.42, segLen, 5)), boltGlowMat);
          segMesh.position.set((curX + nextX) / 2, (curY + nextY) / 2, 0);
          glowMesh.position.copy(segMesh.position);
          const rotZ = Math.atan2(nextX - curX, curY - nextY);
          segMesh.rotation.z = rotZ;
          glowMesh.rotation.z = rotZ;
          boltGrp.add(glowMesh, segMesh);
          curX = nextX;
          curY = nextY;
        }
        boltGrp.visible = false;
        scene.add(boltGrp);
        wildLightningBolts.push(boltGrp);
      }

      scene.add(plazaGroup);
    }

    // =========================================================================
    // DETAILED 3D GARAGE COOPERATIVE ARENA (only when fighting Dima)
    // =========================================================================
    const arenaGroup = new THREE.Group();
    const concreteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b4452, roughness: 0.9, metalness: 0.05 }));
    const brickMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4d352e, roughness: 0.88, metalness: 0.04 }));
    const roofMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2c3644, roughness: 0.48, metalness: 0.65 }));
    const snowMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe4eef8, roughness: 0.9, metalness: 0.02 }));
    const icicleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbe8ff, roughness: 0.15, metalness: 0.1 }));
    const rustDrumMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7, metalness: 0.35 }));
    const tireMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.92, metalness: 0.05 }));
    const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x6b4c30, roughness: 0.85, metalness: 0.05 }));
    const lanternGlassMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.8 })
    );

    const buildDetailedGarage = (numStr: string, doorColor: string, hasLantern: boolean): THREE.Group => {
      const g = new THREE.Group();

      // Concrete threshold apron
      const apron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.4)), concreteMat);
      apron.position.set(0, 0.07, 2.55);
      apron.receiveShadow = true;
      g.add(apron);

      // Brick side/back garage box
      const shell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.4, 3.8, 4.4)), brickMat);
      shell.position.set(0, 1.9, 0);
      shell.castShadow = true;
      shell.receiveShadow = true;
      g.add(shell);

      // Steel lintel beam above door
      const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.1, 0.35, 0.35)), roofMetalMat);
      lintel.position.set(0, 3.25, 2.15);
      g.add(lintel);

      // Corrugated steel double door with number plaque
      const doorTex = makeCorrugatedDoorTexture(doorColor, numStr);
      const door = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(4.3, 3.0, 0.16)),
        trackMat(new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.45, metalness: 0.55 }))
      );
      door.position.set(0, 1.55, 2.2);
      g.add(door);

      // Heavy padlock & handle bar
      const lock = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.28, 0.14)), roofMetalMat);
      lock.position.set(0, 1.35, 2.32);
      g.add(lock);

      // Sloped metal roof + thick winter snowcap
      const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.7, 0.24, 5.0)), roofMetalMat);
      roof.position.set(0, 3.92, 0.1);
      roof.rotation.x = 0.08;
      roof.castShadow = true;
      g.add(roof);

      const snowRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.75, 0.26, 5.05)), snowMat);
      snowRoof.position.set(0, 4.12, 0.1);
      snowRoof.rotation.x = 0.08;
      g.add(snowRoof);

      // Hanging winter icicles along front eave
      for (let ix = -2.2; ix <= 2.2; ix += 0.55) {
        const len = 0.25 + (Math.abs(ix * 7) % 0.35);
        const icicle = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.055, len, 5)), icicleMat);
        icicle.rotation.x = Math.PI;
        icicle.position.set(ix, 3.72 - len * 0.4, 2.58);
        g.add(icicle);
      }

      // Ventilation chimney pipe on roof
      const vent = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 8)), roofMetalMat);
      vent.position.set(1.6, 4.4, -1.0);
      g.add(vent);

      // Wall lantern above door
      if (hasLantern) {
        const bracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.45)), roofMetalMat);
        bracket.position.set(0, 3.45, 2.4);
        const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 10, 10)), lanternGlassMat);
        bulb.position.set(0, 3.36, 2.62);
        g.add(bracket, bulb);
      }

      return g;
    };

    // Left row of 5 garages facing +X
    const leftDoorColors = ['#3b4958', '#2d4739', '#4a3d33', '#364152', '#2f3d4c'];
    for (let i = 0; i < 5; i++) {
      const g = buildDetailedGarage(`0${i + 1}`, leftDoorColors[i], i % 2 === 0);
      g.rotation.y = Math.PI / 2;
      g.position.set(-16.5, 0, -11.5 + i * 5.8);
      arenaGroup.add(g);
    }

    // Right row of 5 garages facing -X
    const rightDoorColors = ['#354254', '#463834', '#2e4440', '#3d4554', '#493c2e'];
    for (let i = 0; i < 5; i++) {
      const g = buildDetailedGarage(`0${i + 6}`, rightDoorColors[i], i % 2 === 1);
      g.rotation.y = -Math.PI / 2;
      g.position.set(16.5, 0, -11.5 + i * 5.8);
      arenaGroup.add(g);
    }

    // Back row of 4 garages behind Dima facing +Z
    for (let i = 0; i < 4; i++) {
      const g = buildDetailedGarage(`1${i + 1}`, i % 2 === 0 ? '#3f4b5c' : '#2d3f3a', i === 1 || i === 2);
      g.position.set(-8.8 + i * 5.85, 0, -17.5);
      arenaGroup.add(g);
    }

    // Garage courtyard clutter: stacked spare tires, rusty oil drums, wooden pallets & snowdrifts
    const tireStackSpots: [number, number][] = [
      [-13.4, -5.5],
      [13.4, -2.5],
      [-13.2, 6.2],
      [13.2, 7.5],
    ];
    for (const [tx, tz] of tireStackSpots) {
      for (let t = 0; t < 3; t++) {
        const tire = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.45, 0.18, 8, 16)), tireMat);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tx + (t === 2 ? 0.12 : 0), 0.18 + t * 0.34, tz);
        tire.castShadow = true;
        arenaGroup.add(tire);
      }
    }

    const drumSpots: [number, number][] = [
      [-12.8, -11],
      [12.8, -11],
      [11.8, -13.6],
    ];
    for (const [dx, dz] of drumSpots) {
      const drum = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 1.15, 12)), rustDrumMat);
      drum.position.set(dx, 0.58, dz);
      drum.castShadow = true;
      const drumSnow = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.44, 0.08, 12)), snowMat);
      drumSnow.position.set(dx, 1.18, dz);
      arenaGroup.add(drum, drumSnow);
    }

    const crateSpots: [number, number][] = [
      [-12.6, 1.2],
      [12.6, 2.4],
      [-9.5, -13.5],
    ];
    for (const [cx, cz] of crateSpots) {
      const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 1.1, 1.3)), woodMat);
      crate.position.set(cx, 0.55, cz);
      crate.castShadow = true;
      const cSnow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.34, 0.12, 1.34)), snowMat);
      cSnow.position.set(cx, 1.14, cz);
      arenaGroup.add(crate, cSnow);
    }

    // Distant panel buildings beyond the garage roofs
    const distantBldgMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x162233, roughness: 0.9 }));
    for (const [bx, bz, bh] of [
      [-26, -34, 18],
      [26, -34, 21],
      [-32, 28, 16],
      [32, 28, 17],
    ] as [number, number, number][]) {
      const b = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, bh, 10)), distantBldgMat);
      b.position.set(bx, bh / 2, bz);
      arenaGroup.add(b);
    }

    if (!isWildCucumber) {
      scene.add(arenaGroup);
    }

    // =========================================================================
    // FIRST-PERSON VIEWMODEL WEAPON ATTACHED TO CAMERA
    // =========================================================================
    const viewModelGroup = new THREE.Group();
    const gunMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x262c36, roughness: 0.35, metalness: 0.8 }));
    const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf2c9ac, roughness: 0.72 }));
    let egorSkewerGroup: THREE.Group | null = null;
    let egorCucumberGroup: THREE.Group | null = null;

    if (fighter === 'LUPIK') {
      const handMat = isGilbert
        ? trackMat(new THREE.MeshStandardMaterial({ color: 0x252b21, roughness: 0.8 }))
        : trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.8 }));
      const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.85, 10)), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0.28, -0.25, -0.58);
      const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.12, 0.45)), gunMetalMat);
      body.position.set(0.28, -0.28, -0.35);
      const pump = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.075, 0.075, 0.24)),
        trackMat(new THREE.MeshStandardMaterial({ color: isGilbert ? 0x7d7440 : 0x78350f, roughness: 0.75 }))
      );
      pump.position.set(0.28, -0.29, -0.62);
      const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.11, 0.38)), handMat);
      arm.position.set(0.32, -0.36, -0.22);
      viewModelGroup.add(barrel, body, pump, arm);
    } else if (fighter === 'EGOR') {
      const armMat = isPickle
        ? trackMat(new THREE.MeshStandardMaterial({ color: 0x3b8e3a, roughness: 0.75 }))
        : trackMat(new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }));
      const hand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.12, 0.35)), armMat);
      hand.position.set(0.3, -0.32, -0.32);

      egorSkewerGroup = new THREE.Group();
      const skewer = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85 }))
      );
      skewer.rotation.x = Math.PI * 0.42;
      skewer.position.set(0.28, -0.22, -0.52);
      const meat = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.11, 0.11, 0.25)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 }))
      );
      meat.rotation.x = Math.PI * 0.42;
      meat.position.set(0.28, -0.2, -0.56);
      egorSkewerGroup.add(skewer, meat);

      egorCucumberGroup = new THREE.Group();
      const cucumberMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 }));
      const cucumberBumpMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 }));
      const cucumberBody = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.065, 0.24, 6, 10)),
        cucumberMat
      );
      cucumberBody.rotation.x = Math.PI * 0.42;
      cucumberBody.position.set(0.28, -0.21, -0.54);
      egorCucumberGroup.add(cucumberBody);
      for (const [bx, by, bz] of [
        [0.24, -0.18, -0.49],
        [0.32, -0.22, -0.58],
        [0.29, -0.16, -0.6],
        [0.25, -0.25, -0.55],
      ] as [number, number, number][]) {
        const bump = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.016, 6, 6)), cucumberBumpMat);
        bump.position.set(bx, by, bz);
        egorCucumberGroup.add(bump);
      }
      egorCucumberGroup.visible = false;

      viewModelGroup.add(hand, egorSkewerGroup, egorCucumberGroup);
    } else {
      // Artem (or King Tiger 88mm KwK 43 barrel + gunner frame!)
      const barrelColor = isKingTiger ? 0x5c5846 : 0x334155;
      const barrelMat = trackMat(new THREE.MeshStandardMaterial({ color: barrelColor, roughness: 0.4, metalness: 0.75 }));
      const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 12)), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0.26, -0.28, -0.78);
      const muzzle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.16, 0.2)), barrelMat);
      muzzle.position.set(0.26, -0.28, -1.48);
      viewModelGroup.add(barrel, muzzle);
      if (isKingTiger) {
        const dash = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.4, 0.16, 0.2)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0x2b2f26, roughness: 0.6, metalness: 0.5 }))
        );
        dash.position.set(0, -0.45, -0.45);
        viewModelGroup.add(dash);
      }
    }

    // Binoculars for Artem's 67001 airstrike animation
    const binocGroup = new THREE.Group();
    for (const side of [-1, 1]) {
      const tube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 10)), gunMetalMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(side * 0.06, 0, -0.26);
      binocGroup.add(tube);
    }
    binocGroup.visible = false;
    viewModelGroup.add(binocGroup);

    // First-Person Boot Viewmodel for Stomping Exhausted Dima!
    const stompBootGroup = new THREE.Group();
    const legMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }));
    const bootMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65 }));
    const soleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 }));
    const pantLeg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.1, 0.72, 10)), legMat);
    pantLeg.position.set(0, 0.26, 0.04);
    const bootUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.2, 0.42)), bootMat);
    bootUpper.position.set(0, -0.14, -0.06);
    const bootSole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.07, 0.45)), soleMat);
    bootSole.position.set(0, -0.26, -0.06);
    stompBootGroup.add(pantLeg, bootUpper, bootSole);
    stompBootGroup.position.set(0.05, 0.2, -0.82);
    stompBootGroup.visible = false;
    camera.add(stompBootGroup);

    // First-Person Combat Knife Viewmodel for Lupik Ability 2 (Enraged Gilbert!)
    const knifeGroup = new THREE.Group();
    const knifeGripMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e241b, roughness: 0.85 }));
    const knifeBladeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 }));
    const knifeEdgeGlowMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.85, roughness: 0.3 })
    );
    const kArm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.11, 0.11, 0.38)),
      trackMat(new THREE.MeshStandardMaterial({ color: isGilbert ? 0x252b21 : 0x1d4ed8, roughness: 0.8 }))
    );
    kArm.position.set(0, -0.1, 0.22);
    const kHandle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.2, 8)), knifeGripMat);
    kHandle.rotation.x = Math.PI / 2;
    kHandle.position.set(0, -0.02, 0.02);
    const kGuard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.035, 0.03)), gunMetalMat);
    kGuard.position.set(0, -0.02, -0.08);
    const kBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.024, 0.065, 0.34)), knifeBladeMat);
    kBlade.position.set(0, -0.01, -0.26);
    const kTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.035, 0.12, 4)), knifeEdgeGlowMat);
    kTip.rotation.x = -Math.PI / 2;
    kTip.position.set(0, -0.01, -0.47);
    knifeGroup.add(kArm, kHandle, kGuard, kBlade, kTip);
    knifeGroup.position.set(0.28, -0.22, -0.48);
    knifeGroup.visible = false;
    camera.add(knifeGroup);

    // First-Person Impaled Bloody Skewer Viewmodel (visible during Wild Cucumber 5s Impale IFRAME Cutscene)
    const impaledSkewerGroup = new THREE.Group();
    const impSteelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.2 }));
    const impBloodMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.45,
        roughness: 0.14,
        metalness: 0.12,
      })
    );
    const impShaft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 0.022, 1.35)), impSteelMat);
    impShaft.position.set(0, 0, 0);
    const impBloodCoat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.062, 0.028, 0.72)), impBloodMat);
    impBloodCoat.position.set(0, 0, -0.05);
    const impTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.048, 0.24, 4)), impBloodMat);
    impTip.rotation.x = Math.PI / 2;
    impTip.position.set(0, 0, 0.76);
    impaledSkewerGroup.add(impShaft, impBloodCoat, impTip);
    impaledSkewerGroup.position.set(0.02, -0.21, -0.48);
    impaledSkewerGroup.rotation.set(-0.22, 0.06, 0.08);
    impaledSkewerGroup.visible = false;
    camera.add(impaledSkewerGroup);

    camera.add(viewModelGroup);
    scene.add(camera);

    // =========================================================================
    // BOSS ДИМА (КАСТРЮЛЬНЫЙ РЫЦАРЬ · 5000 HP) + СЕСТРА + ИЛИХЕ
    // =========================================================================
    const makeHoodieFrontTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#3b1c24';
      ctx.fillRect(0, 0, 256, 256);
      // Kangaroo pocket shadow
      ctx.fillStyle = '#2a1218';
      ctx.fillRect(54, 165, 148, 72);
      ctx.strokeStyle = '#4f2732';
      ctx.lineWidth = 3;
      ctx.strokeRect(54, 165, 148, 72);
      // White chest lettering from Knight Dima reference
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('КАЗ', 128, 108);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('001', 128, 134);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    const makePaisleyCapriTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 256, 256);
      // White paisley / floral swirl pattern matching reference
      ctx.strokeStyle = '#e5e7eb';
      ctx.fillStyle = '#d1d5db';
      ctx.lineWidth = 2.5;
      for (let y = 16; y < 256; y += 34) {
        for (let x = 16; x < 256; x += 34) {
          const ox = x + ((y / 34) % 2) * 14;
          ctx.beginPath();
          ctx.arc(ox, y, 7, 0, Math.PI * 1.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + 6, y + 6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    const makeBellyWoundTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);

      // Dark soaked crimson stain soaking into hoodie fabric around the cut
      const soakGrad = ctx.createRadialGradient(128, 96, 12, 128, 108, 108);
      soakGrad.addColorStop(0, 'rgba(95, 8, 8, 0.94)');
      soakGrad.addColorStop(0.55, 'rgba(69, 6, 10, 0.72)');
      soakGrad.addColorStop(1, 'rgba(40, 4, 8, 0)');
      ctx.fillStyle = soakGrad;
      ctx.fillRect(0, 0, 256, 256);

      // Jagged diagonal slash across belly
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f0202';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.moveTo(34, 62);
      ctx.quadraticCurveTo(126, 98, 222, 128);
      ctx.stroke();

      // Deep arterial red wound core
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(38, 63);
      ctx.quadraticCurveTo(126, 98, 218, 126);
      ctx.stroke();

      // Fresh bright crimson wet blood highlight
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(46, 65);
      ctx.quadraticCurveTo(126, 97, 210, 123);
      ctx.stroke();
      ctx.restore();

      // Realistic vertical blood streaks & drips running down the hoodie
      const streaks = [
        { x: 64, y: 76, len: 120, w: 6 },
        { x: 92, y: 88, len: 148, w: 8 },
        { x: 118, y: 97, len: 155, w: 10 },
        { x: 146, y: 104, len: 142, w: 7 },
        { x: 176, y: 112, len: 128, w: 6 },
        { x: 202, y: 121, len: 96, w: 5 },
      ];
      for (const s of streaks) {
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.len);
        g.addColorStop(0, '#991b1b');
        g.addColorStop(0.55, '#b91c1c');
        g.addColorStop(1, 'rgba(127, 29, 29, 0.25)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(s.x - s.w / 2, s.y, s.w, s.len, s.w / 2);
        ctx.fill();

        // Wet droplet bead at tip
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(s.x, s.y + s.len - 2, s.w * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    const buildBossDima = () => {
      const root = new THREE.Group();
      const hoodieMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b1c24, roughness: 0.8 }));
      const hoodieFrontMat = trackMat(
        new THREE.MeshStandardMaterial({ map: makeHoodieFrontTexture(), roughness: 0.78 })
      );
      const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 }));
      const potWhiteMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.25, metalness: 0.25 })
      );
      const darkMetalMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.45, metalness: 0.65 })
      );
      const lidSteelMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.35, metalness: 0.75 })
      );
      const baguetteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 }));

      // Articulated Legs (thigh + knee-pivoted shin & shoe for true one-knee kneeling!)
      const makeLeg = (xPos: number) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(xPos, 1.05, 0);
        const thigh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.56, 0.38)), pantsMat);
        thigh.position.set(0, -0.26, 0);
        thigh.castShadow = true;
        const knee = new THREE.Group();
        knee.position.set(0, -0.52, 0);
        const shin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.52, 0.36)), pantsMat);
        shin.position.set(0, -0.26, 0);
        shin.castShadow = true;
        const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.16, 0.48)), darkMetalMat);
        shoe.position.set(0, -0.45, 0.05);
        knee.add(shin, shoe);
        legGroup.add(thigh, knee);
        root.add(legGroup);
        return { legGroup, knee };
      };
      const leftLeg = makeLeg(-0.26);
      const rightLeg = makeLeg(0.26);

      // Upper Body Group (torso, belly wound, head, pot helmet, left & right arms)
      const upperBodyGroup = new THREE.Group();
      root.add(upperBodyGroup);

      // Dark Burgundy Hoodie torso (with chest lettering on front)
      const hoodieMats = [hoodieMat, hoodieMat, hoodieMat, hoodieMat, hoodieFrontMat, hoodieMat];
      const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 1.38, 0.68)), hoodieMats);
      torso.position.y = 1.75;
      torso.castShadow = true;
      upperBodyGroup.add(torso);

      // Hardcore Armor Plates (Belly / Front + Back tactical steel plates with bolts)
      if (isHardcore) {
        const armorSteelMat = trackMat(
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.28, metalness: 0.88 })
        );
        const armorTrimMat = trackMat(
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.72 })
        );
        const armorBoltMat = trackMat(
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.8 })
        );

        const buildPlate = (zPos: number, isFront: boolean) => {
          const plateGrp = new THREE.Group();
          const mainPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.06, 1.06, 0.085)), armorSteelMat);
          const rimFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 1.12, 0.05)), armorTrimMat);
          rimFrame.position.z = isFront ? -0.015 : 0.015;
          const midRib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.08, 0.11, 0.1)), armorTrimMat);
          midRib.position.y = -0.14;
          plateGrp.add(mainPlate, rimFrame, midRib);
          for (const bx of [-0.4, 0.4]) {
            for (const by of [-0.4, 0.38]) {
              const bolt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.11, 8)), armorBoltMat);
              bolt.rotation.x = Math.PI / 2;
              bolt.position.set(bx, by, 0);
              plateGrp.add(bolt);
            }
          }
          plateGrp.position.set(0, 1.66, zPos);
          upperBodyGroup.add(plateGrp);
        };
        buildPlate(0.37, true);
        buildPlate(-0.37, false);
      }

      // Realistic Red Belly Slash Wound + Clot Rim + Dripping Blood Decal
      const bellyWoundGroup = new THREE.Group();
      bellyWoundGroup.visible = false;
      const woundDecalMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: makeBellyWoundTexture(),
          transparent: true,
          roughness: 0.14,
          metalness: 0.08,
          depthWrite: false,
        })
      );
      const woundZ = isHardcore ? 0.422 : 0.348;
      const woundPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.06, 0.92)), woundDecalMat);
      woundPlane.position.set(0, 1.48, woundZ);
      bellyWoundGroup.add(woundPlane);

      const gashCore = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.055, 0.72, 6, 10)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x7f1d1d,
            emissive: 0x450a0a,
            emissiveIntensity: 0.45,
            roughness: 0.12,
            metalness: 0.12,
          })
        )
      );
      gashCore.position.set(0, 1.54, woundZ + 0.005);
      gashCore.rotation.z = 1.24;
      bellyWoundGroup.add(gashCore);
      upperBodyGroup.add(bellyWoundGroup);

      // Hoodie hood collar at back of neck
      const hoodCollar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.12, 8, 16)), hoodieMat);
      hoodCollar.rotation.x = Math.PI / 2;
      hoodCollar.position.set(0, 2.45, -0.05);
      upperBodyGroup.add(hoodCollar);

      // Head + determined eyes
      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.35, 16, 16)), skinMat);
      head.position.y = 2.75;
      head.castShadow = true;
      upperBodyGroup.add(head);

      const eyeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }));
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.05, 0.05)), eyeMat);
        eye.position.set(side * 0.12, 2.76, 0.33);
        upperBodyGroup.add(eye);
      }

      // WHITE COOKING POT HELMET WITH TWO SIDE HANDLES (knocked askew + cracked in Phase 2!)
      const potGroup = new THREE.Group();
      potGroup.position.set(0, 3.05, 0);
      const potBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.47, 0.45, 0.54, 18)), potWhiteMat);
      potBody.castShadow = true;
      const potBottomRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.46, 0.035, 8, 22)), darkMetalMat);
      potBottomRim.rotation.x = Math.PI / 2;
      potBottomRim.position.y = -0.26;
      const potTopRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.47, 0.03, 8, 22)), darkMetalMat);
      potTopRim.rotation.x = Math.PI / 2;
      potTopRim.position.y = 0.27;
      potGroup.add(potBody, potBottomRim, potTopRim);

      // Dark dent/crack stripe visible when helmet is knocked askew in Phase 2
      const potCrack = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.06, 0.38, 0.14)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 }))
      );
      potCrack.position.set(0.22, 0.02, 0.42);
      potCrack.rotation.z = 0.42;
      potCrack.visible = false;
      potGroup.add(potCrack);

      // Two pot loop handles sticking out left and right
      const leftPotHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.12, 0.032, 8, 14)), darkMetalMat);
      leftPotHandle.position.set(-0.5, 0.04, 0);
      leftPotHandle.rotation.y = Math.PI / 2;
      const rightPotHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.12, 0.032, 8, 14)), darkMetalMat);
      rightPotHandle.position.set(0.5, 0.04, 0);
      rightPotHandle.rotation.y = Math.PI / 2;
      potGroup.add(leftPotHandle, rightPotHandle);
      upperBodyGroup.add(potGroup);

      // LEFT ARM: Round Pot Lid Shield (intact in Phase 1 -> shattered half-shield in Phase 2!)
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.74, 2.05, 0.2);
      const lSleeve = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.72, 0.28)), hoodieMat);
      lSleeve.position.set(0, -0.25, 0.15);
      lSleeve.rotation.x = -0.7;

      const intactShieldGroup = new THREE.Group();
      const lidShield = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 22)), lidSteelMat);
      lidShield.rotation.x = Math.PI / 2;
      lidShield.position.set(0.05, -0.15, 0.58);
      lidShield.castShadow = true;
      const lidRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.75, 0.035, 8, 24)), darkMetalMat);
      lidRim.position.set(0.05, -0.15, 0.61);
      const lidKnob = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 10)), darkMetalMat);
      lidKnob.rotation.x = Math.PI / 2;
      lidKnob.position.set(0.05, -0.15, 0.64);
      intactShieldGroup.add(lidShield, lidRim, lidKnob);

      const brokenShieldGroup = new THREE.Group();
      brokenShieldGroup.visible = false;
      const halfLid = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 16, 1, false, 0, Math.PI * 1.1)),
        lidSteelMat
      );
      halfLid.rotation.x = Math.PI / 2;
      halfLid.rotation.y = 0.35;
      halfLid.position.set(0.05, -0.15, 0.58);
      halfLid.castShadow = true;
      const halfRim = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.75, 0.035, 8, 16, Math.PI * 1.1)),
        darkMetalMat
      );
      halfRim.position.set(0.05, -0.15, 0.61);
      halfRim.rotation.z = -0.35;
      // Jagged broken edge shards & scorch crack
      for (let s = 0; s < 3; s++) {
        const shard = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.34, 4)), darkMetalMat);
        shard.position.set(-0.08 + s * 0.12, -0.25 + s * 0.18, 0.59);
        shard.rotation.z = 0.8 + s * 0.25;
        brokenShieldGroup.add(shard);
      }
      const bentKnob = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.1, 0.11, 8)), darkMetalMat);
      bentKnob.rotation.set(Math.PI / 2 + 0.35, 0, 0.4);
      bentKnob.position.set(0.08, -0.18, 0.64);
      brokenShieldGroup.add(halfLid, halfRim, bentKnob);

      leftArm.add(lSleeve, intactShieldGroup, brokenShieldGroup);
      upperBodyGroup.add(leftArm);

      // RIGHT ARM: Baguette / Wooden Sword!
      const rightArm = new THREE.Group();
      rightArm.position.set(0.74, 2.05, 0.12);
      const rSleeve = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.72, 0.28)), hoodieMat);
      rSleeve.position.set(0, -0.28, 0.12);
      rSleeve.rotation.x = -0.45;
      const baguette = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 1.05, 6, 10)), baguetteMat);
      baguette.position.set(0.05, 0.12, 0.36);
      baguette.rotation.x = 0.28;
      baguette.castShadow = true;
      rightArm.add(rSleeve, baguette);
      upperBodyGroup.add(rightArm);

      // Radar highlight overlays (Egor's ult)
      const radarRing = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(1.4, 1.85, 36)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0, side: THREE.DoubleSide }))
      );
      radarRing.rotation.x = -Math.PI / 2;
      radarRing.position.y = 0.05;
      root.add(radarRing);

      const radarBeam = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.95, 0.95, 10, 18, 1, true)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
      );
      radarBeam.position.y = 5;
      root.add(radarBeam);

      return {
        root,
        upperBodyGroup,
        leftLeg,
        rightLeg,
        bellyWoundGroup,
        radarRing,
        radarBeam,
        leftArm,
        rightArm,
        potGroup,
        potCrack,
        rightPotHandle,
        intactShieldGroup,
        brokenShieldGroup,
        lidSteelMat,
        hoodieMat,
        hoodieFrontMat,
        potWhiteMat,
        skewerGroup: undefined as THREE.Group | undefined,
        backJarGroup: undefined as THREE.Group | undefined,
      };
    };

    // Build Dima's Sister matching the uploaded reference (grey t-shirt, paisley capris, white sandals)
    const buildDimaSister = () => {
      const root = new THREE.Group();
      const greyTeeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 }));
      const capriMat = trackMat(
        new THREE.MeshStandardMaterial({ map: makePaisleyCapriTexture(), roughness: 0.85 })
      );
      const sandalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }));
      const hairDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1f1b18, roughness: 0.88 }));

      // Legs (capris + bare lower shins + white sandals)
      for (const side of [-1, 1]) {
        const capri = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.15, 0.62, 10)), capriMat);
        capri.position.set(side * 0.22, 0.68, 0);
        const shin = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.09, 0.36, 8)), skinMat);
        shin.position.set(side * 0.22, 0.22, 0);
        const sandal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.08, 0.36)), sandalMat);
        sandal.position.set(side * 0.22, 0.04, 0.05);
        root.add(capri, shin, sandal);
      }

      // Grey short-sleeve t-shirt torso
      const torso = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.54, 1.05, 14)), greyTeeMat);
      torso.scale.set(1.08, 1, 0.88);
      torso.position.y = 1.48;
      torso.castShadow = true;
      root.add(torso);

      // Arms (short sleeves + skin arms)
      for (const side of [-1, 1]) {
        const sleeve = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.12, 0.24, 8)), greyTeeMat);
        sleeve.position.set(side * 0.58, 1.82, 0);
        sleeve.rotation.z = side * 0.35;
        const arm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.08, 0.56, 8)), skinMat);
        arm.position.set(side * 0.68, 1.5, 0.08);
        arm.rotation.z = side * 0.25;
        root.add(sleeve, arm);
      }

      // Head + dark hair + ponytail
      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.31, 14, 14)), skinMat);
      head.position.y = 2.26;
      head.castShadow = true;
      const hairTop = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.325, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58)),
        hairDarkMat
      );
      hairTop.position.set(0, 2.29, -0.02);
      const ponytail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.12, 0.45, 8)), hairDarkMat);
      ponytail.position.set(0, 2.1, -0.34);
      ponytail.rotation.x = -0.35;
      root.add(head, hairTop, ponytail);

      return root;
    };

    // Build Minion ИЛИХЕ (Fat Luffy from One Piece skin)
    const buildIliheFatLuffy = () => {
      const root = new THREE.Group();
      const redVestMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.72 }));
      const denimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.85 }));
      const strawMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }));
      const strawBandMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 }));
      const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }));
      const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.3 }));

      // Sandals & short legs
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.13, 0.42, 8)), skinMat);
        leg.position.set(side * 0.28, 0.24, 0);
        const shorts = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.21, 0.36, 10)), denimMat);
        shorts.position.set(side * 0.28, 0.48, 0);
        const sandal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.08, 0.34)), woodMat);
        sandal.position.set(side * 0.28, 0.04, 0.04);
        root.add(leg, shorts, sandal);
      }

      // BIG ROUND PROTRUDING BELLY (Толстый Луффи!)
      const bellyGroup = new THREE.Group();
      const belly = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.76, 18, 16)), skinMat);
      belly.scale.set(1.08, 0.92, 1.15);
      belly.position.set(0, 1.05, 0.08);
      belly.castShadow = true;
      bellyGroup.add(belly);

      // Open Red Vest wrapping sides of belly
      for (const side of [-1, 1]) {
        const vestSide = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.78, 14, 14, side === 1 ? -0.4 : Math.PI * 0.65, Math.PI * 0.75)),
          redVestMat
        );
        vestSide.scale.set(1.06, 0.94, 1.12);
        vestSide.position.set(0, 1.06, 0.06);
        bellyGroup.add(vestSide);
      }

      // Gold vest buttons & yellow sash
      const sash = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.68, 0.09, 8, 22)), goldMat);
      sash.rotation.x = Math.PI / 2;
      sash.position.set(0, 0.68, 0.06);
      bellyGroup.add(sash);
      root.add(bellyGroup);

      // Chubby arms
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.13, 0.42, 6, 8)), skinMat);
        arm.position.set(side * 0.85, 1.15, 0.06);
        arm.rotation.z = side * 0.4;
        root.add(arm);
      }

      // Head + messy black hair + iconic straw hat (Mugiwara)
      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.32, 14, 14)), skinMat);
      head.position.set(0, 1.85, 0.05);
      head.castShadow = true;
      root.add(head);

      const hair = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.34, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        hairMat
      );
      hair.position.set(0, 1.88, 0.03);
      root.add(hair);

      // Straw Hat Brim & Crown
      const hatBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.62, 0.64, 0.05, 18)), strawMat);
      hatBrim.position.set(0, 2.08, 0.04);
      const hatCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 16)), strawMat);
      hatCrown.position.set(0, 2.2, 0.04);
      const hatRibbon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.355, 0.365, 0.06, 16)), strawBandMat);
      hatRibbon.position.set(0, 2.13, 0.04);
      root.add(hatBrim, hatCrown, hatRibbon);

      return { root, bellyGroup };
    };

    const buildDogHelper = (withRadar: boolean) => {
      const dog = new THREE.Group();
      const furMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc28e5c, roughness: 0.85 }));
      const darkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.7 }));

      const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 0.5, 1.15)), furMat);
      body.position.y = 0.55;
      body.castShadow = true;
      dog.add(body);

      const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.42, 0.48)), furMat);
      head.position.set(0, 0.9, 0.68);
      dog.add(head);

      const snout = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.2, 0.25)), darkMat);
      snout.position.set(0, 0.83, 0.96);
      dog.add(snout);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.1, 0.24, 5)), darkMat);
        ear.position.set(side * 0.16, 1.2, 0.62);
        dog.add(ear);
      }

      if (withRadar) {
        const dishGroup = new THREE.Group();
        dishGroup.position.set(0, 0.95, -0.1);
        const dish = new THREE.Mesh(
          trackGeo(new THREE.ConeGeometry(0.45, 0.35, 14, 1, true)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.9, side: THREE.DoubleSide }))
        );
        dish.rotation.x = Math.PI * 0.65;
        dishGroup.add(dish);
        dog.add(dishGroup);
        dog.userData.dish = dishGroup;
      } else {
        const plate = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.38, 0.32, 0.08, 12)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.3 }))
        );
        plate.position.set(0, 0.84, 0);
        const meat = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.42, 0.18, 0.42)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 }))
        );
        meat.position.set(0, 0.95, 0);
        dog.add(plate, meat);
      }

      return dog;
    };

    // Build Minion МАКС (Turkey / Боевой индюк)
    const buildMaksTurkey = () => {
      const root = new THREE.Group();
      const featherDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x452412, roughness: 0.85 }));
      const featherChestMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c3e1b, roughness: 0.78 }));
      const featherTipMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 }));
      const neckBlueMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 }));
      const wattleRedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 }));
      const beakMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35, metalness: 0.1 }));
      const legOrangeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65 }));
      const eyeDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 }));

      // Turkey legs & 3-toed feet flush on snow
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.04, 0.42, 8)), legOrangeMat);
        leg.position.set(side * 0.22, 0.22, 0.02);
        root.add(leg);
        for (const toeAngle of [-0.35, 0, 0.35]) {
          const toe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.04, 0.22)), legOrangeMat);
          toe.position.set(side * 0.22 + Math.sin(toeAngle) * 0.08, 0.02, 0.1 + Math.cos(toeAngle) * 0.08);
          toe.rotation.y = toeAngle;
          root.add(toe);
        }
      }

      // Plump feathered turkey body
      const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.54, 16, 14)), featherDarkMat);
      body.scale.set(1.0, 0.88, 1.24);
      body.position.set(0, 0.78, 0);
      body.castShadow = true;
      root.add(body);

      const breast = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 14, 12)), featherChestMat);
      breast.scale.set(0.95, 0.86, 0.9);
      breast.position.set(0, 0.76, 0.34);
      root.add(breast);

      // Fanned Turkey Tail Feathers
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.96, -0.58);
      tailGroup.rotation.x = -0.25;
      for (let i = -3; i <= 3; i++) {
        const angle = i * 0.26;
        const featherPivot = new THREE.Group();
        featherPivot.rotation.z = angle;
        const blade = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.22, 0.95, 0.06)),
          i % 2 === 0 ? featherDarkMat : featherChestMat
        );
        blade.position.y = 0.48;
        const tip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.23, 0.16, 0.07)), featherTipMat);
        tip.position.y = 0.92;
        featherPivot.add(blade, tip);
        tailGroup.add(featherPivot);
      }
      root.add(tailGroup);

      // Articulated Flapping Wings
      const makeWing = (side: -1 | 1) => {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 0.48, 0.92, 0.05);
        const wingMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.1, 0.62)), featherChestMat);
        wingMesh.position.set(side * 0.24, 0, -0.04);
        wingMesh.castShadow = true;
        const wingTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.09, 0.56)), featherTipMat);
        wingTrim.position.set(side * 0.46, 0, -0.04);
        wingPivot.add(wingMesh, wingTrim);
        root.add(wingPivot);
        return wingPivot;
      };
      const leftWing = makeWing(-1);
      const rightWing = makeWing(1);

      // Turkey Neck, Bald Head, Sharp Beak & Red Wattle/Snood
      const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 0.52, 10)), neckBlueMat);
      neck.position.set(0, 1.32, 0.42);
      neck.rotation.x = 0.24;
      root.add(neck);

      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.19, 12, 12)), neckBlueMat);
      head.position.set(0, 1.6, 0.5);
      head.castShadow = true;
      root.add(head);

      const beak = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.08, 0.34, 8)), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 1.58, 0.76);
      root.add(beak);

      const snood = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.04, 0.14, 4, 6)), wattleRedMat);
      snood.position.set(0, 1.63, 0.67);
      snood.rotation.x = 0.45;
      const wattle = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.09, 8, 8)), wattleRedMat);
      wattle.scale.set(0.85, 1.35, 0.85);
      wattle.position.set(0, 1.43, 0.62);
      root.add(snood, wattle);

      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 8, 8)), eyeDarkMat);
        eye.position.set(side * 0.12, 1.64, 0.63);
        root.add(eye);
      }

      return { root, leftWing, rightWing, tailGroup };
    };

    const makeCucumberBodyTexture = () => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d')!;

      // Rich cucumber green base with longitudinal botanical shading
      const grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, '#1f6b29');
      grad.addColorStop(0.25, '#2f963d');
      grad.addColorStop(0.5, '#43b852');
      grad.addColorStop(0.75, '#2b8a38');
      grad.addColorStop(1, '#1f6b29');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Subtle vertical cucumber ribs
      for (let x = 0; x < 512; x += 32) {
        ctx.fillStyle = 'rgba(10, 32, 12, 0.22)';
        ctx.fillRect(x, 0, 6, 512);
        ctx.fillStyle = 'rgba(134, 239, 172, 0.14)';
        ctx.fillRect(x + 12, 0, 4, 512);
      }

      // Natural cucumber skin speckles & bumps
      for (let i = 0; i < 180; i++) {
        const bx = (i * 73) % 512;
        const by = (i * 137) % 512;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(16, 48, 19, 0.65)' : 'rgba(110, 224, 114, 0.55)';
        ctx.beginPath();
        ctx.arc(bx, by, 3 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }

      // MANY HEALED SCAR CUTS (множество заживших шрамов-порезов, БЕЗ КРОВИ!)
      const drawHealedScar = (x1: number, y1: number, x2: number, y2: number, thickness: number, stitches: number) => {
        ctx.save();
        ctx.lineCap = 'round';
        // Outer recessed dark green groove
        ctx.strokeStyle = '#123616';
        ctx.lineWidth = thickness + 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Pale sage/mint healed scar tissue core (strictly NO red blood)
        ctx.strokeStyle = '#a7d39b';
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Subtle cross-hatch healed suture marks
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * (thickness + 4);
        const ny = (dx / len) * (thickness + 4);
        ctx.strokeStyle = '#c5e4bb';
        ctx.lineWidth = Math.max(1.5, thickness * 0.45);
        for (let s = 1; s < stitches; s++) {
          const t = s / stitches;
          const sx = x1 + dx * t;
          const sy = y1 + dy * t;
          ctx.beginPath();
          ctx.moveTo(sx - nx, sy - ny);
          ctx.lineTo(sx + nx, sy + ny);
          ctx.stroke();
        }
        ctx.restore();
      };

      // Criss-crossing healed battle scars across front, sides, and back of cucumber
      drawHealedScar(65, 110, 195, 175, 4.5, 6);
      drawHealedScar(210, 95, 345, 155, 5, 7);
      drawHealedScar(140, 210, 310, 290, 5.5, 8);
      drawHealedScar(295, 200, 175, 310, 4.5, 6);
      drawHealedScar(80, 320, 215, 385, 4, 5);
      drawHealedScar(260, 340, 415, 420, 5, 7);
      drawHealedScar(360, 120, 465, 210, 4, 5);
      drawHealedScar(30, 230, 130, 295, 4, 5);
      drawHealedScar(350, 270, 480, 330, 4.5, 6);
      drawHealedScar(155, 415, 290, 470, 4, 5);
      // Facial scar over one brow/cheek
      drawHealedScar(220, 58, 280, 112, 3.8, 4);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposables.push(tex);
      return tex;
    };

    const buildBossWildCucumber = () => {
      const root = new THREE.Group();
      const cucumberTex = makeCucumberBodyTexture();
      const cucumberMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: cucumberTex,
          emissive: 0x0f4719,
          emissiveIntensity: 0.34,
          roughness: 0.56,
          metalness: 0.04,
        })
      );
      const cucumberDarkMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x1e6b27,
          emissive: 0x0a2e10,
          emissiveIntensity: 0.25,
          roughness: 0.65,
        })
      );
      const coatMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x14121d,
          roughness: 0.85,
          metalness: 0.08,
        })
      );
      const coatTrimMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x4c1d95,
          emissive: 0x2e1065,
          emissiveIntensity: 0.35,
          roughness: 0.65,
        })
      );
      const chainIronMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.32,
          metalness: 0.88,
        })
      );
      const jarGlassMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xcffafe,
          transparent: true,
          opacity: 0.36,
          roughness: 0.1,
          metalness: 0.25,
          depthWrite: false,
        })
      );
      const jarBrineMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.24,
          roughness: 0.2,
          depthWrite: false,
        })
      );
      const jarLidMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x92400e,
          roughness: 0.35,
          metalness: 0.8,
        })
      );
      const scarTissueMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xa7d39b,
          roughness: 0.72,
        })
      );
      const circletIronMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x1e1b2e,
          roughness: 0.38,
          metalness: 0.82,
        })
      );
      const skewerSteelMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.2,
          metalness: 0.92,
        })
      );
      const bloodySkewerMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x991b1b,
          emissive: 0x450a0a,
          emissiveIntensity: 0.4,
          roughness: 0.14,
          metalness: 0.15,
        })
      );

      // Articulated Legs (dark Erlking boots & tattered trousers)
      const makeLeg = (xPos: number) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(xPos, 1.05, 0);
        const thigh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.56, 0.36)), coatMat);
        thigh.position.set(0, -0.26, 0);
        thigh.castShadow = true;
        const knee = new THREE.Group();
        knee.position.set(0, -0.52, 0);
        const shin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.52, 0.34)), coatMat);
        shin.position.set(0, -0.26, 0);
        shin.castShadow = true;
        const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.18, 0.52)), chainIronMat);
        shoe.position.set(0, -0.45, 0.06);
        knee.add(shin, shoe);
        legGroup.add(thigh, knee);
        root.add(legGroup);
        return { legGroup, knee };
      };
      const leftLeg = makeLeg(-0.28);
      const rightLeg = makeLeg(0.28);

      const upperBodyGroup = new THREE.Group();
      root.add(upperBodyGroup);

      // 1. MAIN CUCUMBER BODY (Tall, menacing, with raised 3D bumps & healed scars)
      const cucumberBody = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.6, 1.54, 12, 22)),
        cucumberMat
      );
      cucumberBody.position.set(0, 2.04, 0);
      cucumberBody.scale.set(1.06, 1.0, 0.98);
      cucumberBody.castShadow = true;
      upperBodyGroup.add(cucumberBody);

      // Cucumber warts/bumps across front, back & side silhouettes
      for (const [wx, wy, wz] of [
        [-0.48, 1.75, 0.28],
        [0.46, 2.18, 0.24],
        [-0.42, 2.38, -0.25],
        [0.44, 1.58, -0.24],
        [0.18, 1.35, 0.48],
        [-0.22, 2.95, 0.38],
        [-0.58, 1.98, 0.02],
        [-0.56, 2.58, 0.14],
        [0.58, 2.02, 0.02],
        [0.55, 2.62, 0.12],
      ] as [number, number, number][]) {
        const wart = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.078, 8, 8)), cucumberDarkMat);
        wart.position.set(wx, wy, wz);
        upperBodyGroup.add(wart);
      }

      // Raised 3D healed scars (no blood on body!)
      const raisedScars: [number, number, number, number, number, number][] = [
        [-0.14, 2.15, 0.56, 0.58, 0.52, 0.1],
        [0.18, 1.78, 0.56, -0.62, 0.48, -0.1],
        [-0.2, 2.52, 0.54, 0.42, 0.36, 0.08],
        [0.28, 2.38, 0.48, -0.45, 0.34, 0.3],
      ];
      for (const [sx, sy, sz, rz, len, ry] of raisedScars) {
        const scarMesh = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.018, len, 4, 8)), scarTissueMat);
        scarMesh.position.set(sx, sy, sz);
        scarMesh.rotation.set(0, ry, rz);
        upperBodyGroup.add(scarMesh);
      }

      // Erlking-style tattered gothic shoulder mantle & back coat tails (tucked behind torso so green cucumber shines in profile!)
      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.38)), coatMat);
        pauldron.position.set(side * 0.62, 2.42, -0.18);
        pauldron.rotation.z = -side * 0.25;
        const pauldronTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.055, 0.4)), coatTrimMat);
        pauldronTrim.position.set(side * 0.62, 2.53, -0.18);
        pauldronTrim.rotation.z = -side * 0.25;
        const coatTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.96, 0.34)), coatMat);
        coatTail.position.set(side * 0.52, 1.24, -0.32);
        coatTail.rotation.z = side * 0.12;
        upperBodyGroup.add(pauldron, pauldronTrim, coatTail);
      }

      // ANGRY EYEBROWS & GLOWING ERLKING EYES on upper cucumber face
      const browMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x09160b, roughness: 0.75 }));
      const glowEyeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xf5d0fe,
          emissive: 0xc084fc,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        })
      );
      for (const side of [-1, 1]) {
        // Thick furrowed angry eyebrow sloping sharply down toward nose bridge
        const brow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.075, 0.12)), browMat);
        brow.position.set(side * 0.18, 2.79, 0.56);
        brow.rotation.z = -side * 0.42;
        brow.rotation.y = side * 0.15;
        upperBodyGroup.add(brow);

        // Fierce glowing eye socket + iris
        const eyeSocket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.09, 0.06)), browMat);
        eyeSocket.position.set(side * 0.17, 2.68, 0.54);
        const eyeIris = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.045, 0.05)), glowEyeMat);
        eyeIris.position.set(side * 0.17, 2.68, 0.565);
        eyeIris.rotation.z = -side * 0.18;
        upperBodyGroup.add(eyeSocket, eyeIris);
      }
      // Scowling grim mouth line
      const mouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.035, 0.06)), browMat);
      mouth.position.set(0, 2.46, 0.57);
      upperBodyGroup.add(mouth);

      // Cucumber stem + Erlking dark iron crown/circlet (`potGroup` for animation compatibility)
      const potGroup = new THREE.Group();
      potGroup.position.set(0, 3.26, 0);
      const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.135, 0.42, 8)), cucumberDarkMat);
      stem.position.set(0, 0.22, -0.02);
      stem.rotation.z = 0.22;
      const circlet = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.045, 8, 18)), circletIronMat);
      circlet.rotation.x = Math.PI / 2;
      circlet.position.y = -0.08;
      potGroup.add(stem, circlet);

      const potCrack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.22, 0.08)), coatTrimMat);
      potCrack.position.set(0, 0.02, 0.36);
      potCrack.visible = false;
      const rightPotHandle = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.2, 4)), circletIronMat);
      rightPotHandle.position.set(0.36, 0.02, 0);
      potGroup.add(potCrack, rightPotHandle);
      upperBodyGroup.add(potGroup);

      // 2. GLASS JAR WITH PICKLES ON HIS BACK (like Erlking's coffin)
      const backJarGroup = new THREE.Group();
      backJarGroup.position.set(0, 2.02, -0.82);
      backJarGroup.rotation.z = -0.22;

      const jarCylinder = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 1.32, 20)), jarGlassMat);
      jarCylinder.castShadow = true;
      const jarBrine = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16)), jarBrineMat);
      jarBrine.position.y = -0.06;
      const jarLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.49, 0.49, 0.18, 20)), jarLidMat);
      jarLid.position.y = 0.72;
      const jarBottom = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.47, 0.45, 0.08, 20)), jarGlassMat);
      jarBottom.position.y = -0.66;
      backJarGroup.add(jarBrine, jarCylinder, jarLid, jarBottom);

      // Pickles floating inside the jar!
      const innerPickles: [number, number, number, number, number][] = [
        [-0.16, -0.1, 0.14, 0.22, 0.1],
        [0.18, -0.05, -0.12, -0.18, 0.2],
        [0.0, 0.14, 0.16, 0.08, -0.25],
        [-0.14, 0.22, -0.14, -0.28, 0.15],
        [0.15, -0.26, 0.12, 0.35, -0.12],
      ];
      for (const [px, py, pz, rx, rz] of innerPickles) {
        const pkl = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 0.36, 6, 10)), cucumberDarkMat);
        pkl.position.set(px, py, pz);
        pkl.rotation.set(rx, 0, rz);
        backJarGroup.add(pkl);
      }

      // Iron harness bands around jar
      for (const hy of [-0.36, 0.36]) {
        const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.475, 0.042, 8, 22)), chainIronMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = hy;
        backJarGroup.add(band);
      }
      upperBodyGroup.add(backJarGroup);

      // TWO CHAINS FROM THE BACK JAR CROSSING IN AN X ON THE FRONT OF THE CUCUMBER TORSO!
      const chainLinkGeo = trackGeo(new THREE.TorusGeometry(0.06, 0.021, 6, 12));
      const addChainSpan = (pStart: THREE.Vector3, pMid: THREE.Vector3, pEnd: THREE.Vector3, count: number) => {
        const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const pt = curve.getPoint(t);
          const tan = curve.getTangent(t);
          const link = new THREE.Mesh(chainLinkGeo, chainIronMat);
          link.position.copy(pt);
          link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
          if (i % 2 === 1) link.rotateY(Math.PI / 2);
          upperBodyGroup.add(link);
        }
      };

      // Chain 1: back top-left of jar -> over left shoulder -> diagonal across front chest -> right hip -> back bottom-right of jar
      addChainSpan(new THREE.Vector3(-0.36, 2.38, -0.78), new THREE.Vector3(-0.56, 2.58, 0.05), new THREE.Vector3(-0.36, 2.26, 0.56), 12);
      addChainSpan(new THREE.Vector3(-0.36, 2.26, 0.56), new THREE.Vector3(0.0, 1.92, 0.62), new THREE.Vector3(0.40, 1.48, 0.54), 12);
      addChainSpan(new THREE.Vector3(0.40, 1.48, 0.54), new THREE.Vector3(0.56, 1.46, -0.05), new THREE.Vector3(0.36, 1.62, -0.78), 12);

      // Chain 2: back top-right of jar -> over right shoulder -> diagonal across front chest (crossing Chain 1!) -> left hip -> back bottom-left of jar
      addChainSpan(new THREE.Vector3(0.36, 2.38, -0.78), new THREE.Vector3(0.56, 2.58, 0.05), new THREE.Vector3(0.36, 2.26, 0.56), 12);
      addChainSpan(new THREE.Vector3(0.36, 2.26, 0.56), new THREE.Vector3(0.0, 1.92, 0.64), new THREE.Vector3(-0.40, 1.48, 0.54), 12);
      addChainSpan(new THREE.Vector3(-0.40, 1.48, 0.54), new THREE.Vector3(-0.56, 1.46, -0.05), new THREE.Vector3(-0.36, 1.62, -0.78), 12);

      // Central iron X-clasp where the two chains cross on his chest
      const chestClasp = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.11, 0)), chainIronMat);
      chestClasp.position.set(0, 1.92, 0.62);
      chestClasp.scale.set(1.1, 1.1, 0.55);
      upperBodyGroup.add(chestClasp);

      // Phase 2/3 Violet Energy Scar Crack (`bellyWoundGroup` — NO blood on body!)
      const bellyWoundGroup = new THREE.Group();
      bellyWoundGroup.visible = false;
      const energyCrack = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.04, 0.65, 6, 8)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xd8b4fe,
            emissive: 0x9333ea,
            emissiveIntensity: 1.8,
            roughness: 0.2,
          })
        )
      );
      energyCrack.position.set(0, 1.64, 0.57);
      energyCrack.rotation.z = 1.15;
      bellyWoundGroup.add(energyCrack);
      upperBodyGroup.add(bellyWoundGroup);

      // LEFT ARM: Cucumber arm with dark gothic sleeve/cuff (no pot lid shield)
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.72, 2.15, 0.08);
      const lArmMesh = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.13, 0.58, 6, 10)), cucumberMat);
      lArmMesh.position.set(0, -0.28, 0.14);
      lArmMesh.rotation.x = -0.55;
      const lCuff = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.24)), coatMat);
      lCuff.position.set(0, -0.45, 0.26);
      lCuff.rotation.x = -0.55;
      const intactShieldGroup = new THREE.Group();
      const brokenShieldGroup = new THREE.Group();
      brokenShieldGroup.visible = false;
      leftArm.add(lArmMesh, lCuff, intactShieldGroup, brokenShieldGroup);
      upperBodyGroup.add(leftArm);

      // 3. RIGHT ARM: BLOODY SHASHLIK SKEWER (ОКРОВАВЛЕННЫЙ ШАМПУР вместо меча!)
      const rightArm = new THREE.Group();
      rightArm.position.set(0.72, 2.15, 0.08);
      const rArmMesh = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.13, 0.58, 6, 10)), cucumberMat);
      rArmMesh.position.set(0, -0.28, 0.14);
      rArmMesh.rotation.x = -0.45;
      const rCuff = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.24)), coatMat);
      rCuff.position.set(0, -0.45, 0.24);
      rCuff.rotation.x = -0.45;

      const skewerGroup = new THREE.Group();
      skewerGroup.position.set(0.04, -0.35, 0.36);
      skewerGroup.rotation.x = 0.72;

      // Wooden handle grip + spiral steel guard
      const skewerHandle = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.42, 10)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 }))
      );
      skewerHandle.position.y = -0.24;
      const skewerSpiral = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.075, 0.018, 6, 14)), chainIronMat);
      skewerSpiral.rotation.x = Math.PI / 2;
      skewerSpiral.position.y = 0.02;

      // Long flat steel skewer blade
      const skewerBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 2.05, 0.022)), skewerSteelMat);
      skewerBlade.position.y = 1.05;
      skewerBlade.castShadow = true;
      const skewerTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.062, 0.28, 4)), bloodySkewerMat);
      skewerTip.position.y = 2.2;

      // Wet crimson blood coating & drips along the skewer blade!
      const bladeBlood1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.096, 1.05, 0.028)), bloodySkewerMat);
      bladeBlood1.position.y = 1.52;
      const bladeBlood2 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.028, 0.45, 4, 8)), bloodySkewerMat);
      bladeBlood2.position.set(0.03, 1.25, 0.015);
      const bladeBlood3 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.024, 0.36, 4, 8)), bloodySkewerMat);
      bladeBlood3.position.set(-0.028, 1.68, -0.014);

      skewerGroup.add(skewerHandle, skewerSpiral, skewerBlade, skewerTip, bladeBlood1, bladeBlood2, bladeBlood3);
      rightArm.add(rArmMesh, rCuff, skewerGroup);
      upperBodyGroup.add(rightArm);

      // Radar highlight overlays
      const radarRing = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(1.4, 1.85, 36)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0, side: THREE.DoubleSide }))
      );
      radarRing.rotation.x = -Math.PI / 2;
      radarRing.position.y = 0.05;
      root.add(radarRing);

      const radarBeam = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.95, 0.95, 10, 18, 1, true)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
      );
      radarBeam.position.y = 5;
      root.add(radarBeam);

      return {
        root,
        upperBodyGroup,
        leftLeg,
        rightLeg,
        bellyWoundGroup,
        radarRing,
        radarBeam,
        leftArm,
        rightArm,
        potGroup,
        potCrack,
        rightPotHandle,
        intactShieldGroup,
        brokenShieldGroup,
        lidSteelMat: chainIronMat,
        hoodieMat: cucumberMat,
        hoodieFrontMat: coatMat,
        potWhiteMat: circletIronMat,
        skewerGroup: skewerGroup as THREE.Group | undefined,
        backJarGroup: backJarGroup as THREE.Group | undefined,
      };
    };

    const bossModel = isWildCucumber ? buildBossWildCucumber() : buildBossDima();
    bossModel.root.position.set(0, 0, initSetup.bossZ);
    if (!initSetup.potVisible && !isWildCucumber) {
      bossModel.potGroup.position.set(0.24, 2.88, -0.14);
      bossModel.potGroup.rotation.set(-0.34, 0.25, -0.68);
    }
    scene.add(bossModel.root);
    bossThreatSpot.target.position.copy(bossModel.root.position);

    // Dynamic Ground Shadow & Phase 2/3 Menacing Shadow Aura beneath Dima
    const makeBossShadowTexture = (sharp: boolean) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 128, sharp ? 18 : 6, 128, 128, 126);
      if (sharp) {
        g.addColorStop(0, 'rgba(2, 2, 6, 0.98)');
        g.addColorStop(0.54, 'rgba(6, 4, 12, 0.92)');
        g.addColorStop(0.74, 'rgba(30, 5, 16, 0.58)');
        g.addColorStop(0.86, 'rgba(15, 2, 10, 0.16)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        g.addColorStop(0, 'rgba(8, 14, 28, 0.74)');
        g.addColorStop(0.45, 'rgba(8, 14, 28, 0.42)');
        g.addColorStop(0.8, 'rgba(8, 14, 28, 0.12)');
        g.addColorStop(1, 'rgba(8, 14, 28, 0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      disposables.push(tex);
      return tex;
    };

    const softBossShadowTex = makeBossShadowTexture(false);
    const sharpBossShadowTex = makeBossShadowTexture(true);

    const bossShadowGroup = new THREE.Group();
    bossShadowGroup.position.set(0, 0.026, -7);

    const bossShadowCoreMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: softBossShadowTex,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    const bossShadowCore = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.25, 3.25)), bossShadowCoreMat);
    bossShadowCore.rotation.x = -Math.PI / 2;

    const bossShadowAuraMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: sharpBossShadowTex,
        color: 0x7f1d1d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    const bossShadowAura = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.5, 4.5)), bossShadowAuraMat);
    bossShadowAura.rotation.x = -Math.PI / 2;
    bossShadowAura.position.y = -0.004;

    const bossShadowRimMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const bossShadowRim = new THREE.Mesh(trackGeo(new THREE.RingGeometry(1.18, 1.48, 36)), bossShadowRimMat);
    bossShadowRim.rotation.x = -Math.PI / 2;
    bossShadowRim.position.y = 0.004;

    bossShadowGroup.add(bossShadowAura, bossShadowCore, bossShadowRim);
    scene.add(bossShadowGroup);
    let shadowThreatLevel = 0;
    let usingSharpShadowTex = false;

    const sisterModel = buildDimaSister();
    sisterModel.visible = false;
    scene.add(sisterModel);

    const iliheModel = buildIliheFatLuffy();
    iliheModel.root.position.set(-3.2, 0, 5.5);
    iliheModel.root.visible = minion === 'ILIHE';
    scene.add(iliheModel.root);

    const maksModel = buildMaksTurkey();
    maksModel.root.position.set(-3.2, 0, 5.5);
    maksModel.root.visible = minion === 'MAKS';
    scene.add(maksModel.root);

    // Clean Ordinary Cucumber texture without scars, cuts, or stitches
    const makeCleanCucumberTexture = (targetDisposables: Array<{ dispose: () => void }> = disposables) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d')!;

      // Fresh, vibrant botanical cucumber green gradient (crisp, clean, appetizing green)
      const grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, '#1f8534');
      grad.addColorStop(0.25, '#34c759');
      grad.addColorStop(0.5, '#4ade80');
      grad.addColorStop(0.75, '#34c759');
      grad.addColorStop(1, '#1f8534');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Clean vertical cucumber ribs
      for (let x = 0; x < 512; x += 32) {
        ctx.fillStyle = 'rgba(21, 108, 48, 0.22)';
        ctx.fillRect(x, 0, 6, 512);
        ctx.fillStyle = 'rgba(187, 247, 208, 0.28)';
        ctx.fillRect(x + 10, 0, 4, 512);
      }

      // Soft natural cucumber skin speckles & tiny tender bumps (NO scars, NO stitches, NO cuts, NO blood!)
      for (let i = 0; i < 180; i++) {
        const bx = (i * 73) % 512;
        const by = (i * 137) % 512;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(21, 108, 48, 0.45)' : 'rgba(187, 247, 208, 0.55)';
        ctx.beginPath();
        ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      targetDisposables.push(tex);
      return tex;
    };

    // 3D Articulated Fighter Avatar (Clean Ordinary Cucumber or Human/Skinned Hero)
    const buildFighterAvatar = (
      opts: {
        fighter: FighterId;
        isKingTiger: boolean;
        isPickle: boolean;
        isGilbert: boolean;
        isCleanCucumber: boolean;
      },
      targetDisposables: Array<{ dispose: () => void }> = disposables
    ) => {
      const tGeo = <T extends THREE.BufferGeometry>(g: T): T => {
        targetDisposables.push(g);
        return g;
      };
      const tMat = <T extends THREE.Material>(m: T): T => {
        targetDisposables.push(m);
        return m;
      };
      const root = new THREE.Group();

      if (opts.isCleanCucumber) {
        // Обыкновенный Огурец (Clean Living Cucumber without scars, without jar, without dark cloak)
        const cleanCucumberTex = makeCleanCucumberTexture(targetDisposables);
        const cleanCucumberMat = tMat(
          new THREE.MeshStandardMaterial({
            map: cleanCucumberTex,
            color: 0x4ade80,
            emissive: 0x0f5132,
            emissiveIntensity: 0.32,
            roughness: 0.52,
            metalness: 0.04,
          })
        );
        const cleanStemMat = tMat(
          new THREE.MeshStandardMaterial({
            color: 0x166534,
            roughness: 0.68,
          })
        );
        const cleanEyeMat = tMat(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
        const cleanPupilGlintMat = tMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const metalMat = tMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.92 }));
        const bootMat = tMat(new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.6 }));

        // Cucumber Legs with small dark green boots
        const makeLeg = (xOff: number) => {
          const legGroup = new THREE.Group();
          legGroup.position.set(xOff, 0.95, 0);
          const thigh = new THREE.Mesh(tGeo(new THREE.CapsuleGeometry(0.12, 0.42, 6, 8)), cleanCucumberMat);
          thigh.position.y = -0.21;
          thigh.castShadow = true;
          const knee = new THREE.Group();
          knee.position.set(0, -0.42, 0);
          const shin = new THREE.Mesh(tGeo(new THREE.CapsuleGeometry(0.11, 0.38, 6, 8)), cleanCucumberMat);
          shin.position.y = -0.19;
          const boot = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.24, 0.14, 0.36)), bootMat);
          boot.position.set(0, -0.36, 0.05);
          knee.add(shin, boot);
          legGroup.add(thigh, knee);
          root.add(legGroup);
          return { legGroup, knee };
        };
        const leftLeg = makeLeg(-0.22);
        const rightLeg = makeLeg(0.22);

        const upperBodyGroup = new THREE.Group();
        root.add(upperBodyGroup);

        // 1. Clean Cucumber Capsule Body (NO scars, NO stitches, NO cuts, NO blood, NO jar!)
        const cucumberBody = new THREE.Mesh(
          tGeo(new THREE.CapsuleGeometry(0.56, 1.48, 12, 22)),
          cleanCucumberMat
        );
        cucumberBody.position.set(0, 1.95, 0);
        cucumberBody.scale.set(1.02, 1.0, 0.98);
        cucumberBody.castShadow = true;
        upperBodyGroup.add(cucumberBody);

        // Natural soft green cucumber bumps/warts
        for (const [wx, wy, wz] of [
          [-0.45, 1.68, 0.26],
          [0.44, 2.12, 0.22],
          [-0.4, 2.32, -0.22],
          [0.42, 1.54, -0.22],
          [0.16, 1.32, 0.45],
          [-0.2, 2.82, 0.36],
          [-0.52, 1.94, 0.02],
          [0.52, 1.96, 0.02],
        ] as [number, number, number][]) {
          const wart = new THREE.Mesh(tGeo(new THREE.SphereGeometry(0.068, 8, 8)), cleanStemMat);
          wart.position.set(wx, wy, wz);
          upperBodyGroup.add(wart);
        }

        // Cute fresh cucumber stem on top with small green leaf (NO pot, NO iron circlet)
        const stemGroup = new THREE.Group();
        stemGroup.position.set(0, 3.12, 0);
        const stem = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.075, 0.11, 0.36, 8)), cleanStemMat);
        stem.position.set(0, 0.18, -0.02);
        stem.rotation.z = -0.22;
        const leaf = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.18, 0.04, 0.24)), cleanStemMat);
        leaf.position.set(-0.12, 0.24, 0);
        leaf.rotation.set(0.2, 0.4, 0.3);
        stemGroup.add(stem, leaf);
        upperBodyGroup.add(stemGroup);

        // Clean, heroic cucumber face (Determined eyes & mouth, NO scars!)
        for (const side of [-1, 1]) {
          const brow = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.22, 0.055, 0.08)), cleanStemMat);
          brow.position.set(side * 0.17, 2.68, 0.52);
          brow.rotation.z = -side * 0.25;
          upperBodyGroup.add(brow);

          const eye = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.12, 0.14, 0.06)), cleanEyeMat);
          eye.position.set(side * 0.17, 2.52, 0.52);
          const glint = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.04, 0.04, 0.04)), cleanPupilGlintMat);
          glint.position.set(side * 0.17 + 0.025, 2.55, 0.54);
          upperBodyGroup.add(eye, glint);
        }
        const mouth = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.2, 0.035, 0.06)), cleanStemMat);
        mouth.position.set(0, 2.32, 0.53);
        upperBodyGroup.add(mouth);

        // Articulated Cucumber Arms
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.52, 1.82, 0);
        const lMesh = new THREE.Mesh(tGeo(new THREE.CapsuleGeometry(0.12, 0.56, 6, 10)), cleanCucumberMat);
        lMesh.position.set(0, -0.24, 0.04);
        lMesh.rotation.x = -0.3;
        leftArm.add(lMesh);
        upperBodyGroup.add(leftArm);

        const rightArm = new THREE.Group();
        rightArm.position.set(0.52, 1.82, 0);
        const rMesh = new THREE.Mesh(tGeo(new THREE.CapsuleGeometry(0.12, 0.56, 6, 10)), cleanCucumberMat);
        rMesh.position.set(0, -0.24, 0.08);
        rMesh.rotation.x = -0.55;
        rightArm.add(rMesh);

        // Weapon Group: Clean steel skewer / foil (matches duel weapons with Wild Cucumber!)
        const weaponGroup = new THREE.Group();
        weaponGroup.position.set(0, -0.42, 0.32);
        const skewerBlade = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.024, 0.036, 1.4, 8)), metalMat);
        skewerBlade.position.set(0, 0.05, 0.48);
        skewerBlade.rotation.x = Math.PI / 2;
        const skewerTip = new THREE.Mesh(tGeo(new THREE.ConeGeometry(0.04, 0.22, 8)), metalMat);
        skewerTip.position.set(0, 0.05, 1.25);
        skewerTip.rotation.x = -Math.PI / 2;
        const skewerGuard = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10)), metalMat);
        skewerGuard.position.set(0, 0.05, -0.18);
        skewerGuard.rotation.x = Math.PI / 2;
        weaponGroup.add(skewerBlade, skewerTip, skewerGuard);

        rightArm.add(weaponGroup);
        upperBodyGroup.add(rightArm);

        root.visible = false;
        return { root, upperBodyGroup, leftLeg, rightLeg, leftArm, rightArm, weaponGroup };
      }

      const torsoColor =
        opts.fighter === 'LUPIK'
          ? opts.isGilbert
            ? 0x4b5320
            : 0x1d4ed8
          : opts.fighter === 'EGOR'
          ? opts.isPickle
            ? 0x2e7d32
            : 0xb45309
          : opts.isKingTiger
          ? 0x6b6852
          : 0x334155;
      const pantsColor = opts.isKingTiger ? 0x292524 : 0x0f172a;
      const bodyMat = tMat(new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.72 }));
      const pantsMat = tMat(new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 }));
      const heroSkinMat = tMat(
        new THREE.MeshStandardMaterial({ color: opts.isPickle ? 0x4ade80 : 0xf2c9ac, roughness: 0.72 })
      );
      const metalMat = tMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.85 }));
      const darkMat = tMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }));

      const makeLeg = (xOff: number) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(xOff, 0.88, 0);
        const thigh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.24, 0.46, 0.24)), pantsMat);
        thigh.position.y = -0.22;
        thigh.castShadow = true;
        const knee = new THREE.Group();
        knee.position.set(0, -0.44, 0);
        const shin = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.22, 0.44, 0.22)), pantsMat);
        shin.position.y = -0.22;
        const boot = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.25, 0.14, 0.36)), darkMat);
        boot.position.set(0, -0.38, 0.05);
        knee.add(shin, boot);
        legGroup.add(thigh, knee);
        root.add(legGroup);
        return { legGroup, knee };
      };
      const leftLeg = makeLeg(-0.18);
      const rightLeg = makeLeg(0.18);

      const upperBodyGroup = new THREE.Group();
      root.add(upperBodyGroup);

      const torso = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.68, 0.84, 0.4)), bodyMat);
      torso.position.set(0, 1.32, 0);
      torso.castShadow = true;
      upperBodyGroup.add(torso);

      const head = new THREE.Mesh(tGeo(new THREE.SphereGeometry(0.24, 12, 12)), heroSkinMat);
      head.position.set(0, 1.96, 0);
      head.castShadow = true;
      upperBodyGroup.add(head);

      // Fighter headgear / silhouette details
      if (opts.fighter === 'LUPIK') {
        if (opts.isGilbert) {
          const visorMat = tMat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          const maskMesh = new THREE.Mesh(tGeo(new THREE.SphereGeometry(0.25, 12, 12)), darkMat);
          maskMesh.position.set(0, 1.96, 0.01);
          const visor = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.28, 0.07, 0.08)), visorMat);
          visor.position.set(0, 1.99, 0.22);
          const helmet = new THREE.Mesh(
            tGeo(new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
            tMat(new THREE.MeshStandardMaterial({ color: 0x7d7440, roughness: 0.65 }))
          );
          helmet.position.set(0, 2.02, 0);
          upperBodyGroup.add(maskMesh, visor, helmet);
        } else {
          const hood = new THREE.Mesh(
            tGeo(new THREE.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65)),
            bodyMat
          );
          hood.position.set(0, 1.98, -0.04);
          hood.rotation.x = -0.25;
          upperBodyGroup.add(hood);
        }
      } else if (opts.fighter === 'ARTEM') {
        const helmet = new THREE.Mesh(
          tGeo(new THREE.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
          opts.isKingTiger
            ? tMat(new THREE.MeshStandardMaterial({ color: 0x8b8568, roughness: 0.55 }))
            : darkMat
        );
        helmet.position.set(0, 2.02, 0);
        upperBodyGroup.add(helmet);
        if (opts.isKingTiger) {
          const armorMat = tMat(new THREE.MeshStandardMaterial({ color: 0x8b8568, roughness: 0.55 }));
          const turretPlate = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.84, 0.34, 0.54)), armorMat);
          turretPlate.position.set(0, 1.38, 0);
          upperBodyGroup.add(turretPlate);
        }
      } else {
        const cap = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.24, 0.25, 0.14, 12)), darkMat);
        cap.position.set(0, 2.15, 0);
        upperBodyGroup.add(cap);
        if (opts.isPickle) {
          const scarf = new THREE.Mesh(
            tGeo(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 12)),
            tMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 }))
          );
          scarf.position.set(0, 1.68, 0);
          upperBodyGroup.add(scarf);
        }
      }

      const eyeMat = tMat(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      if (!(opts.fighter === 'LUPIK' && opts.isGilbert)) {
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.05, 0.04, 0.04)), eyeMat);
          eye.position.set(side * 0.09, 1.98, 0.22);
          upperBodyGroup.add(eye);
        }
      }

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.44, 1.66, 0);
      const lMesh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.19, 0.62, 0.2)), bodyMat);
      lMesh.position.set(0, -0.26, 0.06);
      lMesh.rotation.x = -0.35;
      leftArm.add(lMesh);
      upperBodyGroup.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.44, 1.66, 0);
      const rMesh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.19, 0.62, 0.2)), bodyMat);
      rMesh.position.set(0, -0.26, 0.12);
      rMesh.rotation.x = -0.55;
      rightArm.add(rMesh);

      const weaponGroup = new THREE.Group();
      weaponGroup.position.set(0, -0.46, 0.34);
      if (opts.fighter === 'LUPIK') {
        const barrel = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.04, 0.045, 0.95, 8)), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 0.32);
        const stock = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.1, 0.14, 0.45)), darkMat);
        stock.position.set(0, 0, 0.02);
        weaponGroup.add(barrel, stock);
      } else if (opts.fighter === 'EGOR') {
        const skewer = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 6)), metalMat);
        skewer.rotation.x = Math.PI / 2;
        skewer.position.set(0, 0.05, 0.45);
        const meat = new THREE.Mesh(
          tGeo(new THREE.BoxGeometry(0.14, 0.14, 0.32)),
          tMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }))
        );
        meat.position.set(0, 0.05, 0.52);
        weaponGroup.add(skewer, meat);
      } else {
        const cannon = new THREE.Mesh(tGeo(new THREE.CylinderGeometry(0.11, 0.13, 1.1, 10)), metalMat);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(0, 0.08, 0.42);
        weaponGroup.add(cannon);
      }
      rightArm.add(weaponGroup);
      upperBodyGroup.add(rightArm);

      root.visible = false;
      return { root, upperBodyGroup, leftLeg, rightLeg, leftArm, rightArm, weaponGroup };
    };
    const playerAvatar = buildFighterAvatar(
      {
        fighter,
        isKingTiger,
        isPickle,
        isGilbert,
        isCleanCucumber: isWildCucumber,
      },
      disposables
    );
    scene.add(playerAvatar.root);

    type BuiltFighterAvatar = ReturnType<typeof buildFighterAvatar>;
    interface RemoteAvatarEntry {
      id: string;
      avatar: BuiltFighterAvatar;
      localDisposables: Array<{ dispose: () => void }>;
      skinKey: string;
      labelKey: string;
      nameSprite: THREE.Sprite;
      nameCanvas: HTMLCanvasElement;
      nameTexture: THREE.CanvasTexture;
      targetX: number;
      targetY: number;
      targetZ: number;
      targetYaw: number;
      attackAnimTimer: number;
      moving: boolean;
      dashing: boolean;
    }
    const remoteAvatars = new Map<string, RemoteAvatarEntry>();

    const drawNameplateCanvas = (
      canvas: HTMLCanvasElement,
      nickname: string,
      hp: number,
      maxHp: number,
      rFighter: FighterId
    ) => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const accent =
        rFighter === 'LUPIK' ? '#38bdf8' : rFighter === 'EGOR' ? '#fbbf24' : '#34d399';
      ctx.fillStyle = 'rgba(11, 19, 32, 0.86)';
      ctx.beginPath();
      ctx.roundRect(12, 8, canvas.width - 24, canvas.height - 16, 12);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = '800 22px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      const title = `${nickname.slice(0, 14)} · ${Math.max(0, Math.round(hp))} HP`;
      ctx.fillText(title, canvas.width / 2, 37);

      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      const barX = 28;
      const barY = 48;
      const barW = canvas.width - 56;
      const barH = 12;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 6);
      ctx.fill();

      ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
      if (ratio > 0) {
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(8, barW * ratio), barH, 6);
        ctx.fill();
      }
    };

    const createRemoteAvatarEntry = (remote: NetRemotePlayerState): RemoteAvatarEntry => {
      const localDisposables: Array<{ dispose: () => void }> = [];
      const skinKey = `${remote.fighter}:${remote.isKingTiger ? 1 : 0}:${remote.isPickle ? 1 : 0}:${remote.isGilbert ? 1 : 0}`;
      const avatar = buildFighterAvatar(
        {
          fighter: remote.fighter,
          isKingTiger: remote.isKingTiger,
          isPickle: remote.isPickle,
          isGilbert: remote.isGilbert,
          isCleanCucumber: false,
        },
        localDisposables
      );
      const nameCanvas = document.createElement('canvas');
      nameCanvas.width = 320;
      nameCanvas.height = 76;
      drawNameplateCanvas(nameCanvas, remote.nickname, remote.hp, remote.maxHp, remote.fighter);
      const nameTexture = new THREE.CanvasTexture(nameCanvas);
      nameTexture.colorSpace = THREE.SRGBColorSpace;
      const spriteMat = new THREE.SpriteMaterial({
        map: nameTexture,
        transparent: true,
        depthWrite: false,
      });
      localDisposables.push(nameTexture, spriteMat);
      const nameSprite = new THREE.Sprite(spriteMat);
      nameSprite.scale.set(2.15, 0.52, 1);
      nameSprite.position.set(0, 2.75, 0);
      avatar.root.add(nameSprite);
      avatar.root.position.set(remote.x, remote.y, remote.z);
      avatar.root.rotation.set(0, remote.yaw, 0);
      avatar.root.visible = true;
      scene.add(avatar.root);

      return {
        id: remote.id,
        avatar,
        localDisposables,
        skinKey,
        labelKey: `${remote.nickname}:${remote.hp}:${remote.maxHp}:${remote.fighter}`,
        nameSprite,
        nameCanvas,
        nameTexture,
        targetX: remote.x,
        targetY: remote.y,
        targetZ: remote.z,
        targetYaw: remote.yaw,
        attackAnimTimer: 0,
        moving: remote.moving,
        dashing: remote.dashing,
      };
    };

    const disposeRemoteEntry = (entry: RemoteAvatarEntry) => {
      scene.remove(entry.avatar.root);
      for (const d of entry.localDisposables) {
        d.dispose();
      }
    };

    // Phase 3 Spectral Dog Spirit: Two Huge Floating Ghostly Paws ("Удар лапой")
    const buildGhostDogPaw = (side: -1 | 1) => {
      const paw = new THREE.Group();
      const ghostMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x7e22ce,
          emissiveIntensity: 1.4,
          transparent: true,
          opacity: 0.68,
          roughness: 0.25,
          depthWrite: false,
        })
      );
      const ghostCoreMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      const clawMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xf5d0fe,
          emissive: 0xc084fc,
          emissiveIntensity: 1.9,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      );

      // Spectral forearm/wrist fading upward like mist
      const wrist = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.42, 1.15, 10)), ghostMat);
      wrist.position.set(0, 0.62, -0.14);
      wrist.rotation.x = 0.28;
      paw.add(wrist);

      // Massive spectral palm
      const palm = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.56, 14, 12)), ghostMat);
      palm.scale.set(1.25, 0.62, 1.38);
      palm.position.set(0, 0.08, 0.12);
      paw.add(palm);

      const corePad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.28, 10, 10)), ghostCoreMat);
      corePad.scale.set(1.2, 0.55, 1.1);
      corePad.position.set(0, -0.14, 0.08);
      paw.add(corePad);

      // 4 huge curved ghostly digits + glowing claws + toe pads
      for (let i = 0; i < 4; i++) {
        const tx = (i - 1.5) * 0.28 * side;
        const tz = 0.62 - Math.abs(i - 1.5) * 0.08;
        const toe = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 0.28, 6, 8)), ghostMat);
        toe.position.set(tx, -0.02, tz);
        toe.rotation.x = Math.PI * 0.45;
        const toePad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 8, 8)), ghostCoreMat);
        toePad.position.set(tx, -0.12, tz);
        const claw = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.075, 0.44, 6)), clawMat);
        claw.position.set(tx, -0.14, tz + 0.34);
        claw.rotation.x = Math.PI * 0.68;
        paw.add(toe, toePad, claw);
      }

      // Ethereal orbiting aura halo
      const halo = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.68, 0.035, 8, 24)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.55 }))
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.16, 0.12);
      paw.add(halo);

      return paw;
    };

    const ghostPawsGroup = new THREE.Group();
    const leftGhostPaw = buildGhostDogPaw(-1);
    const rightGhostPaw = buildGhostDogPaw(1);
    ghostPawsGroup.add(leftGhostPaw, rightGhostPaw);
    ghostPawsGroup.visible = false;
    scene.add(ghostPawsGroup);

    const pawSlamRingGroup = new THREE.Group();
    const pawSlamOuterMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    const pawSlamFillMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0x7e22ce, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
    );
    const pawSlamOuter = new THREE.Mesh(trackGeo(new THREE.RingGeometry(2.9, 3.55, 42)), pawSlamOuterMat);
    pawSlamOuter.rotation.x = -Math.PI / 2;
    const pawSlamFill = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(3.45, 42)), pawSlamFillMat);
    pawSlamFill.rotation.x = -Math.PI / 2;
    pawSlamFill.position.y = -0.004;
    const pawSlamInner = new THREE.Mesh(trackGeo(new THREE.RingGeometry(0.45, 1.1, 32)), pawSlamOuterMat);
    pawSlamInner.rotation.x = -Math.PI / 2;
    pawSlamInner.position.y = 0.004;
    pawSlamRingGroup.add(pawSlamFill, pawSlamOuter, pawSlamInner);
    pawSlamRingGroup.position.y = 0.055;
    pawSlamRingGroup.visible = false;
    scene.add(pawSlamRingGroup);

    // 23-Second Phase 3 Dimension-Shift Cutscene VFX (3D Shattered Glass Shards, Center Lightning & Clash Slash Arcs)
    const glassShardGroup = new THREE.Group();
    glassShardGroup.position.set(0, 0, -2.0);
    glassShardGroup.visible = false;
    camera.add(glassShardGroup);

    const shardPurpleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe9d5ff,
        emissive: 0x9333ea,
        emissiveIntensity: 1.5,
        metalness: 0.92,
        roughness: 0.08,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    const shardMonoMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xcbd5e1,
        emissiveIntensity: 1.2,
        metalness: 0.95,
        roughness: 0.06,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    const shardGeo = trackGeo(new THREE.ConeGeometry(0.22, 0.72, 3));
    interface GlassShardItem {
      mesh: THREE.Mesh;
      angle: number;
      baseDist: number;
      speed: number;
      spinX: number;
      spinY: number;
      spinZ: number;
      scale: number;
    }
    const glassShards: GlassShardItem[] = [];
    for (let i = 0; i < 34; i++) {
      const mesh = new THREE.Mesh(shardGeo, i % 2 === 0 ? shardPurpleMat : shardMonoMat);
      mesh.visible = false;
      glassShardGroup.add(mesh);
      glassShards.push({
        mesh,
        angle: (i / 34) * Math.PI * 2 + (i % 3) * 0.14,
        baseDist: 0.18 + (i % 5) * 0.16,
        speed: 1.8 + (i % 6) * 0.45,
        spinX: (i % 2 === 0 ? 1 : -1) * (4.5 + (i % 4) * 1.4),
        spinY: (i % 3 === 0 ? 1 : -1) * (5.2 + (i % 5) * 1.2),
        spinZ: (i % 2 === 0 ? -1 : 1) * (3.8 + (i % 3) * 1.6),
        scale: 0.72 + (i % 4) * 0.34,
      });
    }
    let glassBurstTimer = 0;
    let glassBurstMax = 0.95;

    const triggerGlassBurst = (heavy: boolean, monoDominant: boolean) => {
      glassShardGroup.visible = true;
      glassBurstMax = heavy ? 1.45 : 0.92;
      glassBurstTimer = glassBurstMax;
      for (let i = 0; i < glassShards.length; i++) {
        const s = glassShards[i];
        s.mesh.visible = true;
        s.mesh.material = monoDominant ? (i % 3 === 0 ? shardPurpleMat : shardMonoMat) : i % 3 === 0 ? shardMonoMat : shardPurpleMat;
        const r = s.baseDist * (heavy ? 0.55 : 0.85);
        s.mesh.position.set(Math.cos(s.angle) * r * 1.45, Math.sin(s.angle) * r * 0.88, ((i % 5) - 2) * 0.1);
        s.mesh.rotation.set(s.angle * 0.5, s.angle, s.angle + Math.PI * 0.5);
        s.mesh.scale.setScalar(s.scale * (heavy ? 1.38 : 1.0));
      }
    };

    // Center Duel Purple Lightning & Slash Arcs for 23s Cutscene
    const cutsceneVfxGroup = new THREE.Group();
    cutsceneVfxGroup.visible = false;
    scene.add(cutsceneVfxGroup);

    const cutBoltMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf3e8ff }));
    const cutBoltGlowMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.65 }));
    const cutsceneBolts: THREE.Group[] = [];
    for (let b = 0; b < 4; b++) {
      const bg = new THREE.Group();
      let cx = (b - 1.5) * 0.9;
      let cy = 6.2;
      for (let seg = 0; seg < 6; seg++) {
        const nx = cx + (seg % 2 === 0 ? 0.55 : -0.62);
        const ny = cy - 0.95;
        const sl = Math.hypot(nx - cx, ny - cy);
        const inner = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.045, sl, 5)), cutBoltMat);
        const outer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, sl, 5)), cutBoltGlowMat);
        inner.position.set((cx + nx) * 0.5, (cy + ny) * 0.5, 0);
        outer.position.copy(inner.position);
        const rz = Math.atan2(nx - cx, cy - ny);
        inner.rotation.z = rz;
        outer.rotation.z = rz;
        bg.add(outer, inner);
        cx = nx;
        cy = ny;
      }
      cutsceneVfxGroup.add(bg);
      cutsceneBolts.push(bg);
    }

    const cutsceneSlashArcs: THREE.Mesh[] = [];
    const slashColors = [0xc084fc, 0xf8fafc, 0xf43f5e, 0xfbbf24];
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(1.75 + i * 0.25, 0.065, 8, 28, Math.PI * 0.85)),
        trackMat(new THREE.MeshBasicMaterial({ color: slashColors[i], transparent: true, opacity: 0.9, side: THREE.DoubleSide }))
      );
      arc.position.set(0, 1.75, 0.3 + i * 0.06);
      arc.visible = false;
      cutsceneVfxGroup.add(arc);
      cutsceneSlashArcs.push(arc);
    }

    if (initSetup.bossPhase === 'WILD_PHASE3' || initSetup.bossPhase === 'WILD_PHASE3_INTRO') {
      playerPos.set(-4.3, eyeHeight, 0);
      bossModel.root.position.set(4.3, 0, 0);
      bossModel.root.rotation.set(0, -Math.PI / 2 + 0.34, 0);
      playerAvatar.root.position.set(-4.3, 0, 0);
      playerAvatar.root.rotation.set(0, Math.PI / 2 - 0.18, 0);
      playerAvatar.root.visible = true;
      viewModelGroup.visible = false;
      cutsceneVfxGroup.visible = initSetup.bossPhase === 'WILD_PHASE3_INTRO';
      ghostPawsGroup.visible = initSetup.bossPhase === 'WILD_PHASE3';
      if (initSetup.bossPhase === 'WILD_PHASE3_INTRO') {
        iliheModel.root.visible = false;
        maksModel.root.visible = false;
      }
      for (const obj of wildFrontOccludingObjs) obj.visible = false;
    }

    // Boss Giant Jump Landing Warning Ring
    const bossSlamRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.4, 4.4, 36)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0, side: THREE.DoubleSide }))
    );
    bossSlamRing.rotation.x = -Math.PI / 2;
    bossSlamRing.position.y = 0.04;
    scene.add(bossSlamRing);

    // Sister Sonic Wave Warning Ring & Expanding Shockwave Ring
    const sonicWarnRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(13.8, 14.5, 48)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, side: THREE.DoubleSide }))
    );
    sonicWarnRing.rotation.x = -Math.PI / 2;
    sonicWarnRing.position.y = 0.04;
    scene.add(sonicWarnRing);

    const sonicWaveRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1, 0.16, 10, 42)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 }))
    );
    sonicWaveRing.rotation.x = Math.PI / 2;
    sonicWaveRing.position.y = 1.1;
    sonicWaveRing.visible = false;
    scene.add(sonicWaveRing);

    // Hardcore Phase 3 Ability 3: Arena-wide Spinning Mouse Wire Sweep (3 full rotations, 20 DMG, 15s CD)
    const wireSweepGroup = new THREE.Group();
    const sweepCableLen = 28;
    const sweepCableMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xdc2626,
        emissiveIntensity: 1.5,
        roughness: 0.25,
      })
    );
    const sweepCable = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.075, 0.075, sweepCableLen, 10)),
      sweepCableMat
    );
    sweepCable.rotation.z = Math.PI / 2;
    sweepCable.position.set(sweepCableLen * 0.5, 0.55, 0);
    wireSweepGroup.add(sweepCable);

    const sweepCoreWire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.032, 0.032, sweepCableLen, 8)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }))
    );
    sweepCoreWire.rotation.z = Math.PI / 2;
    sweepCoreWire.position.set(sweepCableLen * 0.5, 0.55, 0);
    wireSweepGroup.add(sweepCoreWire);

    for (const mx of [7, 14, 21, 27.6]) {
      const mouseNode = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.45, 0.22, 0.32)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0xef4444, emissiveIntensity: 0.6 }))
      );
      mouseNode.position.set(mx, 0.55, 0);
      wireSweepGroup.add(mouseNode);
    }

    const sweepFloorShadow = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(sweepCableLen, 0.55)),
      trackMat(
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      )
    );
    sweepFloorShadow.rotation.x = -Math.PI / 2;
    sweepFloorShadow.position.set(sweepCableLen * 0.5, 0.04, 0);
    wireSweepGroup.add(sweepFloorShadow);

    wireSweepGroup.visible = false;
    scene.add(wireSweepGroup);

    // Wild Cucumber Phase 1 Skewer Lunge Telegraph Aim Lane
    const lungeAimGroup = new THREE.Group();
    const lungeAimFloorMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
    );
    const lungeAimCoreMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    const lungeAimBand = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.15, 14)), lungeAimFloorMat);
    lungeAimBand.rotation.x = -Math.PI / 2;
    lungeAimBand.position.set(0, 0.045, 7);
    const lungeAimLine = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.18, 14)), lungeAimCoreMat);
    lungeAimLine.rotation.x = -Math.PI / 2;
    lungeAimLine.position.set(0, 0.055, 7);
    lungeAimGroup.add(lungeAimBand, lungeAimLine);
    lungeAimGroup.visible = false;
    scene.add(lungeAimGroup);

    // Wild Cucumber Phase 2 Ability 1: Overhead Slam Red Glowing Telegraph Circle
    const wildSlamRingGroup = new THREE.Group();
    const wildSlamOuterMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    const wildSlamFillMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
    );
    const wildSlamOuter = new THREE.Mesh(trackGeo(new THREE.RingGeometry(2.85, 3.4, 42)), wildSlamOuterMat);
    wildSlamOuter.rotation.x = -Math.PI / 2;
    const wildSlamFill = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(3.35, 42)), wildSlamFillMat);
    wildSlamFill.rotation.x = -Math.PI / 2;
    wildSlamFill.position.y = -0.004;
    const wildSlamInner = new THREE.Mesh(trackGeo(new THREE.RingGeometry(0.45, 1.05, 32)), wildSlamOuterMat);
    wildSlamInner.rotation.x = -Math.PI / 2;
    wildSlamInner.position.y = 0.004;
    wildSlamRingGroup.add(wildSlamFill, wildSlamOuter, wildSlamInner);
    wildSlamRingGroup.position.y = 0.05;
    wildSlamRingGroup.visible = false;
    scene.add(wildSlamRingGroup);

    // Wild Cucumber Phase 2 Ability 2: Thrown Pickle Jar + Dynamic Iron Chains
    const thrownJarGroup = new THREE.Group();
    const tJarGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcffafe,
        transparent: true,
        opacity: 0.42,
        roughness: 0.1,
        metalness: 0.25,
        depthWrite: false,
      })
    );
    const tJarBrineMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x16a34a,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.36,
        roughness: 0.2,
        depthWrite: false,
      })
    );
    const tJarLidMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.35, metalness: 0.8 }));
    const tJarPickleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x164a1c, roughness: 0.7 }));
    const tJarIronMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.9 }));

    thrownJarGroup.add(
      new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16)), tJarBrineMat),
      new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 1.32, 18)), tJarGlassMat)
    );
    const tJarLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.49, 0.49, 0.18, 18)), tJarLidMat);
    tJarLid.position.y = 0.72;
    thrownJarGroup.add(tJarLid);
    for (const hy of [-0.36, 0.36]) {
      const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.475, 0.045, 8, 20)), tJarIronMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = hy;
      thrownJarGroup.add(band);
    }
    for (const [px, py, pz, rx] of [
      [-0.14, -0.08, 0.12, 0.22],
      [0.16, 0.06, -0.1, -0.2],
      [0.0, 0.16, 0.14, 0.1],
    ] as [number, number, number, number][]) {
      const pkl = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 0.35, 6, 8)), tJarPickleMat);
      pkl.position.set(px, py, pz);
      pkl.rotation.x = rx;
      thrownJarGroup.add(pkl);
    }
    const jarAuraRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.66, 0.035, 8, 22)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.8 }))
    );
    thrownJarGroup.add(jarAuraRing);
    thrownJarGroup.visible = false;
    scene.add(thrownJarGroup);

    const jarChainLinkGeo = trackGeo(new THREE.TorusGeometry(0.085, 0.028, 6, 12));
    const jarChainLinks: THREE.Mesh[] = [];
    for (let i = 0; i < 20; i++) {
      const link = new THREE.Mesh(jarChainLinkGeo, tJarIronMat);
      link.visible = false;
      scene.add(link);
      jarChainLinks.push(link);
    }
    const _chainStart = new THREE.Vector3();
    const _chainEnd = new THREE.Vector3();
    const _chainTan = new THREE.Vector3();
    const updateJarChain = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag = 0.25) => {
      _chainStart.set(ax, ay, az);
      _chainEnd.set(bx, by, bz);
      _chainTan.subVectors(_chainEnd, _chainStart);
      if (_chainTan.lengthSq() < 0.0001) _chainTan.set(0, 0, 1);
      _chainTan.normalize();
      const n = jarChainLinks.length;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const link = jarChainLinks[i];
        link.visible = true;
        link.position.lerpVectors(_chainStart, _chainEnd, t);
        link.position.y -= Math.sin(t * Math.PI) * sag;
        link.quaternion.setFromUnitVectors(_up, _chainTan);
        if (i % 2 === 1) link.rotateY(Math.PI / 2);
      }
    };
    const hideJarAndChain = () => {
      thrownJarGroup.visible = false;
      for (let i = 0; i < jarChainLinks.length; i++) {
        jarChainLinks[i].visible = false;
      }
      if (bossModel.backJarGroup) {
        bossModel.backJarGroup.visible = true;
      }
    };

    // 3D Snow / Stormy Rain Particles
    const snowCount = isWildCucumber ? 360 : 260;
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 44;
      snowPositions[i * 3 + 1] = Math.random() * 18;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const snowPointsGeo = trackGeo(new THREE.BufferGeometry());
    snowPointsGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowPoints = new THREE.Points(
      snowPointsGeo,
      trackMat(
        new THREE.PointsMaterial({
          color: isWildCucumber ? 0xc4b5fd : 0xf1f5f9,
          size: isWildCucumber ? 0.14 : 0.18,
          transparent: true,
          opacity: isWildCucumber ? 0.72 : 0.78,
        })
      )
    );
    scene.add(snowPoints);
    const wildBgDark = new THREE.Color(0x0c0616);
    const wildBgFlash = new THREE.Color(0x281244);

    // =========================================================================
    // COMBAT STATE & ABILITIES
    // =========================================================================
    const projectiles: Projectile[] = [];
    const fallingBombs: FallingBomb[] = [];
    const thrownFruits: ThrownFruit[] = [];
    const flashes: ExplosionFlash[] = [];
    const skyLasers: SkyLaser[] = [];
    const debrisList: FallingDebris[] = [];
    const bloodDrops: BloodDrop[] = [];
    const comboSparks: ComboSpark[] = [];
    const comboRings: ComboRing[] = [];
    const sparkDiamondGeo = trackGeo(new THREE.OctahedronGeometry(0.085, 0));
    const sparkStreakGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.24, 0.045));
    const comboRingGeo = trackGeo(new THREE.RingGeometry(0.75, 1.02, 28));
    const comboTierMats = [
      // Tier 0 (1-4): Ice sky-blue & crisp white
      [
        trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f2fe })),
      ],
      // Tier 1 (5-9): Fiery gold & amber
      [
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 })),
      ],
      // Tier 2 (10-14): Blazing crimson & solar yellow
      [
        trackMat(new THREE.MeshBasicMaterial({ color: 0xf43f5e })),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 })),
      ],
      // Tier 3 (15+): Electric cyan, magenta & gold overdrive
      [
        trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xe879f9 })),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a })),
      ],
    ];
    const bloodGeo = trackGeo(new THREE.SphereGeometry(0.06, 6, 6));
    const bloodMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        emissive: 0x450a0a,
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.1,
      })
    );

    const spawnComboSparks = (comboCount: number) => {
      const tier = comboCount >= 15 ? 3 : comboCount >= 10 ? 2 : comboCount >= 5 ? 1 : 0;
      const mats = comboTierMats[tier];
      const bossSparkCount = Math.min(28, 7 + Math.floor(comboCount * 1.35));
      const playerSparkCount = Math.min(16, 4 + Math.floor(comboCount * 0.8));
      const scaleMult = 0.9 + Math.min(0.75, comboCount * 0.04);

      const spawnOrbitBatch = (
        orbitCenter: 'BOSS' | 'PLAYER',
        count: number,
        minR: number,
        maxR: number,
        minY: number,
        maxY: number
      ) => {
        for (let i = 0; i < count; i++) {
          const isStreak = i % 2 === 1;
          const mat = mats[i % mats.length];
          const mesh = new THREE.Mesh(isStreak ? sparkStreakGeo : sparkDiamondGeo, mat);
          const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.6;
          const radius = minR + Math.random() * (maxR - minR);
          const y = minY + Math.random() * (maxY - minY);
          const cx = orbitCenter === 'BOSS' ? bossModel.root.position.x : playerPos.x;
          const cz = orbitCenter === 'BOSS' ? bossModel.root.position.z : playerPos.z;
          mesh.position.set(cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius);
          const baseScale = (0.75 + Math.random() * 0.65) * scaleMult;
          mesh.scale.setScalar(baseScale);
          scene.add(mesh);

          const maxLife = 0.45 + Math.random() * 0.35 + tier * 0.07;
          comboSparks.push({
            mesh,
            orbitCenter,
            angle,
            radius,
            radiusSpeed: 0.9 + Math.random() * 1.8 + tier * 0.35,
            angularSpeed: (i % 2 === 0 ? 1 : -1) * (3.6 + Math.random() * 3.8 + tier * 0.8),
            y,
            vy: 1.5 + Math.random() * 2.6 + tier * 0.45,
            life: maxLife,
            maxLife,
            baseScale,
          });
        }
      };

      // Sparks erupting around Boss Dima AND swirling around the Player Hero!
      spawnOrbitBatch('BOSS', bossSparkCount, 0.7, 1.35, 0.75, 2.7);
      spawnOrbitBatch('PLAYER', playerSparkCount, 0.85, 1.5, 0.55, 1.75);

      const ringColor =
        tier === 3 ? 0x22d3ee : tier === 2 ? 0xf43f5e : tier === 1 ? 0xfbbf24 : 0x38bdf8;

      const bossRing = new THREE.Mesh(
        comboRingGeo,
        new THREE.MeshBasicMaterial({
          color: ringColor,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      bossRing.rotation.x = -Math.PI / 2;
      bossRing.position.set(bossModel.root.position.x, 0.14, bossModel.root.position.z);
      scene.add(bossRing);
      comboRings.push({
        mesh: bossRing,
        orbitCenter: 'BOSS',
        life: 0,
        maxLife: 0.38 + tier * 0.05,
        maxScale: 1.9 + tier * 0.55,
        yOffset: 0.14,
      });

      if (comboCount >= 3) {
        const playerRing = new THREE.Mesh(
          comboRingGeo,
          new THREE.MeshBasicMaterial({
            color: tier >= 2 ? 0xfacc15 : ringColor,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
          })
        );
        playerRing.rotation.x = -Math.PI / 2;
        playerRing.position.set(playerPos.x, 0.08, playerPos.z);
        scene.add(playerRing);
        comboRings.push({
          mesh: playerRing,
          orbitCenter: 'PLAYER',
          life: 0,
          maxLife: 0.36 + tier * 0.04,
          maxScale: 1.65 + tier * 0.35,
          yOffset: 0.08,
        });
      }
    };

    const spawnBloodBurst = (count: number) => {
      if (isWildCucumber) return; // Wild Cucumber has healed scars with NO blood on his body
      const bx = bossModel.root.position.x;
      const bz = bossModel.root.position.z;
      const baseY = bossModel.upperBodyGroup.position.y + 1.45;
      for (let i = 0; i < count; i++) {
        const drop = new THREE.Mesh(bloodGeo, bloodMat);
        drop.position.set(
          bx + (Math.random() - 0.5) * 0.55,
          baseY + (Math.random() - 0.5) * 0.25,
          bz + (Math.random() - 0.5) * 0.45
        );
        scene.add(drop);
        bloodDrops.push({
          mesh: drop,
          vx: (Math.random() - 0.5) * 3.4,
          vy: 0.6 + Math.random() * 2.2,
          vz: (Math.random() - 0.5) * 3.4,
          splatted: false,
          life: 1.5,
        });
      }
    };

    let shashlikDogMesh: THREE.Group | null = null;
    let shashlikDogTimer = 0;
    let radarDogMesh: THREE.Group | null = null;

    const state = {
      playerHp: maxPlayerHp,
      playerEnergy: PLAYER_MAX_ENERGY,
      dodgeTimer: 0,
      dodgeIframeTimer: 0,
      dodgeDirX: 0,
      dodgeDirZ: -1,
      dodgeEvadeTriggered: false,
      playerJumpY: 0,
      playerVelY: 0,
      jumpClearedWireNotified: false,
      bossHp: initSetup.bossHp,
      bossPhase: initSetup.bossPhase,
      bossDmgBoost: initSetup.bossDmgBoost,
      dimaStamina: initSetup.dimaStamina,
      dimaDodgeAnim: 0,
      dimaDodgeDir: 1,
      stompAnimTimer: 0,
      stompImpactDone: false,
      primaryCd: 0,
      ability1Cd: 0,
      ultCd: 0,
      ultMaxCd: fighter === 'LUPIK' ? 14 : fighter === 'EGOR' ? EGOR_ULT_CD : 15,
      artemDamageCharge: 0,
      artemTotalDamage: 0,
      artemArmorLeft: 0,
      artemHitStreak: 0,
      artemSlowLeft: 0,
      minion1Cd: 0,
      minion2Cd: 0,
      iliheSlamState: 'IDLE' as 'IDLE' | 'CHARGING' | 'RECOVERING',
      iliheSlamTimer: 0,
      maksPeckState: 'IDLE' as 'IDLE' | 'FLYING' | 'RETURNING',
      maksPeckTimer: 0,
      maksBuffLeft: 0,
      maksRegenTickTimer: 0,
      shashlik: fighter === 'EGOR' ? 3 : 0,
      shashlikDogPhase: 'NONE' as 'NONE' | 'DASH_TO_BOSS' | 'RETURN_TO_PLAYER',
      shashlikDogBiteDmg: 0,
      rageLeft: 0,
      radarLeft: 0,
      egorRadarHitCounter: 0,
      egorPickleDropsLeft: 0,
      recoilKick: 0,
      eatAnim: 0,
      healFlashTimer: 0,
      damageFlashTimer: 0,
      commanderTimer: 0,
      // Boss Dima Abilities:
      dimaWireCd: isWildCucumber ? 3.2 : 4.5, // Ability 2: shoots mouse wires (10 DMG, 10s CD)
      dimaSisterCd: 11.5, // Ability 1: summons sister -> quarrel -> 45 DMG sonic wave (45s CD)
      dimaSisterPhase: 'NONE' as 'NONE' | 'ARGUING' | 'LEAVING',
      dimaSisterTimer: 0,
      sonicOriginX: 0,
      sonicOriginZ: -7,
      sonicWaveAnim: 0,
      dimaLaserCd: 8.5, // Sky Lasers (10 DMG each, 13s CD)
      dimaDashCd: 14.5, // Garage-Ricochet Dash (15 DMG hit, 3.8s duration, 18s CD)
      dimaDashPhase: 'NONE' as 'NONE' | 'REVUP' | 'DASHING',
      dimaDashTimer: 0,
      dimaDashVx: 0,
      dimaDashVz: 0,
      dimaDashHitCd: 0,
      dimaDashTrailTimer: 0,
      // Hardcore Phase 3 Ability 3: Arena-wide Spinning Mouse Wire (3 rotations, 20 DMG, 17s CD)
      dimaSpinWireCd: 10.5,
      dimaSpinWirePhase: 'NONE' as 'NONE' | 'WINDUP' | 'SPINNING',
      dimaSpinWireTimer: 0,
      dimaSpinWireAngle: 0,
      dimaSpinWireRemainingRot: 0,
      dimaSpinWireHitCd: 0,
      dimaAbilityGapTimer: 0, // Prevents Dima from move-stacking lasers, dash, wire, and jump
      dimaUltCd: 21, // Ult: super tall & fat jump onto player
      dimaUltPhase: 'NONE' as 'NONE' | 'GROWING' | 'JUMPING' | 'SHRINKING',
      dimaUltTimer: 0,
      dimaJumpStartX: 0,
      dimaJumpStartZ: -7,
      dimaJumpTargetX: 0,
      dimaJumpTargetZ: 0,
      dimaMeleeCd: 0,
      // Wild Cucumber Phase 1 Skewer Abilities:
      wildSkewerPhase: 'NONE' as
        | 'NONE'
        | 'SWING_WINDUP'
        | 'SWING_STRIKE'
        | 'LUNGE_STANCE'
        | 'LUNGE_DASH'
        | 'IMPALE_CUTSCENE',
      wildSkewerTimer: 0,
      wildSkewerSwingCd: 0, // 2.1s/1.7s CD after 1s windup swing
      wildSkewerLungeCd: 3.0, // 7.5s/6.2s CD after 1.5s stance lunge (30 HP + 5s IFRAME impale cutscene)
      wildSkewerHitDone: false,
      wildLungeDirX: 0,
      wildLungeDirZ: 1,
      wildSkewerTrailTimer: 0,
      wildImpaleElapsed: 0,
      wildImpaleDmgDone: false,
      wildImpaleKickDone: false,
      wildImpaleBossX: 0,
      wildImpaleBossZ: 0,
      wildImpaleStartPlayerX: 0,
      wildImpaleStartPlayerZ: 0,
      wildImpaleKickDirX: 0,
      wildImpaleKickDirZ: 1,
      // Wild Cucumber Phase 2 (6000 HP) Regen, Stun, Overhead Slam & Jar on Chains:
      wildRegenActive: isWildCucumber && initSetup.bossPhase !== 'PHASE1',
      wildRegenTimer: 2.0,
      playerStunTimer: 0,
      wildSlamPhase: 'NONE' as 'NONE' | 'JUMPING',
      wildSlamTimer: 0,
      wildSlamCd: 3.5, // 15s CD after use (1s jump, red glow, 30 HP + 2s stun)
      wildSlamStartX: 0,
      wildSlamStartZ: 0,
      wildSlamTargetX: 0,
      wildSlamTargetZ: 0,
      wildJarPhase: 'NONE' as 'NONE' | 'JAR_WINDUP' | 'JAR_FLYING' | 'JAR_PULL' | 'JAR_PUSH' | 'JAR_RETRACT',
      wildJarTimer: 0,
      wildJarCd: 6.5, // 30s CD after 1s windup (pull + 40 HP + pushback)
      wildJarPosX: 0,
      wildJarPosY: 1.6,
      wildJarPosZ: 0,
      wildJarDirX: 0,
      wildJarDirZ: 1,
      wildJarPullStartX: 0,
      wildJarPullStartZ: 0,
      wildJarPushStartX: 0,
      wildJarPushStartZ: 0,
      phase2IntroTimer: 0,
      wildPhase3IntroTimer: initSetup.bossPhase === 'WILD_PHASE3_INTRO' ? WILD_PHASE3_INTRO_DURATION : 0,
      wildCutsceneBeatIdx: -1,
      wildCutsceneFlashTimer: 0,
      wildCutsceneFlashMode: 'NONE' as 'NONE' | 'PURPLE' | 'BW_INVERT',
      wildDimIdx: 0,
      wildPawPhase: 'NONE' as 'NONE' | 'PAW_WINDUP' | 'PAW_STRIKE',
      wildPawTimer: 0,
      wildPawCd: 4.0,
      wildPawTargetX: 0,
      wildPawTargetZ: 0,
      wildPawHitDone: false,
      playerAttackAnim: 0,
      bloodDripTimer: 0,
      lupikKnifePhase: 'NONE' as 'NONE' | 'CHARGING' | 'SLASHING',
      lupikKnifeTimer: 0,
      lupikKnifeHitDone: false,
      comboCount: 0,
      maxComboCount: 0,
      damageTakenTotal: 0,
      dodgeEvadeCount: 0,
      comboPulseTimer: 0,
      dimaStaggerTimer: 0,
      dimaStaggerDuration: 0.36,
      dimaStaggerPower: 0,
      dimaStaggerDir: 1,
      dimaHitFlashTimer: 0,
      dimaHitFlashDuration: 0.16,
      dimaHitFlashColor: 0xef4444,
      shakeIntensity: 0,
      shakeDecay: 1.5,
      pointerLocked: false,
      banner: initSetup.banner,
      bannerTimer: 5.5,
      outcome: 'ACTIVE' as 'ACTIVE' | 'WON' | 'LOST',
    };

    const isSideView = () =>
      state.bossPhase === 'WILD_PHASE3_INTRO' || state.bossPhase === 'WILD_PHASE3';

    const getBossDmg = (baseDmg: number) =>
      isHardcore && state.bossDmgBoost ? Math.round(baseDmg * 1.2) : baseDmg;

    const setBanner = (msg: string, duration = 3) => {
      state.banner = msg;
      state.bannerTimer = duration;
    };

    const triggerScreenShake = (intensity: number, decayRate = 1.55) => {
      const clamped = Math.min(0.68, intensity);
      if (clamped > state.shakeIntensity) {
        state.shakeIntensity = clamped;
        state.shakeDecay = decayRate;
      } else if (clamped >= state.shakeIntensity * 0.7) {
        state.shakeDecay = Math.min(state.shakeDecay, decayRate);
      }
    };

    const triggerBossStagger = (dmg: number) => {
      state.dimaStaggerDir = state.dimaStaggerDir === 1 ? -1 : 1;
      const comboBoost = Math.min(0.62, state.comboCount * 0.045);
      const heavyBoost = dmg >= 90 ? 0.36 : dmg >= 45 ? 0.15 : 0;
      const power = Math.min(1.35, 0.42 + comboBoost + heavyBoost);
      const dur = 0.3 + Math.min(0.26, state.comboCount * 0.016) + (dmg >= 90 ? 0.12 : 0);

      state.dimaStaggerPower = Math.max(state.dimaStaggerPower * 0.65, power);
      state.dimaStaggerDuration = dur;
      state.dimaStaggerTimer = dur;

      const flashDur = dmg >= 90 || state.comboCount >= 5 ? 0.22 : 0.15;
      state.dimaHitFlashDuration = flashDur;
      state.dimaHitFlashTimer = flashDur;
      state.dimaHitFlashColor =
        state.bossPhase === 'LAST_BREATH'
          ? 0x38bdf8
          : state.comboCount >= 10
          ? 0xfbbf24
          : 0xef4444;

      if (
        !isTraining &&
        (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2') &&
        state.dimaUltPhase === 'NONE' &&
        state.dimaDashPhase === 'NONE' &&
        state.dimaSisterPhase !== 'ARGUING' &&
        state.wildSlamPhase === 'NONE' &&
        state.wildJarPhase === 'NONE' &&
        state.wildSkewerPhase === 'NONE'
      ) {
        const kx = bossModel.root.position.x - playerPos.x;
        const kz = bossModel.root.position.z - playerPos.z;
        const kLen = Math.hypot(kx, kz) || 1;
        const pushDist =
          0.14 + Math.min(0.32, state.comboCount * 0.022) + (dmg >= 90 ? 0.24 : 0);
        bossModel.root.position.x = THREE.MathUtils.clamp(
          bossModel.root.position.x + (kx / kLen) * pushDist,
          -12.5,
          12.5
        );
        bossModel.root.position.z = THREE.MathUtils.clamp(
          bossModel.root.position.z + (kz / kLen) * pushDist,
          -13.5,
          13.5
        );
      }
    };

    const ensureActiveMusicPlaying = () => {
      if (state.outcome !== 'ACTIVE') return;
      if (isWildCucumber) {
        if (pendingVioletSeek !== null) {
          seekVioletTo(pendingVioletSeek, true);
        } else if (violetAudio.paused) {
          violetAudio.play().catch(() => {});
        }
        return;
      }
      if (state.bossPhase === 'PHASE1' && aizoAudio.paused) {
        aizoAudio.play().catch(() => {});
      } else if (state.bossPhase === 'HC_PHASE2' && janeAudio.paused) {
        janeAudio.play().catch(() => {});
      } else if (
        (state.bossPhase === 'PHASE2_INTRO' || state.bossPhase === 'LAST_BREATH') &&
        sansAudio.paused
      ) {
        sansAudio.play().catch(() => {});
      }
    };

    const spawnFlash = (x: number, y: number, z: number, color: number, maxScale = 2.6) => {
      const mesh = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.6, 12, 12)),
        trackMat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }))
      );
      mesh.position.set(x, y, z);
      mesh.userData.maxScale = maxScale;
      scene.add(mesh);
      flashes.push({ mesh, life: 0, maxLife: 0.36 });
    };

    const spawnProjectile = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      damage: number,
      fromPlayer: boolean,
      kind: Projectile['kind'],
      isVisualOnly = false
    ) => {
      const grp = new THREE.Group();
      if (kind === 'SHELL') {
        grp.add(
          new THREE.Mesh(
            trackGeo(new THREE.SphereGeometry(0.28, 10, 10)),
            trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf97316, emissiveIntensity: 1.6 }))
          )
        );
      } else if (kind === 'SHASHLIK') {
        const skewer = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 6)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8 }))
        );
        skewer.rotation.x = Math.PI / 2;
        const meat = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.22, 0.22, 0.45)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }))
        );
        grp.add(skewer, meat);
      } else if (kind === 'CUCUMBER') {
        const cucMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 }));
        const darkCucMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }));
        const body = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.11, 0.44, 6, 10)), cucMat);
        body.rotation.x = Math.PI / 2;
        const bump1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 6)), darkCucMat);
        bump1.position.set(0.08, 0.06, 0.08);
        const bump2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 6)), darkCucMat);
        bump2.position.set(-0.08, -0.05, -0.1);
        grp.add(body, bump1, bump2);
      } else if (kind === 'SHOTGUN') {
        grp.add(
          new THREE.Mesh(
            trackGeo(new THREE.SphereGeometry(0.16, 8, 8)),
            trackMat(new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.4 }))
          )
        );
      } else {
        // Computer Mouse + Coiled Black Wire Projectile!
        const mouseBody = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.42)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 }))
        );
        const wireMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 }));
        const wireSeg1 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6)), wireMat);
        wireSeg1.rotation.x = Math.PI / 2;
        wireSeg1.position.set(0.04, 0.02, -0.45);
        const wireSeg2 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 6)), wireMat);
        wireSeg2.rotation.x = Math.PI / 2;
        wireSeg2.rotation.z = 0.25;
        wireSeg2.position.set(-0.06, -0.02, -0.95);
        const usbGlow = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.11, 8, 8)),
          trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444 }))
        );
        usbGlow.position.set(0, 0.05, 0.2);
        grp.add(mouseBody, wireSeg1, wireSeg2, usbGlow);
      }
      grp.position.set(x, y, z);
      scene.add(grp);
      projectiles.push({
        mesh: grp,
        vx,
        vy,
        vz,
        fromPlayer,
        damage,
        radius: kind === 'MOUSE_WIRE' ? 0.72 : 1.05,
        life: 2.5,
        kind,
        isVisualOnly,
      });
    };

    const spawnFallingPickle = (tx: number, tz: number) => {
      const pickleGrp = new THREE.Group();
      const body = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.34, 1.2, 8, 12)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x16a34a,
            emissive: 0x15803d,
            emissiveIntensity: 0.55,
            roughness: 0.45,
          })
        )
      );
      const cap = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.7 }))
      );
      cap.position.y = 0.86;
      pickleGrp.add(body, cap);
      pickleGrp.position.set(tx, 18, tz);
      scene.add(pickleGrp);

      const ring = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(0.35, 2.5, 24)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.75, side: THREE.DoubleSide }))
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(tx, 0.05, tz);
      scene.add(ring);

      fallingBombs.push({
        mesh: pickleGrp,
        ring,
        targetX: tx,
        targetZ: tz,
        y: 18,
        delay: 0,
        damage: EGOR_PICKLE_DROP_DMG,
        exploded: false,
        isPickleDrop: true,
      });
    };

    const unsubCoopAttack = subscribeCoopAttackRef.current?.((ev) => {
      spawnProjectile(ev.x, ev.y, ev.z, ev.vx, ev.vy, ev.vz, 0, true, ev.kind, true);
      spawnFlash(
        ev.x,
        ev.y,
        ev.z,
        ev.kind === 'SHELL'
          ? 0xf97316
          : ev.kind === 'SHOTGUN'
          ? 0xfbbf24
          : ev.kind === 'CUCUMBER'
          ? 0x22c55e
          : 0xef4444,
        ev.kind === 'SHELL' ? 1.15 : 0.75
      );
      const rEntry = remoteAvatars.get(ev.playerId);
      if (rEntry) {
        rEntry.attackAnimTimer = 0.3;
      }
    });

    const isCoopConnected = Boolean(onCoopSyncStateRef.current);
    const isCoopHostNow = (): boolean => {
      if (!isCoopConnected) return true;
      const list = coopPlayersRef.current;
      const myId = coopLocalPlayerIdRef.current;
      if (list && myId) {
        const me = list.find((p) => p.id === myId);
        if (me) return Boolean(me.isHost);
      }
      return Boolean(coopIsHostRef.current);
    };
    const isCoopClientNow = (): boolean => isCoopConnected && !isCoopHostNow();

    const hasAliveCoopTeammate = (): boolean => {
      const remoteMap = coopRemoteStatesRefProp.current?.current;
      if (!remoteMap) return false;
      const nowMs = Date.now();
      for (const r of Object.values(remoteMap)) {
        if (!r || r.id === coopLocalPlayerIdRef.current) continue;
        if (r.screen === 'BOSS_3D' && nowMs - r.updatedAt <= 6500 && r.hp > 0) {
          return true;
        }
      }
      return false;
    };

    const getBossTarget = (): { id: string; isLocal: boolean; x: number; z: number } => {
      const bx = bossModel.root.position.x;
      const bz = bossModel.root.position.z;
      const candidates: Array<{ id: string; isLocal: boolean; x: number; z: number; dist: number }> = [];
      if (state.playerHp > 0 && state.outcome === 'ACTIVE') {
        candidates.push({
          id: coopLocalPlayerIdRef.current || 'local',
          isLocal: true,
          x: playerPos.x,
          z: playerPos.z,
          dist: Math.hypot(playerPos.x - bx, playerPos.z - bz),
        });
      }
      const remoteMap = coopRemoteStatesRefProp.current?.current;
      if (remoteMap) {
        const nowMs = Date.now();
        for (const r of Object.values(remoteMap)) {
          if (!r || r.id === coopLocalPlayerIdRef.current) continue;
          if (r.screen === 'BOSS_3D' && nowMs - r.updatedAt <= 6500 && r.hp > 0) {
            candidates.push({
              id: r.id,
              isLocal: false,
              x: r.x,
              z: r.z,
              dist: Math.hypot(r.x - bx, r.z - bz),
            });
          }
        }
      }
      if (candidates.length === 0) {
        return {
          id: coopLocalPlayerIdRef.current || 'local',
          isLocal: true,
          x: playerPos.x,
          z: playerPos.z,
        };
      }
      candidates.sort((a, b) => a.dist - b.dist);
      return {
        id: candidates[0].id,
        isLocal: candidates[0].isLocal,
        x: candidates[0].x,
        z: candidates[0].z,
      };
    };

    const spawnSkyLasersAt = (laserDefs: Array<{ x: number; z: number; warnTimer: number }>) => {
      for (const def of laserDefs) {
        const ring = new THREE.Mesh(
          trackGeo(new THREE.RingGeometry(0.35, 1.9, 24)),
          trackMat(
            new THREE.MeshBasicMaterial({
              color: 0xf43f5e,
              transparent: true,
              opacity: 0.78,
              side: THREE.DoubleSide,
            })
          )
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(def.x, 0.05, def.z);
        scene.add(ring);

        const aimLine = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 28, 8)),
          trackMat(
            new THREE.MeshBasicMaterial({
              color: 0xfb7185,
              transparent: true,
              opacity: 0.5,
            })
          )
        );
        aimLine.position.set(def.x, 14, def.z);
        scene.add(aimLine);

        const beam = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.85, 0.95, 28, 14)),
          trackMat(
            new THREE.MeshBasicMaterial({
              color: 0xf43f5e,
              transparent: true,
              opacity: 0.92,
            })
          )
        );
        beam.position.set(def.x, 14, def.z);
        beam.visible = false;
        scene.add(beam);

        skyLasers.push({
          ring,
          aimLine,
          beam,
          x: def.x,
          z: def.z,
          warnTimer: def.warnTimer,
          strikeTimer: 0.42,
          phase: 'WARN',
        });
      }
    };

    const applyRemotePhaseChange = (
      targetPhase: NetBossPhase | 'WON',
      nextBossHp: number,
      nextStamina: number,
      nextDmgBoost: boolean,
      bannerText?: string
    ) => {
      if (targetPhase === 'WON') {
        if (isWildCucumber) {
          soundFX.playGlassShatter(true);
          triggerGlassBurst(true, false);
          spawnFlash(bossModel.root.position.x, 1.8, bossModel.root.position.z, 0xc084fc, 5.0);
        }
        finishFight('WON');
        return;
      }

      const prevPhase = state.bossPhase;
      state.bossHp = nextBossHp;
      state.dimaStamina = nextStamina;
      state.bossDmgBoost = nextDmgBoost;

      if (targetPhase === prevPhase) return;
      state.bossPhase = targetPhase;

      if (targetPhase === 'HC_PHASE2') {
        if (isWildCucumber) {
          state.wildRegenActive = true;
          state.wildRegenTimer = 2.0;
          lastVioletPhase = 'HC_PHASE2';
          seekVioletTo(112, true);
        } else {
          aizoAudio.pause();
          janeAudio.currentTime = 0;
          janeAudio.play().catch(() => {});
        }
        lungeAimGroup.visible = false;
        bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
        soundFX.playArmorBreak();
        soundFX.playRage();
        triggerScreenShake(0.48, 1.25);
        spawnFlash(bossModel.root.position.x, 2.2, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0xf43f5e, 4.0);
        if (bannerText) setBanner(bannerText, 4.8);
      } else if (targetPhase === 'WILD_PHASE3_INTRO') {
        state.wildPhase3IntroTimer = WILD_PHASE3_INTRO_DURATION;
        state.wildCutsceneBeatIdx = -1;
        state.wildCutsceneFlashTimer = 0.25;
        state.wildCutsceneFlashMode = 'PURPLE';
        state.wildDimIdx = 0;
        state.dimaStaggerTimer = 0;
        state.dimaHitFlashTimer = 0;
        state.dimaUltPhase = 'NONE';
        state.dimaDashPhase = 'NONE';
        state.dimaSpinWirePhase = 'NONE';
        state.wildSkewerPhase = 'NONE';
        state.wildSlamPhase = 'NONE';
        state.wildJarPhase = 'NONE';
        state.lupikKnifePhase = 'NONE';
        state.playerStunTimer = 0;
        state.dodgeTimer = 0;
        state.playerJumpY = 0;
        state.playerVelY = 0;
        wireSweepGroup.visible = false;
        (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
        lungeAimGroup.visible = false;
        wildSlamRingGroup.visible = false;
        pawSlamRingGroup.visible = false;
        hideJarAndChain();
        impaledSkewerGroup.visible = false;
        viewModelGroup.visible = false;
        knifeGroup.visible = false;
        bossModel.root.visible = true;
        bossModel.upperBodyGroup.visible = true;
        bossModel.upperBodyGroup.position.set(0, 0, 0);
        bossModel.upperBodyGroup.rotation.set(0, 0, 0);
        bossModel.leftLeg.legGroup.position.y = 1.05;
        bossModel.rightLeg.legGroup.position.y = 1.05;
        bossModel.leftLeg.knee.rotation.x = 0;
        bossModel.rightLeg.knee.rotation.x = 0;
        if (bossModel.backJarGroup) bossModel.backJarGroup.visible = true;
        bossModel.bellyWoundGroup.visible = true;
        bossModel.potCrack.visible = true;
        bossModel.root.scale.set(1, 1, 1);
        bossModel.root.position.set(4.3, 0, 0);
        bossModel.root.rotation.set(0, -Math.PI / 2 + 0.34, 0);
        playerPos.set(-4.3, eyeHeight, 0);
        playerAvatar.root.visible = true;
        playerAvatar.root.position.set(-4.3, 0, 0);
        playerAvatar.root.rotation.set(0, Math.PI / 2 - 0.18, 0);
        cutsceneVfxGroup.visible = true;
        ghostPawsGroup.visible = false;
        iliheModel.root.visible = false;
        maksModel.root.visible = false;
        for (const obj of wildFrontOccludingObjs) obj.visible = false;
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock?.();
        }
        lastVioletPhase = 'WILD_PHASE3_INTRO';
        seekVioletTo(163, true);
        soundFX.playGlassShatter(false);
        triggerGlassBurst(false, false);
        triggerScreenShake(0.45, 1.3);
        if (bannerText) setBanner(bannerText, 4.5);
      } else if (targetPhase === 'WILD_PHASE3') {
        soundFX.playGlassShatter(true);
        triggerGlassBurst(true, false);
        triggerScreenShake(0.62, 1.15);
        spawnFlash(0, 1.9, 0, 0xe879f9, 5.5);
        renderer.domElement.style.filter = '';
        state.wildCutsceneFlashTimer = 0;
        state.wildCutsceneFlashMode = 'NONE';
        cutsceneVfxGroup.visible = false;
        for (const arc of cutsceneSlashArcs) arc.visible = false;
        if (scene.background instanceof THREE.Color) scene.background.copy(wildBgDark);
        if (scene.fog instanceof THREE.FogExp2) scene.fog.color.setHex(0x130824);
        hemiLight.color.setHex(0xa855f7);
        hemiLight.intensity = 0.72;
        keyLight.color.setHex(0xd8b4fe);
        keyLight.intensity = 1.15;
        rimLight.color.setHex(0x9333ea);
        ghostPawsGroup.visible = true;
        ghostPawsGroup.scale.setScalar(1);
        playerPos.set(-4.5, eyeHeight, 0);
        playerAvatar.root.position.set(-4.5, 0, 0);
        playerAvatar.root.rotation.set(0, Math.PI / 2, 0);
        playerAvatar.upperBodyGroup.rotation.set(0, 0, 0);
        iliheModel.root.visible = minion === 'ILIHE';
        maksModel.root.visible = minion === 'MAKS';
        bossModel.root.scale.set(1, 1, 1);
        bossModel.root.position.set(4.5, 0, 0);
        bossModel.root.rotation.set(0, -Math.PI / 2, 0);
        lastVioletPhase = 'WILD_PHASE3';
        seekVioletTo(186, true);
        soundFX.playRage();
        if (bannerText) setBanner(bannerText, 5.0);
      } else if (targetPhase === 'PHASE2_INTRO') {
        state.phase2IntroTimer = PHASE2_INTRO_DURATION;
        state.wildSkewerPhase = 'NONE';
        state.wildSlamPhase = 'NONE';
        state.wildJarPhase = 'NONE';
        state.dimaUltPhase = 'NONE';
        state.dimaSisterPhase = 'NONE';
        state.dimaDashPhase = 'NONE';
        state.dimaSpinWirePhase = 'NONE';
        lungeAimGroup.visible = false;
        wildSlamRingGroup.visible = false;
        hideJarAndChain();
        impaledSkewerGroup.visible = false;
        wireSweepGroup.visible = false;
        sisterModel.visible = false;
        if (state.lupikKnifePhase === 'NONE') viewModelGroup.visible = true;
        bossModel.bellyWoundGroup.visible = true;
        bossModel.potCrack.visible = true;
        if (!isWildCucumber) {
          bossModel.intactShieldGroup.visible = false;
          bossModel.brokenShieldGroup.visible = true;
          bossModel.potGroup.position.set(0.24, 2.88, -0.14);
          bossModel.potGroup.rotation.set(-0.34, 0.25, -0.68);
          bossModel.rightPotHandle.visible = false;
          spawnBloodBurst(18);
        }
        spawnFlash(bossModel.root.position.x, 2.4, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0xef4444, 3.4);
        soundFX.playArmorBreak();
        triggerScreenShake(0.52, 1.15);
        aizoAudio.pause();
        janeAudio.pause();
        sansAudio.currentTime = 0;
        sansAudio.play().catch(() => {});
        if (bannerText) setBanner(bannerText, 5.0);
      } else if (targetPhase === 'LAST_BREATH') {
        bossModel.root.scale.set(1, 1, 1);
        bossModel.upperBodyGroup.position.set(0, 0, 0);
        bossModel.upperBodyGroup.rotation.set(0, 0, 0);
        bossModel.leftLeg.legGroup.position.y = 1.05;
        bossModel.leftLeg.legGroup.rotation.x = 0;
        bossModel.leftLeg.knee.rotation.x = 0;
        bossModel.rightLeg.legGroup.position.y = 1.05;
        bossModel.rightLeg.legGroup.rotation.x = 0;
        bossModel.rightLeg.knee.rotation.x = 0;
        bossModel.leftArm.rotation.set(0, 0, 0);
        bossModel.rightArm.rotation.set(0, 0, 0);
        if (sansAudio.paused) sansAudio.play().catch(() => {});
        soundFX.playRage();
        triggerScreenShake(0.42, 1.25);
        spawnFlash(bossModel.root.position.x, 2.0, bossModel.root.position.z, 0x38bdf8, 4.2);
        if (bannerText) setBanner(bannerText, 4.5);
      } else if (targetPhase === 'EXHAUSTED') {
        state.dimaStaggerTimer = 0;
        state.dimaHitFlashTimer = 0;
        state.dimaUltPhase = 'NONE';
        state.dimaSisterPhase = 'NONE';
        state.dimaDashPhase = 'NONE';
        state.dimaSpinWirePhase = 'NONE';
        wireSweepGroup.visible = false;
        sisterModel.visible = false;
        bossModel.root.scale.set(1, 1, 1);
        (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0;
        (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
        for (const l of skyLasers) {
          scene.remove(l.ring);
          scene.remove(l.aimLine);
          scene.remove(l.beam);
        }
        skyLasers.length = 0;
        sansAudio.pause();
        janeAudio.pause();
        aizoAudio.pause();
        soundFX.playBossHit();
        triggerScreenShake(0.48, 1.25);
        if (bannerText) setBanner(bannerText, 6);
      }
    };

    const unsubCoopBossEvent = subscribeCoopBossEventRef.current?.((ev) => {
      if (ev.type === 'STOMP_WON') {
        if (state.outcome === 'ACTIVE' && state.bossPhase !== 'STOMPING') {
          triggerStompFinisher(true);
        }
        return;
      }
      if (!isCoopClientNow()) return;

      if (ev.type === 'PHASE_CHANGE') {
        applyRemotePhaseChange(ev.bossPhase, ev.bossHp, ev.dimaStamina, ev.bossDmgBoost, ev.banner);
      } else if (ev.type === 'BOSS_BANNER') {
        setBanner(ev.text, ev.dur ?? 2.2);
      } else if (ev.type === 'WIRE_SHOT') {
        soundFX.playWireShot();
        triggerScreenShake(0.14, 2.2);
        if (ev.banner) setBanner(ev.banner, 2.0);
        for (const w of ev.wires) {
          spawnProjectile(w.x, w.y, w.z, w.vx, w.vy, w.vz, w.dmg, false, 'MOUSE_WIRE');
        }
      } else if (ev.type === 'SKY_LASERS') {
        soundFX.playRadarPing();
        triggerScreenShake(0.22, 1.65);
        if (ev.banner) setBanner(ev.banner, 2.8);
        spawnSkyLasersAt(ev.lasers);
      } else if (ev.type === 'SISTER_SONIC') {
        (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0;
        soundFX.playSonicWave();
        triggerScreenShake(0.46, 1.25);
        state.sonicOriginX = ev.originX;
        state.sonicOriginZ = ev.originZ;
        sonicWaveRing.position.set(ev.originX, 1.1, ev.originZ);
        state.sonicWaveAnim = 0.7;
        const dWave = Math.hypot(playerPos.x - ev.originX, playerPos.z - ev.originZ);
        if (dWave <= 14.5) {
          if (damagePlayer(ev.dmg, `ЗВУКОВАЯ ВОЛНА ССОРЫ! Сестра и ${bossShortName} снесли ${ev.dmg} HP!`, 2.6)) {
            soundFX.playQteMiss();
            triggerScreenShake(0.54, 1.2);
          }
        }
      } else if (ev.type === 'ULT_JUMP_IMPACT') {
        (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
        soundFX.playExplosion();
        triggerScreenShake(0.58, 1.15);
        spawnFlash(ev.x, 1.0, ev.z, isWildCucumber ? 0xa855f7 : 0xef4444, 4.8);
        const dJump = Math.hypot(playerPos.x - ev.x, playerPos.z - ev.z);
        if (dJump < 4.4) {
          if (damagePlayer(ev.dmg, `ПЛЮХ! Гигантский ${bossShortName} прыгнул прямо на тебя (-${ev.dmg} HP)!`, 2.4)) {
            soundFX.playBossHit();
          }
        }
      } else if (ev.type === 'WILD_SLAM_IMPACT') {
        wildSlamRingGroup.visible = false;
        soundFX.playExplosion();
        soundFX.playBellySlam();
        triggerScreenShake(0.55, 1.2);
        spawnFlash(ev.x, 0.6, ev.z, 0xef4444, 4.6);
        const dSlam = Math.hypot(playerPos.x - ev.x, playerPos.z - ev.z);
        if (dSlam <= 3.4 && state.playerJumpY < 2.2) {
          if (
            damagePlayer(
              ev.dmg,
              'УДАР СВЕРХУ! Wild Огурец обрушился на тебя (-30 HP · СТАН 1.5с)!',
              2.4
            )
          ) {
            state.playerStunTimer = 1.5;
            state.dodgeTimer = 0;
            soundFX.playBossHit();
          }
        }
      } else if (ev.type === 'WILD_PAW_IMPACT') {
        pawSlamRingGroup.visible = false;
        soundFX.playBellySlam();
        soundFX.playExplosion();
        triggerScreenShake(0.45, 1.35);
        spawnFlash(ev.x, 0.45, ev.z, 0xc084fc, 3.8);
        const dPaw = Math.hypot(playerPos.x - ev.x, playerPos.z - ev.z);
        if (dPaw <= 3.4 && state.playerJumpY < 1.55) {
          if (damagePlayer(ev.dmg, `УДАР ЛАПОЙ! Призрачная лапа пса нанесла ${ev.dmg} урона!`, 2.0)) {
            soundFX.playBossHit();
          }
        }
      } else if (ev.type === 'WILD_SWING_IMPACT') {
        const dSwing = Math.hypot(playerPos.x - ev.bx, playerPos.z - ev.bz);
        if (dSwing <= 3.85 && state.playerJumpY < 1.35) {
          if (damagePlayer(ev.dmg, `УДАР ШАМПУРОМ! Wild Огурец нанёс ${ev.dmg} урона!`, 1.8)) {
            soundFX.playBossHit();
            spawnFlash(playerPos.x, 1.3, playerPos.z, 0x991b1b, 1.6);
          }
        }
      } else if (ev.type === 'MELEE_STRIKE') {
        const dMelee = Math.hypot(playerPos.x - ev.bx, playerPos.z - ev.bz);
        if (dMelee <= 3.25) {
          if (damagePlayer(ev.dmg)) {
            soundFX.playBossHit();
          }
        }
      } else if (ev.type === 'DIMA_DASH_BOUNCE') {
        soundFX.playGarageBounce();
        triggerScreenShake(0.32, 1.85);
        spawnFlash(ev.x, 1.6, ev.z, isWildCucumber ? 0xc084fc : 0xfbbf24, 2.2);
      }
    });

    const unsubCoopRemoteHit = subscribeCoopRemoteHitRef.current?.((hit) => {
      if (hit.attackerId && hit.attackerId === coopLocalPlayerIdRef.current) return;
      if (hit.amount > 0) {
        pendingRemoteHitsRef.current.push({
          attackerName: hit.attackerName || 'Союзник',
          amount: hit.amount,
        });
      }
    });

    let clientLungeHitLock = false;
    let clientJarHitLock = false;

    const triggerPrimary = () => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.primaryCd > 0 ||
        state.bossPhase === 'WILD_PHASE3_INTRO' ||
        state.playerStunTimer > 0 ||
        state.wildSkewerPhase === 'IMPALE_CUTSCENE' ||
        state.wildJarPhase === 'JAR_PULL' ||
        state.wildJarPhase === 'JAR_PUSH'
      ) {
        return;
      }

      if (state.bossPhase === 'WILD_PHASE3') {
        _aimDir
          .set(
            bossModel.root.position.x - playerPos.x,
            1.65 - (playerPos.y - 0.15 + state.playerJumpY),
            bossModel.root.position.z - playerPos.z
          )
          .normalize();
      } else {
        camera.getWorldDirection(_aimDir);
        _aimDir.normalize();
      }

      const sx = playerPos.x + _aimDir.x * 0.9;
      const sy = playerPos.y - 0.15 + state.playerJumpY + _aimDir.y * 0.9;
      const sz = playerPos.z + _aimDir.z * 0.9;
      const maksDmgBonus = state.maksBuffLeft > 0 ? 10 : 0;

      if (fighter === 'LUPIK') {
        const dmg = (state.rageLeft > 0 ? 50 : 25) + maksDmgBonus;
        state.primaryCd =
          state.bossPhase === 'LAST_BREATH' ? (state.rageLeft > 0 ? 0.3 : 0.48) : 2;
        state.recoilKick = 1;
        state.playerAttackAnim = 0.25;
        soundFX.playShotgun();
        spawnProjectile(sx, sy, sz, _aimDir.x * 28, _aimDir.y * 28, _aimDir.z * 28, dmg, true, 'SHOTGUN');
        spawnFlash(sx, sy, sz, 0xfbbf24, 0.75);
        onCoopAttackRef.current?.({
          fighter,
          kind: 'SHOTGUN',
          x: sx,
          y: sy,
          z: sz,
          vx: _aimDir.x * 28,
          vy: _aimDir.y * 28,
          vz: _aimDir.z * 28,
        });
      } else if (fighter === 'EGOR') {
        const useShashlik = state.shashlik > 0;
        const projKind: 'SHASHLIK' | 'CUCUMBER' = useShashlik ? 'SHASHLIK' : 'CUCUMBER';
        const projSpeed = useShashlik ? 25 : 27;
        if (useShashlik) {
          state.shashlik -= 1;
          state.primaryCd = state.bossPhase === 'LAST_BREATH' ? 0.35 : 1.1;
        } else {
          state.primaryCd = state.bossPhase === 'LAST_BREATH' ? 0.35 : 0.85;
        }
        state.recoilKick = useShashlik ? 0.9 : 0.65;
        state.playerAttackAnim = 0.25;
        const baseDmg = useShashlik ? EGOR_SHASHLIK_DMG : EGOR_CUCUMBER_DMG;
        const dmg = baseDmg + maksDmgBonus;
        soundFX.playQteHit();
        spawnProjectile(
          sx,
          sy,
          sz,
          _aimDir.x * projSpeed,
          _aimDir.y * projSpeed,
          _aimDir.z * projSpeed,
          dmg,
          true,
          projKind
        );
        onCoopAttackRef.current?.({
          fighter,
          kind: projKind,
          x: sx,
          y: sy,
          z: sz,
          vx: _aimDir.x * projSpeed,
          vy: _aimDir.y * projSpeed,
          vz: _aimDir.z * projSpeed,
        });
      } else if (fighter === 'ARTEM') {
        const dmg = ARTEM_BASE_DMG + artemBonusDmg + maksDmgBonus;
        if (state.bossPhase === 'LAST_BREATH') {
          state.primaryCd = 0.65;
        } else {
          state.primaryCd = Math.max(2.2, 3.0 - state.artemHitStreak * 0.2);
        }
        state.recoilKick = 1.4;
        state.playerAttackAnim = 0.3;
        soundFX.playCannon();
        const shellSpeed = 38;
        spawnProjectile(
          sx,
          sy,
          sz,
          _aimDir.x * shellSpeed,
          _aimDir.y * shellSpeed,
          _aimDir.z * shellSpeed,
          dmg,
          true,
          'SHELL'
        );
        spawnFlash(sx + _aimDir.x * 0.8, sy, sz + _aimDir.z * 0.8, 0xf97316, 1.3);
        onCoopAttackRef.current?.({
          fighter,
          kind: 'SHELL',
          x: sx,
          y: sy,
          z: sz,
          vx: _aimDir.x * shellSpeed,
          vy: _aimDir.y * shellSpeed,
          vz: _aimDir.z * shellSpeed,
        });
      }
    };

    const triggerAbility1 = () => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.ability1Cd > 0 ||
        state.bossPhase === 'WILD_PHASE3_INTRO' ||
        state.playerStunTimer > 0 ||
        state.wildSkewerPhase === 'IMPALE_CUTSCENE' ||
        state.wildJarPhase === 'JAR_PULL' ||
        state.wildJarPhase === 'JAR_PUSH'
      ) {
        return;
      }

      if (fighter === 'LUPIK') {
        if (state.bossPhase === 'STOMPING' || state.lupikKnifePhase !== 'NONE') return;
        state.ability1Cd = 30;
        state.playerJumpY = 0;
        state.playerVelY = 0;
        state.lupikKnifePhase = 'CHARGING';
        state.lupikKnifeTimer = 0.95;
        state.lupikKnifeHitDone = false;
        viewModelGroup.visible = false;
        knifeGroup.visible = !isSideView();
        soundFX.playRage();
        setBanner(`РАЗЪЯРЁННЫЙ ГИЛБЕРТ (IFRAME)! Неуязвим, ${bossShortName} заморожен — режем!`, 2.8);
        return;
      }

      if (fighter === 'ARTEM') {
        state.ability1Cd = ARTEM_ARMOR_CD;
        state.artemArmorLeft = ARTEM_ARMOR_DURATION;
        const prevHp = state.playerHp;
        state.playerHp = Math.min(maxPlayerHp, state.playerHp + ARTEM_ARMOR_HEAL);
        const healed = state.playerHp - prevHp;
        state.healFlashTimer = 0.55;
        state.eatAnim = 0.6;
        soundFX.playArmorBreak();
        soundFX.playFriendJoin();
        spawnFlash(playerPos.x, 0.7, playerPos.z, 0x10b981, 4.4);
        triggerScreenShake(0.2, 1.5);

        const bx = bossModel.root.position.x;
        const bz = bossModel.root.position.z;
        const bdx = bx - playerPos.x;
        const bdz = bz - playerPos.z;
        const bDist = Math.hypot(bdx, bdz);
        const maksDmgBonus = state.maksBuffLeft > 0 ? 10 : 0;
        let shockedBoss = false;
        if (bDist < 5.2 && state.bossPhase !== 'PHASE2_INTRO' && state.bossPhase !== 'STOMPING') {
          shockedBoss = true;
          const shockDmg = ARTEM_ARMOR_SHOCK_DMG + maksDmgBonus;
          applyBossHit(shockDmg, 'SHOCKWAVE');
          spawnFlash(bx, 1.2, bz, 0xf59e0b, 2.6);
          if (!isTraining && bDist > 0.05) {
            const zBound = state.bossPhase === 'WILD_PHASE3' ? 7.5 : 13.5;
            bossModel.root.position.x = THREE.MathUtils.clamp(bx + (bdx / bDist) * 2.4, -12.5, 12.5);
            bossModel.root.position.z = THREE.MathUtils.clamp(bz + (bdz / bDist) * 2.4, -zBound, zBound);
          }
        }

        setBanner(
          shockedBoss
            ? `БРОНЯ «РОМБ» (-60% урона 3.5с) + РЕМОНТ (+${healed > 0 ? healed : ARTEM_ARMOR_HEAL} HP) + УДАР ГУСЕНИЦ (${ARTEM_ARMOR_SHOCK_DMG + maksDmgBonus} DMG)!`
            : `БРОНЯ «РОМБ» (-60% урона 3.5с) + ПОЛЕВОЙ РЕМОНТ (+${healed > 0 ? healed : ARTEM_ARMOR_HEAL} HP)!`,
          2.8
        );
        return;
      }

      if (fighter !== 'EGOR') return;
      state.ability1Cd = EGOR_DOG_CD;
      state.shashlikDogPhase = 'DASH_TO_BOSS';
      state.shashlikDogBiteDmg = 0;
      soundFX.playDogBark();
      setBanner(`Собака-шашлычница несётся к ${bossGenitiveName} (укус ${EGOR_DOG_BITE_DMG} DMG -> +3 шашлыка и +${EGOR_DOG_HEAL} HP)!`, 2.6);

      if (shashlikDogMesh) scene.remove(shashlikDogMesh);
      shashlikDogMesh = buildDogHelper(false);
      shashlikDogMesh.position.set(playerPos.x - 1.6, 0, playerPos.z - 1.2);
      scene.add(shashlikDogMesh);
      shashlikDogTimer = 1.05;
    };

    const triggerUlt = () => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.bossPhase === 'WILD_PHASE3_INTRO' ||
        state.playerStunTimer > 0 ||
        state.wildSkewerPhase === 'IMPALE_CUTSCENE' ||
        state.wildJarPhase === 'JAR_PULL' ||
        state.wildJarPhase === 'JAR_PUSH'
      ) {
        return;
      }

      if (fighter === 'ARTEM') {
        if (state.artemDamageCharge < ARTEM_AIRSTRIKE_COST) {
          setBanner(
            `Нафарми ${ARTEM_AIRSTRIKE_COST} урона с ЛКМ для АртУдара! (${state.artemDamageCharge} / ${ARTEM_AIRSTRIKE_COST})`,
            2.4
          );
          return;
        }
        state.artemDamageCharge = Math.max(0, state.artemDamageCharge - ARTEM_AIRSTRIKE_COST);
        state.commanderTimer = 2.4;
        binocGroup.visible = true;
        soundFX.playRadarPing();
        const maksDmgBonus = state.maksBuffLeft > 0 ? 10 : 0;
        setBanner(
          `Артём в бинокль: «Координаты 67001! ОГОНЬ!» 3 точных снаряда (${ARTEM_AIRSTRIKE_DAMAGE + maksDmgBonus} DMG) и замедление!`,
          3.2
        );

        const bx = bossModel.root.position.x;
        const bz = bossModel.root.position.z;
        const bombDamages = [105 + maksDmgBonus, 105, 105];

        for (let i = 0; i < 3; i++) {
          const offsetX = (i - 1) * 1.1;
          const offsetZ = i % 2 === 0 ? 0.6 : -0.6;
          const tx = THREE.MathUtils.clamp(bx + offsetX, -12.2, 12.2);
          const tz = THREE.MathUtils.clamp(bz + offsetZ, -13.0, 13.0);

          const bombGrp = new THREE.Group();
          const bBody = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.28, 0.35, 1.35, 10)),
            trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 }))
          );
          const bTip = new THREE.Mesh(
            trackGeo(new THREE.ConeGeometry(0.35, 0.45, 10)),
            trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.8 }))
          );
          bTip.rotation.x = Math.PI;
          bTip.position.y = -0.85;
          bombGrp.add(bBody, bTip);
          bombGrp.position.set(tx, 22, tz);
          scene.add(bombGrp);

          const ring = new THREE.Mesh(
            trackGeo(new THREE.RingGeometry(0.3, 2.2, 24)),
            trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7, side: THREE.DoubleSide }))
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(tx, 0.04, tz);
          scene.add(ring);

          fallingBombs.push({
            mesh: bombGrp,
            ring,
            targetX: tx,
            targetZ: tz,
            y: 22,
            delay: i * 0.24,
            damage: bombDamages[i],
            exploded: false,
            isArtemAirstrike: true,
          });
        }
        return;
      }

      if (state.ultCd > 0) return;

      if (fighter === 'LUPIK') {
        state.ultCd = state.ultMaxCd;
        state.rageLeft = 8;
        soundFX.playRage();
        setBanner('RAGE АКТИВИРОВАН! Урон x2 (50 DMG) и скорость бега увеличена!', 3);
      } else if (fighter === 'EGOR') {
        state.ultCd = state.ultMaxCd;
        state.radarLeft = EGOR_ULT_DURATION;
        state.egorRadarHitCounter = 0;
        state.egorPickleDropsLeft = EGOR_MAX_PICKLE_DROPS;
        soundFX.playRadarPing();
        setBanner('РАДАР-ПЁС & РАССОЛ! Босс замедлен (-15%), +20% урона, каждые 4 попадания — солёный огурец (8с)!', 3.4);
        if (radarDogMesh) scene.remove(radarDogMesh);
        radarDogMesh = buildDogHelper(true);
        radarDogMesh.position.set(playerPos.x + 2.2, 0, playerPos.z - 2);
        scene.add(radarDogMesh);
      }
    };

    // Minion Command 1: ИЛИХЕ Belly Slam (100 DMG) OR МАКС Turkey Beak Strike (50 DMG, 25s CD)
    const triggerMinion1 = () => {
      if (state.outcome !== 'ACTIVE' || state.minion1Cd > 0 || state.bossPhase === 'WILD_PHASE3_INTRO') return;

      if (minion === 'MAKS') {
        state.minion1Cd = 25;
        state.maksPeckState = 'FLYING';
        state.maksPeckTimer = 1.65;
        soundFX.playTurkeyGobble();
        setBanner('МАКС (ИНДЮК) ВЗЛЕТАЕТ! Налёт и удар клювом по Диме (50 урона)!', 2.8);
        return;
      }

      state.minion1Cd = state.bossPhase === 'LAST_BREATH' ? 6 : 30;
      state.iliheSlamState = 'CHARGING';
      state.iliheSlamTimer = 1.6;
      soundFX.playDogBark();
      setBanner('ИЛИХЕ (Толстый Луффи): «ГОМУ-ГОМУ УДАР ПУЗОМ!» (100 HP урона)', 2.8);
    };

    // Minion Command 2: ИЛИХЕ Fruit Heal (+10% HP) OR МАКС Turkey Buff (+10 DMG & +1 HP/2s for 20s, 20s CD)
    const triggerMinion2 = () => {
      if (state.outcome !== 'ACTIVE' || state.minion2Cd > 0 || state.bossPhase === 'WILD_PHASE3_INTRO') return;

      if (minion === 'MAKS') {
        state.minion2Cd = 20;
        state.maksBuffLeft = 20;
        state.maksRegenTickTimer = 2.0;
        state.healFlashTimer = 0.5;
        soundFX.playTurkeyGobble();
        soundFX.playFriendJoin();
        spawnFlash(maksModel.root.position.x, 1.4, maksModel.root.position.z, 0x34d399, 2.5);
        setBanner('БАФФ МАКСА (20 сек): +10 к урону героя и реген +1 HP каждые 2 сек!', 3.2);
        return;
      }

      state.minion2Cd = 12;
      soundFX.playFriendJoin();
      setBanner('ИЛИХЕ кинул вкусный фрукт! Лови и хилься (+10% HP)!', 2.6);

      const fruitGrp = new THREE.Group();
      const fruitMesh = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.28, 12, 12)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x6b21a8, emissiveIntensity: 0.9, roughness: 0.4 }))
      );
      const stem = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e }))
      );
      stem.position.y = 0.32;
      fruitGrp.add(fruitMesh, stem);
      fruitGrp.position.set(iliheModel.root.position.x, 1.5, iliheModel.root.position.z);
      scene.add(fruitGrp);

      thrownFruits.push({
        mesh: fruitGrp,
        startX: iliheModel.root.position.x,
        startZ: iliheModel.root.position.z,
        t: 0,
        duration: 0.65,
      });
    };

    // Cleanly stop fight music and release pointer lock when fight concludes
    const finishFight = (outcome: 'WON' | 'LOST') => {
      fightActive = false;
      state.outcome = outcome;
      aizoAudio.pause();
      janeAudio.pause();
      sansAudio.pause();
      violetAudio.pause();
      wireSweepGroup.visible = false;
      lungeAimGroup.visible = false;
      wildSlamRingGroup.visible = false;
      pawSlamRingGroup.visible = false;
      glassShardGroup.visible = false;
      cutsceneVfxGroup.visible = false;
      renderer.domElement.style.filter = '';
      hideJarAndChain();
      impaledSkewerGroup.visible = false;
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      if (outcome === 'WON') {
        soundFX.playVictory();
      }
    };

    // Player Jump ([Space]) — lets hero jump over Dima's Phase 3 spinning mouse wire!
    const triggerJump = () => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.bossPhase === 'STOMPING' ||
        state.bossPhase === 'WILD_PHASE3_INTRO' ||
        state.playerStunTimer > 0 ||
        state.lupikKnifePhase !== 'NONE' ||
        state.wildSkewerPhase === 'IMPALE_CUTSCENE' ||
        state.wildJarPhase === 'JAR_PULL' ||
        state.wildJarPhase === 'JAR_PUSH'
      ) {
        return;
      }
      if (state.playerJumpY <= 0.005) {
        state.playerVelY = 10.8;
        state.jumpClearedWireNotified = false;
        soundFX.playJump();
      }
    };

    // Player Dodge Dash ([F]) — 50 energy cost, 150ms i-frame invulnerability
    const triggerDodgeDash = () => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.bossPhase === 'STOMPING' ||
        state.bossPhase === 'EXHAUSTED' ||
        state.bossPhase === 'WILD_PHASE3_INTRO' ||
        state.playerStunTimer > 0 ||
        state.lupikKnifePhase !== 'NONE' ||
        state.wildSkewerPhase === 'IMPALE_CUTSCENE' ||
        state.wildJarPhase === 'JAR_PULL' ||
        state.wildJarPhase === 'JAR_PUSH'
      ) {
        return;
      }
      if (state.dodgeTimer > 0) return;
      if (state.playerEnergy < PLAYER_DASH_COST) {
        setBanner(
          `Недостаточно энергии для рывка! Нужно ${PLAYER_DASH_COST} (сейчас ${Math.floor(state.playerEnergy)})`,
          1.3
        );
        return;
      }

      state.playerEnergy = Math.max(0, state.playerEnergy - PLAYER_DASH_COST);

      const fwdInput = (keys['w'] || keys['ц'] ? 1 : 0) - (keys['s'] || keys['ы'] ? 1 : 0);
      const strafeInput = (keys['d'] || keys['в'] ? 1 : 0) - (keys['a'] || keys['ф'] ? 1 : 0);
      if (isSideView()) {
        _forward.set(0, 0, -1);
        _right.set(1, 0, 0);
      } else {
        _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
        _right.crossVectors(_forward, _up).normalize();
      }

      if (fwdInput !== 0 || strafeInput !== 0) {
        _vec3
          .set(0, 0, 0)
          .addScaledVector(_forward, fwdInput)
          .addScaledVector(_right, strafeInput)
          .normalize();
        state.dodgeDirX = _vec3.x;
        state.dodgeDirZ = _vec3.z;
      } else {
        // Default dash away from boss in side view or backward in 1st-person
        state.dodgeDirX = isSideView()
          ? playerPos.x <= bossModel.root.position.x
            ? -1
            : 1
          : -_forward.x;
        state.dodgeDirZ = isSideView() ? 0 : -_forward.z;
      }

      state.dodgeTimer = PLAYER_DASH_DURATION;
      state.dodgeIframeTimer = PLAYER_DASH_IFRAME_DURATION;
      state.dodgeEvadeTriggered = false;
      soundFX.playDodgeDash();
      setBanner('РЫВОК [F]! Неуязвимость 150 мс (-50 энергии)', 1.0);
    };

    // Centralized player damage helper honoring Lupik's knife IFRAME, Wild Cucumber Cutscenes & F-dodge 150ms IFRAME!
    const damagePlayer = (amount: number, hitBanner?: string, bannerDur = 2.0): boolean => {
      if (
        state.outcome !== 'ACTIVE' ||
        state.bossPhase === 'STOMPING' ||
        state.bossPhase === 'WILD_PHASE3_INTRO'
      ) {
        return false;
      }
      if (state.wildSkewerPhase === 'IMPALE_CUTSCENE') {
        return false;
      }
      if (state.lupikKnifePhase !== 'NONE') {
        setBanner('IFRAME! Урон заблокирован во время пореза ножом!', 1.2);
        return false;
      }
      if (state.dodgeIframeTimer > 0) {
        if (!state.dodgeEvadeTriggered) {
          state.dodgeEvadeTriggered = true;
          state.dodgeEvadeCount += 1;
          soundFX.playDodgeEvade();
          setBanner(`УКЛОНЕНИЕ! Атака ${bossGenitiveName} прошла сквозь тебя (IFRAME 150 мс)!`, 1.4);
        }
        return false;
      }
      const effectiveAmount =
        state.artemArmorLeft > 0 ? Math.max(1, Math.round(amount * 0.4)) : amount;
      const hadCombo = state.comboCount > 0;
      state.playerHp = Math.max(0, state.playerHp - effectiveAmount);
      state.damageTakenTotal += effectiveAmount;
      state.comboCount = 0;
      if (hadCombo) {
        soundFX.playComboBreak();
      }
      state.damageFlashTimer = 0.38;
      triggerScreenShake(0.28, 1.8);
      if (hitBanner) {
        setBanner(
          state.artemArmorLeft > 0
            ? `БРОНЯ «РОМБ» (-60% · -${effectiveAmount} HP): ${hitBanner}`
            : hitBanner,
          bannerDur
        );
      }
      if (state.playerHp <= 0) finishFight('LOST');
      return true;
    };

    // Stomp Finisher when Dima's Last Breath stamina reaches 0!
    const triggerStompFinisher = (isRemoteStomp = false) => {
      if (state.outcome !== 'ACTIVE') return;
      if (!isRemoteStomp && state.bossPhase !== 'EXHAUSTED') return;
      if (isRemoteStomp && state.bossPhase === 'STOMPING') return;
      if (!isRemoteStomp && isCoopConnected) {
        onCoopBossStompRef.current?.();
      }
      state.bossPhase = 'STOMPING';
      state.stompAnimTimer = 0;
      state.stompImpactDone = false;
      viewModelGroup.visible = false;
      stompBootGroup.visible = true;
      aizoAudio.pause();
      janeAudio.pause();
      sansAudio.pause();
      stompAudio.currentTime = 0;
      stompAudio.play().catch(() => {});
      setBanner('ВТАПТЫВАЕМ ДИМУ НОГОЙ!', 2.2);
    };

    // Unified boss hit handler
    const bossShortName = isWildCucumber ? 'Wild Огурец' : 'Дима';
    const bossGenitiveName = isWildCucumber ? 'Wild Огурца' : 'Димы';
    const applyBossHit = (
      dmg: number,
      sourceKind: 'SHOTGUN' | 'SHASHLIK' | 'CUCUMBER' | 'DOG_BITE' | 'SHELL' | 'BOMB' | 'BELLY' | 'PECK' | 'KNIFE' | 'SHOCKWAVE',
      isRemote = false
    ) => {
      if (state.outcome !== 'ACTIVE') return;

      if (state.bossPhase === 'PHASE2_INTRO' || state.bossPhase === 'WILD_PHASE3_INTRO') {
        if (!isRemote) {
          spawnFlash(bossModel.root.position.x, 1.8, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0x38bdf8, 1.5);
          setBanner(
            state.bossPhase === 'WILD_PHASE3_INTRO'
              ? 'РАЗЛОМ ИЗМЕРЕНИЙ! Wild Огурец НЕУЯЗВИМ (IFRAME · 23с)!'
              : `${bossShortName} НЕУЯЗВИМ во время превращения в ${isHardcore ? '3-ю' : '2-ю'} фазу!`,
            1.2
          );
        }
        return;
      }

      if (!isRemote) {
        if (fighter === 'ARTEM' && sourceKind === 'SHELL') {
          state.artemDamageCharge += dmg;
          state.artemTotalDamage += dmg;
        } else if (fighter === 'ARTEM' && (sourceKind === 'BOMB' || sourceKind === 'SHOCKWAVE')) {
          state.artemTotalDamage += dmg;
        }
      }

      if (sourceKind === 'KNIFE') {
        bossModel.bellyWoundGroup.visible = true;
        spawnBloodBurst(10);
      }

      if (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') {
        if (!isRemote) {
          state.comboCount += 1;
          state.maxComboCount = Math.max(state.maxComboCount, state.comboCount);
          state.comboPulseTimer = 0.28;
          soundFX.playComboHit(state.comboCount);
          spawnComboSparks(state.comboCount);
          triggerBossStagger(dmg);
          if (state.comboCount === 10) {
            setBanner('КОМБО x10! Звуковой профиль повышен — ЯРОСТЬ!', 2.2);
          } else if (state.comboCount === 20) {
            setBanner('КОМБО x20! Звуковой профиль УЛЬТРА — максимальный драйв!', 2.5);
          }
          if (dmg >= 90) {
            triggerScreenShake(state.comboCount >= 5 ? 0.46 : 0.36, 1.45);
          } else if (state.comboCount >= 15) {
            triggerScreenShake(0.36, 1.55);
          } else if (state.comboCount >= 10) {
            triggerScreenShake(0.28, 1.7);
          } else if (state.comboCount >= 5) {
            triggerScreenShake(0.2, 1.9);
          } else if (state.comboCount >= 3 && dmg >= 45) {
            triggerScreenShake(0.12, 2.2);
          }
        } else {
          state.dimaHitFlashTimer = Math.max(state.dimaHitFlashTimer, 0.12);
          spawnFlash(bossModel.root.position.x, 1.7, bossModel.root.position.z, 0x38bdf8, 1.4);
        }
        state.bossHp = Math.max(0, state.bossHp - dmg);
        if (!isRemote) {
          onCoopDamageDealtRef.current?.(dmg, sourceKind);
        }

        // In co-op, Clients mirror visual damage & let Host authoritatively run phase transitions
        if (isCoopClientNow()) {
          state.bossHp = Math.max(1, state.bossHp);
          return;
        }

        // Hardcore Phase 2 transition (6000 HP for Wild Cucumber, 5000 HP for Dima)
        const hcPhase2Threshold = isWildCucumber ? 6000 : 5000;
        if (isHardcore && state.bossPhase === 'PHASE1' && state.bossHp <= hcPhase2Threshold && state.bossHp > 0) {
          state.bossPhase = 'HC_PHASE2';
          state.bossDmgBoost = true;
          if (isWildCucumber) {
            state.wildRegenActive = true;
            state.wildRegenTimer = 2.0;
            state.wildSlamCd = 1.8;
            state.wildJarCd = 3.5;
            state.dimaWireCd = 2.0;
            lastVioletPhase = 'HC_PHASE2';
            seekVioletTo(112, true);
          } else {
            aizoAudio.pause();
            janeAudio.currentTime = 0;
            janeAudio.play().catch(() => {});
          }
          if (state.wildSkewerPhase !== 'IMPALE_CUTSCENE') {
            state.wildSkewerPhase = 'NONE';
            lungeAimGroup.visible = false;
            bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
          }
          soundFX.playArmorBreak();
          soundFX.playRage();
          triggerScreenShake(0.48, 1.25);
          spawnFlash(bossModel.root.position.x, 2.2, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0xf43f5e, 4.0);
          const p2Banner = isWildCucumber
            ? '2-Я ФАЗА WILD ОГУРЦА (6000 HP)! Реген +1 HP/2с · Удар сверху и Бросок банки на цепях · Through Patches of Violet (1:52)!'
            : `2-Я ФАЗА ХАРДКОРА (5000 HP)! Урон ${bossGenitiveName} +20% · Бежит быстрее · Играет Jane!`;
          setBanner(p2Banner, 4.8);
          onCoopBossEventRef.current?.({
            type: 'PHASE_CHANGE',
            bossPhase: 'HC_PHASE2',
            bossHp: state.bossHp,
            dimaStamina: state.dimaStamina,
            bossDmgBoost: true,
            banner: p2Banner,
          });
          return;
        }

        // Wild Cucumber Phase 3 Trigger at <= 2000 HP -> 23s Dimension-Shift 3D Cutscene (IFRAME)!
        if (isWildCucumber && state.bossPhase === 'HC_PHASE2' && state.bossHp <= 2000) {
          state.bossHp = 2000;
          state.bossPhase = 'WILD_PHASE3_INTRO';
          state.wildPhase3IntroTimer = WILD_PHASE3_INTRO_DURATION;
          state.wildCutsceneBeatIdx = -1;
          state.wildCutsceneFlashTimer = 0.25;
          state.wildCutsceneFlashMode = 'PURPLE';
          state.wildDimIdx = 0;
          state.dimaStaggerTimer = 0;
          state.dimaHitFlashTimer = 0;
          state.dimaUltPhase = 'NONE';
          state.dimaDashPhase = 'NONE';
          state.dimaSpinWirePhase = 'NONE';
          state.dimaAbilityGapTimer = 0;
          state.wildSkewerPhase = 'NONE';
          state.wildSlamPhase = 'NONE';
          state.wildJarPhase = 'NONE';
          state.lupikKnifePhase = 'NONE';
          state.playerStunTimer = 0;
          state.dodgeTimer = 0;
          state.playerJumpY = 0;
          state.playerVelY = 0;
          wireSweepGroup.visible = false;
          (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
          lungeAimGroup.visible = false;
          wildSlamRingGroup.visible = false;
          pawSlamRingGroup.visible = false;
          hideJarAndChain();
          impaledSkewerGroup.visible = false;
          viewModelGroup.visible = false;
          knifeGroup.visible = false;
          bossModel.root.visible = true;
          bossModel.upperBodyGroup.visible = true;
          bossModel.upperBodyGroup.position.set(0, 0, 0);
          bossModel.upperBodyGroup.rotation.set(0, 0, 0);
          bossModel.leftLeg.legGroup.position.y = 1.05;
          bossModel.rightLeg.legGroup.position.y = 1.05;
          bossModel.leftLeg.knee.rotation.x = 0;
          bossModel.rightLeg.knee.rotation.x = 0;
          if (bossModel.backJarGroup) bossModel.backJarGroup.visible = true;
          bossModel.bellyWoundGroup.visible = true;
          bossModel.potCrack.visible = true;
          bossModel.root.scale.set(1, 1, 1);
          bossModel.root.position.set(4.3, 0, 0);
          bossModel.root.rotation.set(0, -Math.PI / 2 + 0.34, 0);
          playerPos.set(-4.3, eyeHeight, 0);
          playerAvatar.root.visible = true;
          playerAvatar.root.position.set(-4.3, 0, 0);
          playerAvatar.root.rotation.set(0, Math.PI / 2 - 0.18, 0);
          cutsceneVfxGroup.visible = true;
          ghostPawsGroup.visible = false;
          iliheModel.root.visible = false;
          maksModel.root.visible = false;
          for (const obj of wildFrontOccludingObjs) obj.visible = false;
          if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock?.();
          }
          lastVioletPhase = 'WILD_PHASE3_INTRO';
          seekVioletTo(163, true);
          soundFX.playGlassShatter(false);
          triggerGlassBurst(false, false);
          triggerScreenShake(0.45, 1.3);
          const p3Banner = '3-Я ФАЗА (2000 HP) · РАЗЛОМ ИЗМЕРЕНИЙ! 23с 3D-катсцена (IFRAME)!';
          setBanner(p3Banner, 4.5);
          onCoopBossEventRef.current?.({
            type: 'PHASE_CHANGE',
            bossPhase: 'WILD_PHASE3_INTRO',
            bossHp: 2000,
            dimaStamina: state.dimaStamina,
            bossDmgBoost: state.bossDmgBoost,
            banner: p3Banner,
          });
          return;
        }

        // Wild Cucumber Phase 3 Defeat at 0 HP
        if (isWildCucumber && state.bossPhase === 'WILD_PHASE3' && state.bossHp <= 0) {
          soundFX.playGlassShatter(true);
          triggerGlassBurst(true, false);
          spawnFlash(bossModel.root.position.x, 1.8, bossModel.root.position.z, 0xc084fc, 5.0);
          onCoopBossEventRef.current?.({
            type: 'PHASE_CHANGE',
            bossPhase: 'WON',
            bossHp: 0,
            dimaStamina: 0,
            bossDmgBoost: state.bossDmgBoost,
          });
          finishFight('WON');
          return;
        }

        if (state.bossHp <= 0) {
          // Enter 16s Kneeling Intro Cutscene (Phase 2 in Normal, Phase 3 in Hardcore): start sans v2 immediately!
          state.bossPhase = 'PHASE2_INTRO';
          state.phase2IntroTimer = PHASE2_INTRO_DURATION;
          state.dimaStaggerTimer = 0;
          state.dimaHitFlashTimer = 0;
          state.bossHp = 1;
          state.dimaStamina = DIMA_MAX_STAMINA;
          state.dimaUltPhase = 'NONE';
          state.dimaSisterPhase = 'NONE';
          state.dimaDashPhase = 'NONE';
          state.dimaSpinWirePhase = 'NONE';
          state.wildSkewerPhase = 'NONE';
          state.wildSlamPhase = 'NONE';
          state.wildJarPhase = 'NONE';
          state.playerStunTimer = 0;
          lungeAimGroup.visible = false;
          wildSlamRingGroup.visible = false;
          hideJarAndChain();
          impaledSkewerGroup.visible = false;
          if (state.lupikKnifePhase === 'NONE') {
            viewModelGroup.visible = true;
          }
          bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
          wireSweepGroup.visible = false;
          state.dimaLaserCd = 2.0;
          state.dimaDashCd = 5.5;
          state.dimaSpinWireCd = 4.0;
          sisterModel.visible = false;
          bossModel.root.scale.set(1, 1, 1);
          bossModel.root.position.y = 0;
          bossModel.root.rotation.x = 0;
          (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0;
          (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;

          bossModel.bellyWoundGroup.visible = true;
          bossModel.potCrack.visible = true;

          if (!isWildCucumber) {
            // Visual battle damage for Dima: broken shield + knocked-askew pot helmet + red belly cut!
            bossModel.intactShieldGroup.visible = false;
            bossModel.brokenShieldGroup.visible = true;
            bossModel.potGroup.position.set(0.24, 2.88, -0.14);
            bossModel.potGroup.rotation.set(-0.34, 0.25, -0.68);
            bossModel.rightPotHandle.visible = false;

            // Spawn flying broken shield half & pot handle debris + blood burst
            const brokenHalfDebris = new THREE.Mesh(
              trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 12, 1, false, 0, Math.PI * 0.9)),
              bossModel.lidSteelMat
            );
            brokenHalfDebris.position.set(bossModel.root.position.x - 0.6, 2.1, bossModel.root.position.z);
            scene.add(brokenHalfDebris);
            debrisList.push({
              mesh: brokenHalfDebris,
              vx: -4.2,
              vy: 5.5,
              vz: 2.8,
              rx: 9,
              rz: 7,
              life: 2.6,
            });

            const brokenHandleDebris = new THREE.Mesh(
              trackGeo(new THREE.TorusGeometry(0.12, 0.032, 8, 12)),
              trackMat(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.4 }))
            );
            brokenHandleDebris.position.set(bossModel.root.position.x + 0.5, 3.0, bossModel.root.position.z);
            scene.add(brokenHandleDebris);
            debrisList.push({
              mesh: brokenHandleDebris,
              vx: 4.8,
              vy: 6.2,
              vz: -1.8,
              rx: 12,
              rz: 10,
              life: 2.6,
            });

            spawnBloodBurst(18);
          }

          spawnFlash(bossModel.root.position.x, 2.4, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0xef4444, 3.4);
          soundFX.playArmorBreak();
          triggerScreenShake(0.52, 1.15);
          aizoAudio.pause();
          janeAudio.pause();
          sansAudio.currentTime = 0;
          sansAudio.play().catch(() => {});
          const introBanner = isHardcore
            ? `3-Я ФАЗА ХАРДКОРА! ${bossShortName} на колене (НЕУЯЗВИМ · 16 сек) — играет sans v2!`
            : `2-Я ФАЗА! ${bossShortName} на одном колене (НЕУЯЗВИМ · 16 сек) — играет sans v2!`;
          setBanner(introBanner, 5.0);
          onCoopBossEventRef.current?.({
            type: 'PHASE_CHANGE',
            bossPhase: 'PHASE2_INTRO',
            bossHp: 1,
            dimaStamina: DIMA_MAX_STAMINA,
            bossDmgBoost: state.bossDmgBoost,
            banner: introBanner,
          });
        }
        return;
      }

      if (state.bossPhase === 'LAST_BREATH') {
        if (state.dimaStamina > 0) {
          if (!isRemote) {
            state.comboCount += 1;
            state.maxComboCount = Math.max(state.maxComboCount, state.comboCount);
            state.comboPulseTimer = 0.28;
            soundFX.playComboHit(state.comboCount);
            spawnComboSparks(state.comboCount);
            triggerBossStagger(dmg);
            if (state.comboCount === 10) {
              setBanner('КОМБО x10! Звуковой профиль повышен — ЯРОСТЬ!', 2.2);
            } else if (state.comboCount === 20) {
              setBanner('КОМБО x20! Звуковой профиль УЛЬТРА — максимальный драйв!', 2.5);
            }
            if (dmg >= 90) {
              triggerScreenShake(state.comboCount >= 5 ? 0.46 : 0.36, 1.45);
            } else if (state.comboCount >= 15) {
              triggerScreenShake(0.36, 1.55);
            } else if (state.comboCount >= 10) {
              triggerScreenShake(0.28, 1.7);
            } else if (state.comboCount >= 5) {
              triggerScreenShake(0.2, 1.9);
            }
            onCoopDamageDealtRef.current?.(dmg, sourceKind);
          } else {
            state.dimaHitFlashTimer = Math.max(state.dimaHitFlashTimer, 0.12);
            spawnFlash(bossModel.root.position.x, 1.7, bossModel.root.position.z, 0x38bdf8, 1.4);
          }

          if (isCoopClientNow()) {
            state.dimaStamina = Math.max(1, state.dimaStamina - 10);
            state.dimaDodgeAnim = 0.34;
            return;
          }

          // Boss dodges and loses 10 stamina!
          state.dimaStamina = Math.max(0, state.dimaStamina - 10);
          state.dimaDodgeAnim = 0.34;
          state.dimaDodgeDir = state.dimaDodgeDir === 1 ? -1 : 1;

          const oldX = bossModel.root.position.x;
          const oldZ = bossModel.root.position.z;
          spawnFlash(oldX, 1.6, oldZ, isWildCucumber ? 0xc084fc : 0x38bdf8, 2.0);

          const dodgeTarget = getBossTarget();
          const toPlayerX = dodgeTarget.x - oldX;
          const toPlayerZ = dodgeTarget.z - oldZ;
          const len = Math.hypot(toPlayerX, toPlayerZ) || 1;
          const perpX = (-toPlayerZ / len) * state.dimaDodgeDir;
          const perpZ = (toPlayerX / len) * state.dimaDodgeDir;
          if (!isTraining) {
            bossModel.root.position.x = THREE.MathUtils.clamp(oldX + perpX * 2.4, -12.2, 12.2);
            bossModel.root.position.z = THREE.MathUtils.clamp(oldZ + perpZ * 2.4, -13.0, 13.0);
          }

          soundFX.playQtePrompt();
          if (state.dimaStamina <= 0) {
            state.bossPhase = 'EXHAUSTED';
            state.dimaStaggerTimer = 0;
            state.dimaHitFlashTimer = 0;
            state.dimaUltPhase = 'NONE';
            state.dimaSisterPhase = 'NONE';
            state.dimaDashPhase = 'NONE';
            state.dimaSpinWirePhase = 'NONE';
            wireSweepGroup.visible = false;
            sisterModel.visible = false;
            bossModel.root.scale.set(1, 1, 1);
            (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0;
            (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
            for (const l of skyLasers) {
              scene.remove(l.ring);
              scene.remove(l.aimLine);
              scene.remove(l.beam);
            }
            skyLasers.length = 0;
            // Stop Phase 2/3 song once boss only needs the stomp finisher!
            sansAudio.pause();
            janeAudio.pause();
            aizoAudio.pause();
            soundFX.playBossHit();
            triggerScreenShake(0.48, 1.25);
            const exBanner = `СТАМИНА ${isWildCucumber ? 'WILD ОГУРЦА' : 'ДИМЫ'} ЗАКОНЧИЛАСЬ (0 / ${DIMA_MAX_STAMINA})! Подходи или нажми [F] — ВТОПЧИ ЕГО НОГОЙ!`;
            setBanner(exBanner, 6);
            onCoopBossEventRef.current?.({
              type: 'PHASE_CHANGE',
              bossPhase: 'EXHAUSTED',
              bossHp: state.bossHp,
              dimaStamina: 0,
              bossDmgBoost: state.bossDmgBoost,
              banner: exBanner,
            });
          } else {
            setBanner(`УКЛОНЕНИЕ! -10 стамины у ${bossGenitiveName} (${state.dimaStamina} / ${DIMA_MAX_STAMINA})`, 1.4);
          }
        }
        return;
      }

      if (state.bossPhase === 'EXHAUSTED') {
        setBanner(`${bossShortName} выдохся на 1 HP! Нажми [F] или кнопку «ДОБИТЬ НОГОЙ»!`, 2.4);
      }
    };

    actionsRef.current = {
      triggerPrimary,
      triggerAbility1,
      triggerUlt,
      triggerJump,
      triggerDodgeDash,
      triggerMinion1,
      triggerMinion2,
      triggerStompFinisher,
    };

    // First-person input listeners (PointerLock + drag/keyboard look fallback)
    const keys: Record<string, boolean> = {};
    let isDragging = false;

    const onKeyDown = (e: KeyboardEvent) => {
      ensureActiveMusicPlaying();
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (e.code === 'KeyN' || k === 'n' || k === 'т') {
        e.preventDefault();
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock?.();
          setBanner('Мышка разблокирована [N] — регулируй громкость справа сверху или кликни по арене!', 2.8);
        } else {
          renderer.domElement.requestPointerLock?.();
        }
        return;
      }
      if (state.bossPhase === 'EXHAUSTED' && (e.code === 'KeyF' || k === 'f' || k === 'а' || k === 'e' || k === 'у')) {
        e.preventDefault();
        triggerStompFinisher();
        return;
      }
      if (e.code === 'KeyF' || k === 'f' || k === 'а') {
        e.preventDefault();
        triggerDodgeDash();
      } else if (e.code === 'Space' || k === ' ') {
        e.preventDefault();
        triggerJump();
      } else if (k === 'q' || k === 'й') {
        e.preventDefault();
        triggerUlt();
      } else if (k === '1') {
        triggerAbility1();
      } else if (k === '2') {
        if (fighter === 'LUPIK') {
          triggerAbility1();
        } else {
          triggerPrimary();
        }
      } else if (k === '3') {
        triggerMinion1();
      } else if (k === '4') {
        triggerMinion2();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isSideView()) return;
      if (document.pointerLockElement === renderer.domElement || isDragging) {
        yaw -= e.movementX * 0.0028;
        pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0024, -0.55, 0.68);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      ensureActiveMusicPlaying();
      if (e.button === 0) {
        if (state.bossPhase === 'EXHAUSTED') {
          const d = Math.hypot(playerPos.x - bossModel.root.position.x, playerPos.z - bossModel.root.position.z);
          if (d < 5.5) {
            triggerStompFinisher();
            return;
          }
        }
        if (document.pointerLockElement !== renderer.domElement) {
          renderer.domElement.requestPointerLock?.();
        }
        isDragging = true;
        triggerPrimary();
      } else if (e.button === 2) {
        triggerAbility1();
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onPointerLockChange = () => {
      state.pointerLocked = document.pointerLockElement === renderer.domElement;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1080;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let lastTime = performance.now();
    let hudSyncAcc = 0;
    let coopSyncAcc = 0.06;
    let clientBossSyncedOnce = false;
    let clientBossMissingTimer = 0;
    let clientBossMissingWarned = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const syncState = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (syncState === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const nowSec = now / 1000;
      let localMovingNow = false;

      if (state.outcome === 'ACTIVE') {
        if (pendingRemoteHitsRef.current.length > 0) {
          const hits = pendingRemoteHitsRef.current.splice(0, pendingRemoteHitsRef.current.length);
          for (const h of hits) {
            applyBossHit(h.amount, 'SHELL', true);
          }
          const last = hits[hits.length - 1];
          if (last && !state.banner) {
            setBanner(`КООП: ${last.attackerName} нанёс -${last.amount} HP!`, 1.4);
          }
        }
        state.primaryCd = Math.max(0, state.primaryCd - dt);
        state.ability1Cd = Math.max(0, state.ability1Cd - dt);
        state.ultCd = Math.max(0, state.ultCd - dt);
        state.minion1Cd = Math.max(0, state.minion1Cd - dt);
        state.minion2Cd = Math.max(0, state.minion2Cd - dt);
        state.rageLeft = Math.max(0, state.rageLeft - dt);
        state.radarLeft = Math.max(0, state.radarLeft - dt);
        state.artemArmorLeft = Math.max(0, state.artemArmorLeft - dt);
        state.artemSlowLeft = Math.max(0, state.artemSlowLeft - dt);

        if (state.maksBuffLeft > 0) {
          state.maksBuffLeft = Math.max(0, state.maksBuffLeft - dt);
          state.maksRegenTickTimer -= dt;
          if (state.maksRegenTickTimer <= 0) {
            state.maksRegenTickTimer += 2.0;
            if (state.playerHp < maxPlayerHp) {
              state.playerHp = Math.min(maxPlayerHp, state.playerHp + 1);
            }
          }
        }
        if (isWildCucumber && state.wildRegenActive) {
          state.wildRegenTimer -= dt;
          if (state.wildRegenTimer <= 0) {
            state.wildRegenTimer += 2.0;
            if (state.playerHp < maxPlayerHp) {
              state.playerHp = Math.min(maxPlayerHp, state.playerHp + 1);
            }
          }
        }
        state.playerStunTimer = Math.max(0, state.playerStunTimer - dt);
        state.recoilKick = Math.max(0, state.recoilKick - dt * 5);
        state.eatAnim = Math.max(0, state.eatAnim - dt * 2.5);
        state.healFlashTimer = Math.max(0, state.healFlashTimer - dt);
        state.damageFlashTimer = Math.max(0, state.damageFlashTimer - dt);
        state.dodgeTimer = Math.max(0, state.dodgeTimer - dt);
        state.dodgeIframeTimer = Math.max(0, state.dodgeIframeTimer - dt);
        state.playerEnergy = Math.min(PLAYER_MAX_ENERGY, state.playerEnergy + PLAYER_ENERGY_REGEN_PER_SEC * dt);
        state.dimaDodgeAnim = Math.max(0, state.dimaDodgeAnim - dt);
        state.dimaStaggerTimer = Math.max(0, state.dimaStaggerTimer - dt);
        state.dimaHitFlashTimer = Math.max(0, state.dimaHitFlashTimer - dt);
        state.comboPulseTimer = Math.max(0, state.comboPulseTimer - dt);
        state.playerAttackAnim = Math.max(0, state.playerAttackAnim - dt * 3.8);

        if (state.wildCutsceneFlashTimer > 0) {
          state.wildCutsceneFlashTimer = Math.max(0, state.wildCutsceneFlashTimer - dt);
          if (state.wildCutsceneFlashTimer <= 0) {
            state.wildCutsceneFlashMode = 'NONE';
            renderer.domElement.style.filter = '';
          }
        }

        // Strict phase-window looping for Through Patches of Violet (guarded against re-seeking during active seek)
        if (isWildCucumber && state.outcome === 'ACTIVE') {
          if (state.bossPhase !== lastVioletPhase) {
            lastVioletPhase = state.bossPhase;
            const [nextStart] = getVioletLoopRange(state.bossPhase);
            seekVioletTo(nextStart, true);
          } else if (
            !violetAudio.paused &&
            !violetAudio.seeking &&
            violetAudio.readyState >= 1 &&
            pendingVioletSeek === null &&
            performance.now() - lastVioletSeekAt > 800
          ) {
            const [vStart, vEnd] = getVioletLoopRange(state.bossPhase);
            if (state.bossPhase === 'WILD_PHASE3_INTRO') {
              const expectedT = 163 + (WILD_PHASE3_INTRO_DURATION - Math.max(0, state.wildPhase3IntroTimer));
              if (violetAudio.currentTime < 161.5 || violetAudio.currentTime >= 186.0) {
                seekVioletTo(THREE.MathUtils.clamp(expectedT, 163, 185.8), true);
              }
            } else if (violetAudio.currentTime >= vEnd || violetAudio.currentTime < vStart - 1.5) {
              seekVioletTo(vStart, true);
            }
          }
        }

        if (state.dimaHitFlashTimer > 0) {
          const flashRatio = state.dimaHitFlashTimer / Math.max(0.01, state.dimaHitFlashDuration);
          const intensity = flashRatio * 0.9;
          bossModel.hoodieMat.emissive.setHex(state.dimaHitFlashColor);
          bossModel.hoodieMat.emissiveIntensity = intensity;
          bossModel.hoodieFrontMat.emissive.setHex(state.dimaHitFlashColor);
          bossModel.hoodieFrontMat.emissiveIntensity = intensity;
          bossModel.potWhiteMat.emissive.setHex(state.dimaHitFlashColor);
          bossModel.potWhiteMat.emissiveIntensity = intensity * 0.55;
        } else {
          if (isWildCucumber) {
            bossModel.hoodieMat.emissive.setHex(0x0f4719);
            bossModel.hoodieMat.emissiveIntensity = 0.34;
          } else {
            bossModel.hoodieMat.emissiveIntensity = 0;
          }
          bossModel.hoodieFrontMat.emissiveIntensity = 0;
          bossModel.potWhiteMat.emissiveIntensity = 0;
        }

        if (state.bannerTimer > 0) {
          state.bannerTimer -= dt;
          if (state.bannerTimer <= 0) state.banner = '';
        }
        if (state.commanderTimer > 0) {
          state.commanderTimer -= dt;
          if (state.commanderTimer <= 0) binocGroup.visible = false;
        }

        if (state.bossPhase === 'STOMPING') {
          knifeGroup.visible = false;
          impaledSkewerGroup.visible = false;
          lungeAimGroup.visible = false;
          wildSlamRingGroup.visible = false;
          hideJarAndChain();
          wireSweepGroup.visible = false;
          state.dimaSpinWirePhase = 'NONE';
          state.lupikKnifePhase = 'NONE';
          state.wildSkewerPhase = 'NONE';
          state.wildSlamPhase = 'NONE';
          state.wildJarPhase = 'NONE';
          state.playerStunTimer = 0;
          // Cinematic 1st-person Stomp Finisher!
          state.stompAnimTimer += dt;
          const t = state.stompAnimTimer;
          const bx = bossModel.root.position.x;
          const bz = bossModel.root.position.z;

          const dx = bx - playerPos.x;
          const dz = bz - playerPos.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist > 1.65) {
            playerPos.x += (dx / dist) * Math.min(dist - 1.65, 16 * dt);
            playerPos.z += (dz / dist) * Math.min(dist - 1.65, 16 * dt);
          }
          const targetYaw = Math.atan2(-dx, -dz);
          yaw += (targetYaw - yaw) * Math.min(1, dt * 10);
          pitch += (-0.52 - pitch) * Math.min(1, dt * 8);

          // Boot lift (0..0.42s) -> heavy stomp down (0.42..0.62s) -> hold
          if (t < 0.42) {
            const up = t / 0.42;
            stompBootGroup.position.set(0.04, THREE.MathUtils.lerp(-0.45, 0.28, up), -0.85);
            stompBootGroup.rotation.x = THREE.MathUtils.lerp(0.2, -0.3, up);
          } else if (t < 0.62) {
            const down = (t - 0.42) / 0.2;
            stompBootGroup.position.set(0.04, THREE.MathUtils.lerp(0.28, -0.58, down), -0.82);
            stompBootGroup.rotation.x = THREE.MathUtils.lerp(-0.3, 0.15, down);
          } else {
            stompBootGroup.position.set(0.04, -0.58, -0.82);
            stompBootGroup.rotation.x = 0.15;
            if (!state.stompImpactDone) {
              state.stompImpactDone = true;
              state.comboCount += 1;
              state.maxComboCount = Math.max(state.maxComboCount, state.comboCount);
              state.comboPulseTimer = 0.35;
              soundFX.playComboHit(state.comboCount);
              spawnComboSparks(state.comboCount);
              state.bossHp = 0;
              soundFX.playBellySlam();
              triggerScreenShake(0.55, 1.1);
              spawnFlash(bx, 0.5, bz, 0xfbbf24, 3.8);
              bossModel.root.position.y = 0;
              bossModel.root.rotation.x = Math.PI * 0.45;
              bossModel.root.scale.set(1.32, 0.2, 1.32);
            }
          }

          camera.position.set(playerPos.x, playerPos.y, playerPos.z);
          camera.rotation.order = 'YXZ';
          camera.rotation.y = yaw;
          camera.rotation.x = pitch;

          if (t >= 1.85) {
            stompBootGroup.visible = false;
            finishFight('WON');
          }
        } else {
          if (state.wildSkewerPhase === 'IMPALE_CUTSCENE') {
            // 5-second IFRAME Cutscene: Wild Cucumber impales player through with skewer, deals 25 DMG, lifts & kicks off!
            state.wildImpaleElapsed += dt;
            const t = state.wildImpaleElapsed;
            const sideView = isSideView();
            viewModelGroup.visible = false;
            knifeGroup.visible = false;
            lungeAimGroup.visible = false;
            playerAvatar.root.visible = sideView;
            state.playerJumpY = 0;
            state.playerVelY = 0;

            const kdx = state.wildImpaleKickDirX;
            const kdz = state.wildImpaleKickDirZ;
            const bx = state.wildImpaleBossX;
            const bz = state.wildImpaleBossZ;

            bossModel.root.position.set(bx, 0, bz);
            bossModel.root.rotation.set(0, Math.atan2(kdx, kdz), 0);
            bossModel.upperBodyGroup.position.set(0, 0, 0);
            bossModel.leftLeg.legGroup.position.y = 1.05;
            bossModel.leftLeg.legGroup.rotation.x = -0.35;
            bossModel.leftLeg.knee.rotation.x = 0.35;

            if (t < 3.85) {
              // Lock player onto skewer 1.62m directly in front of boss
              const targetPx = THREE.MathUtils.clamp(bx + kdx * 1.62, -12.8, 12.8);
              const targetPz = THREE.MathUtils.clamp(bz + kdz * 1.62, -13.5, 13.5);
              playerPos.x += (targetPx - playerPos.x) * Math.min(1, dt * 16);
              playerPos.z += (targetPz - playerPos.z) * Math.min(1, dt * 16);

              impaledSkewerGroup.visible = !sideView;
              impaledSkewerGroup.position.set(
                0.02 + Math.sin(t * 22) * 0.005,
                -0.21 + Math.cos(t * 19) * 0.006,
                -0.48
              );
              impaledSkewerGroup.rotation.set(-0.22, 0.06, 0.08 + Math.sin(t * 15) * 0.02);

              if (t >= 0.22 && !state.wildImpaleDmgDone) {
                state.wildImpaleDmgDone = true;
                const impaleDmg = 24;
                const hadCombo = state.comboCount > 0;
                state.playerHp = Math.max(0, state.playerHp - impaleDmg);
                state.comboCount = 0;
                if (hadCombo) soundFX.playComboBreak();
                state.damageFlashTimer = 0.65;
                triggerScreenShake(0.55, 1.2);
                soundFX.playKnifeSlash();
                soundFX.playBossHit();
                spawnFlash(playerPos.x, 1.4, playerPos.z, 0x991b1b, 2.5);
                setBanner(
                  `ПРОНЗЁН НАСКВОЗЬ! Wild Огурец проткнул тебя шампуром (-${impaleDmg} HP · IFRAME 5с)!`,
                  3.5
                );
                if (state.playerHp <= 0) {
                  impaledSkewerGroup.visible = false;
                  viewModelGroup.visible = !sideView;
                  state.wildSkewerPhase = 'NONE';
                  finishFight('LOST');
                }
              }

              // Lift player up (0.9..3.1s), then lower & cock leg for kick (3.1..3.85s)
              let lift = 0;
              if (t >= 0.9 && t < 3.1) {
                lift = Math.min(1, (t - 0.9) / 1.1);
              } else if (t >= 3.1) {
                lift = Math.max(0, 1 - (t - 3.1) / 0.65);
              }

              bossModel.rightArm.rotation.set(THREE.MathUtils.lerp(0.95, 1.32, lift), 0.12, 0);
              bossModel.leftArm.rotation.set(0.25, 0, -0.18);
              bossModel.upperBodyGroup.rotation.set(-0.1 * lift, 0, 0);
              bossModel.skewerGroup?.rotation.set(0.68, 0, 0);

              if (t >= 3.1) {
                const kickWindP = Math.min(1, (t - 3.1) / 0.72);
                bossModel.rightLeg.legGroup.rotation.x = THREE.MathUtils.lerp(0, 0.78, kickWindP);
                bossModel.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(0, 0.92, kickWindP);
              } else {
                bossModel.rightLeg.legGroup.rotation.x = 0.15;
                bossModel.rightLeg.knee.rotation.x = 0.1;
              }

              if (sideView) {
                playerAvatar.root.position.set(playerPos.x, lift * 0.62, playerPos.z);
                playerAvatar.root.rotation.set(0, Math.atan2(bx - playerPos.x, bz - playerPos.z), 0);
                const camX = (playerPos.x + bx) * 0.5;
                camera.position.set(camX, 2.65, 12.2);
                camera.lookAt(camX, 1.85, 0);
              } else {
                const lookDx = bx - playerPos.x;
                const lookDz = bz - playerPos.z;
                const targetYaw = Math.atan2(-lookDx, -lookDz);
                yaw += (targetYaw - yaw) * Math.min(1, dt * 16);
                pitch += (0.14 + lift * 0.08 - pitch) * Math.min(1, dt * 12);
                camera.position.set(playerPos.x, playerPos.y + lift * 0.54, playerPos.z);
                camera.rotation.order = 'YXZ';
                camera.rotation.y = yaw;
                camera.rotation.x = pitch;
              }
            } else {
              // 3.85s .. 5.0s: Kick off the skewer + knockback push!
              if (!state.wildImpaleKickDone) {
                state.wildImpaleKickDone = true;
                impaledSkewerGroup.visible = false;
                state.wildImpaleStartPlayerX = playerPos.x;
                state.wildImpaleStartPlayerZ = playerPos.z;
                soundFX.playBellySlam();
                soundFX.playBossDash();
                triggerScreenShake(0.55, 1.35);
                spawnFlash(playerPos.x, 1.35, playerPos.z, 0xc084fc, 2.6);
                setBanner('ПИНОК! Wild Огурец отталкивает тебя с шампура ногой!', 2.0);
              }

              const kickP = Math.min(1, (t - 3.85) / 1.15);
              const easeOut = 1 - Math.pow(1 - kickP, 2);
              const swingLegP = Math.min(1, (t - 3.85) / 0.25);
              bossModel.rightLeg.legGroup.rotation.x = THREE.MathUtils.lerp(0.78, -1.42, swingLegP);
              bossModel.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(0.92, 0.08, swingLegP);
              bossModel.rightArm.rotation.set(THREE.MathUtils.lerp(0.95, -0.25, Math.min(1, kickP * 2)), 0, 0);
              bossModel.upperBodyGroup.rotation.set(-0.22 * (1 - kickP), 0, 0);
              bossModel.skewerGroup?.rotation.set(0.72, 0, 0);

              playerPos.x = THREE.MathUtils.clamp(state.wildImpaleStartPlayerX + kdx * 7.5 * easeOut, -12.8, 12.8);
              playerPos.z = THREE.MathUtils.clamp(
                state.wildImpaleStartPlayerZ + kdz * 7.5 * easeOut,
                sideView ? -7.5 : -13.5,
                sideView ? 7.5 : 13.5
              );
              const hopY = Math.sin(kickP * Math.PI) * 0.62;
              if (sideView) {
                playerAvatar.root.position.set(playerPos.x, hopY, playerPos.z);
                playerAvatar.root.rotation.set(0, Math.atan2(bx - playerPos.x, bz - playerPos.z), 0);
                const camX = (playerPos.x + bx) * 0.5;
                camera.position.set(camX, 2.65, 12.6);
                camera.lookAt(camX, 1.85, 0);
              } else {
                pitch += (-0.04 - pitch) * Math.min(1, dt * 8);
                camera.position.set(playerPos.x, playerPos.y + hopY, playerPos.z);
                camera.rotation.order = 'YXZ';
                camera.rotation.y = yaw;
                camera.rotation.x = pitch;
              }
            }

            if (t >= 5.0 && state.outcome === 'ACTIVE') {
              state.wildSkewerPhase = 'NONE';
              state.wildSkewerLungeCd = state.bossPhase === 'PHASE1' ? 10.5 : 9.0;
              state.wildSkewerSwingCd = Math.max(state.wildSkewerSwingCd, 1.6);
              state.dimaAbilityGapTimer = 1.4;
              state.dodgeIframeTimer = 0.35;
              impaledSkewerGroup.visible = false;
              viewModelGroup.visible = !sideView;
              bossModel.rightLeg.legGroup.rotation.x = 0;
              bossModel.rightLeg.knee.rotation.x = 0;
              bossModel.leftLeg.legGroup.rotation.x = 0;
              bossModel.leftLeg.knee.rotation.x = 0;
              bossModel.upperBodyGroup.rotation.set(0, 0, 0);
              bossModel.rightArm.rotation.set(0, 0, 0);
              bossModel.leftArm.rotation.set(0, 0, 0);
              bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
              setBanner('Бой продолжается!', 1.5);
            }
          } else if (state.lupikKnifePhase !== 'NONE') {
            // Enraged Gilbert Knife Sprint + Belly Slash Animation!
            const bx = bossModel.root.position.x;
            const bz = bossModel.root.position.z;
            const dx = bx - playerPos.x;
            const dz = bz - playerPos.z;
            const dist = Math.hypot(dx, dz) || 1;
            const sideView = isSideView();
            const targetYaw = Math.atan2(-dx, -dz);
            yaw += (targetYaw - yaw) * Math.min(1, dt * 14);
            pitch += (-0.08 - pitch) * Math.min(1, dt * 12);

            state.lupikKnifeTimer -= dt;
            if (sideView) {
              viewModelGroup.visible = false;
              knifeGroup.visible = false;
              playerAvatar.root.visible = true;
            }

            if (state.lupikKnifePhase === 'CHARGING') {
              const runSpeed = 26;
              if (dist > 2.25) {
                playerPos.x = THREE.MathUtils.clamp(playerPos.x + (dx / dist) * runSpeed * dt, -12.8, 12.8);
                playerPos.z = THREE.MathUtils.clamp(
                  playerPos.z + (dz / dist) * runSpeed * dt,
                  sideView ? -7.5 : -13.5,
                  sideView ? 7.5 : 13.5
                );
              }
              if (sideView) {
                playerAvatar.root.position.set(playerPos.x, Math.abs(Math.sin(nowSec * 24)) * 0.14, playerPos.z);
                playerAvatar.root.rotation.set(0, Math.atan2(dx, dz), 0);
                playerAvatar.leftLeg.legGroup.rotation.x = Math.sin(nowSec * 24) * 0.7;
                playerAvatar.rightLeg.legGroup.rotation.x = -Math.sin(nowSec * 24) * 0.7;
                playerAvatar.rightArm.rotation.set(-0.9, 0, 0);
              } else {
                camera.position.set(
                  playerPos.x,
                  playerPos.y + Math.sin(nowSec * 28) * 0.08,
                  playerPos.z
                );
                knifeGroup.position.set(
                  0.24 + Math.sin(nowSec * 24) * 0.04,
                  -0.16 + Math.abs(Math.cos(nowSec * 24)) * 0.06,
                  -0.46
                );
                knifeGroup.rotation.set(0.35, 0.25, -0.2);
              }

              if (dist <= 2.35 || state.lupikKnifeTimer <= 0) {
                state.lupikKnifePhase = 'SLASHING';
                state.lupikKnifeTimer = 0.55;
                state.lupikKnifeHitDone = false;
              }
            } else {
              // SLASHING across boss belly!
              const slashProgress = 1 - Math.max(0, state.lupikKnifeTimer) / 0.55;
              const swing = Math.sin(slashProgress * Math.PI);
              if (sideView) {
                playerAvatar.root.position.set(playerPos.x, 0, playerPos.z);
                playerAvatar.root.rotation.set(0, Math.atan2(dx, dz), 0);
                playerAvatar.rightArm.rotation.set(-1.5 + slashProgress * 2.3, 0, 0);
              } else {
                knifeGroup.position.set(
                  THREE.MathUtils.lerp(0.36, -0.34, slashProgress),
                  THREE.MathUtils.lerp(0.06, -0.28, slashProgress),
                  -0.42 - swing * 0.22
                );
                knifeGroup.rotation.set(0.25 - swing * 0.4, 0.6 - slashProgress * 1.4, -0.9 + slashProgress * 1.6);
                camera.position.set(playerPos.x, playerPos.y, playerPos.z);
              }

              if (!state.lupikKnifeHitDone && slashProgress >= 0.35) {
                state.lupikKnifeHitDone = true;
                soundFX.playKnifeSlash();
                spawnFlash(bx, 1.5, bz, 0xef4444, 2.8);
                const knifeDmg = state.maksBuffLeft > 0 ? 110 : 100;
                applyBossHit(knifeDmg, 'KNIFE');
                state.playerHp = Math.min(maxPlayerHp, state.playerHp + 30);
                state.healFlashTimer = 0.65;
                soundFX.playFruitEat();
                setBanner(
                  `ЧИК! Разъярённый Гилберт полоснул ${bossGenitiveName} (-${knifeDmg} DMG) и захилился (+30 HP)!`,
                  2.8
                );
              }

              if (state.lupikKnifeTimer <= 0) {
                state.lupikKnifePhase = 'NONE';
                knifeGroup.visible = false;
                viewModelGroup.visible = !sideView;
              }
            }

            if (sideView) {
              const camX = (playerPos.x + bx) * 0.5;
              camera.position.set(camX, 2.65, 12.2);
              camera.lookAt(camX, 1.85, 0);
            } else {
              camera.rotation.order = 'YXZ';
              camera.rotation.y = yaw;
              camera.rotation.x = pitch;
            }
          } else if (state.bossPhase === 'WILD_PHASE3_INTRO') {
            // 23-second Live 3D Dimension-Shift Cutscene (camera set inside WILD_PHASE3_INTRO block below)
          } else {
            const sideView = isSideView();
            if (sideView) {
              viewModelGroup.visible = false;
              playerAvatar.root.visible = true;
              for (const obj of wildFrontOccludingObjs) obj.visible = false;
            } else {
              playerAvatar.root.visible = false;
              viewModelGroup.visible = true;
            }

            // Normal Active Controls (1st-person or Side-Profile in Phase 3, locked during Stun or Jar Chain Pull/Push)
            if (!sideView) {
              if (keys['arrowleft']) yaw += 2.2 * dt;
              if (keys['arrowright']) yaw -= 2.2 * dt;
              if (keys['arrowup']) pitch = Math.min(0.68, pitch + 1.4 * dt);
              if (keys['arrowdown']) pitch = Math.max(-0.55, pitch - 1.4 * dt);
            }

            const movementLocked =
              state.playerStunTimer > 0 ||
              state.wildJarPhase === 'JAR_PULL' ||
              state.wildJarPhase === 'JAR_PUSH';

            const fwdInput = movementLocked ? 0 : (keys['w'] || keys['ц'] ? 1 : 0) - (keys['s'] || keys['ы'] ? 1 : 0);
            const strafeInput = movementLocked ? 0 : (keys['d'] || keys['в'] ? 1 : 0) - (keys['a'] || keys['ф'] ? 1 : 0);

            let speed = fighter === 'LUPIK' ? 8.6 : fighter === 'EGOR' ? 7.2 : isKingTiger ? 5.8 : 6.8;
            if (state.rageLeft > 0) speed *= 1.55;

            if (sideView) {
              _forward.set(0, 0, -1);
              _right.set(1, 0, 0);
            } else {
              _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
              _right.crossVectors(_forward, _up).normalize();
            }

            const zMin = sideView ? -7.5 : -13.5;
            const zMax = sideView ? 7.5 : 13.5;

            if (!movementLocked) {
              if (state.dodgeTimer > 0) {
                localMovingNow = true;
                const dashRatio = state.dodgeTimer / PLAYER_DASH_DURATION;
                const dashSpeed = 23.0 * (0.65 + 0.35 * dashRatio);
                playerPos.x = THREE.MathUtils.clamp(playerPos.x + state.dodgeDirX * dashSpeed * dt, -12.8, 12.8);
                playerPos.z = THREE.MathUtils.clamp(playerPos.z + state.dodgeDirZ * dashSpeed * dt, zMin, zMax);
              } else if (fwdInput !== 0 || strafeInput !== 0) {
                localMovingNow = true;
                _vec3
                  .set(0, 0, 0)
                  .addScaledVector(_forward, fwdInput)
                  .addScaledVector(_right, strafeInput)
                  .normalize()
                  .multiplyScalar(speed * dt);
                playerPos.x = THREE.MathUtils.clamp(playerPos.x + _vec3.x, -12.8, 12.8);
                playerPos.z = THREE.MathUtils.clamp(playerPos.z + _vec3.z, zMin, zMax);
              }
            }

            const targetFov = sideView ? 58 : state.dodgeTimer > 0 ? 78 : 72;
            if (Math.abs(camera.fov - targetFov) > 0.05) {
              camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
              camera.updateProjectionMatrix();
            }

            // Player Jump physics ([Space])
            if (state.playerJumpY > 0 || state.playerVelY > 0) {
              state.playerJumpY += state.playerVelY * dt;
              state.playerVelY -= 24.0 * dt;
              if (state.playerJumpY <= 0) {
                state.playerJumpY = 0;
                state.playerVelY = 0;
                state.jumpClearedWireNotified = false;
              }
            }

            const pushHopY =
              state.wildJarPhase === 'JAR_PUSH'
                ? Math.sin((1 - Math.max(0, state.wildJarTimer) / 0.52) * Math.PI) * 0.55
                : 0;

            if (sideView) {
              const bx = bossModel.root.position.x;
              const bz = bossModel.root.position.z;
              const isMoving = !movementLocked && (fwdInput !== 0 || strafeInput !== 0 || state.dodgeTimer > 0);
              const stride = isMoving ? Math.sin(nowSec * 14) : 0;
              playerAvatar.root.position.set(playerPos.x, state.playerJumpY + pushHopY, playerPos.z);
              playerAvatar.root.rotation.set(0, Math.atan2(bx - playerPos.x, bz - playerPos.z), 0);
              playerAvatar.leftLeg.legGroup.rotation.x = stride * 0.55;
              playerAvatar.rightLeg.legGroup.rotation.x = -stride * 0.55;
              playerAvatar.leftLeg.knee.rotation.x = Math.max(0, -stride * 0.4);
              playerAvatar.rightLeg.knee.rotation.x = Math.max(0, stride * 0.4);
              playerAvatar.rightArm.rotation.set(
                -0.25 - state.playerAttackAnim * 0.55 + stride * 0.16,
                0,
                0
              );
              playerAvatar.leftArm.rotation.set(-stride * 0.2, 0, 0);

              const spanX = Math.abs(bx - playerPos.x);
              const camX = THREE.MathUtils.clamp((playerPos.x + bx) * 0.5, -5.5, 5.5);
              const camZ = Math.max(13.2, spanX * 0.72 + 9.4);
              camera.position.set(camX, 2.65, camZ);
              camera.lookAt(camX, 1.75, (playerPos.z + bz) * 0.25);
            } else {
              const headBob =
                !movementLocked && state.playerJumpY <= 0.001 && state.dodgeTimer <= 0 && (fwdInput !== 0 || strafeInput !== 0)
                  ? Math.sin(nowSec * 11) * 0.045
                  : 0;
              camera.position.set(
                playerPos.x,
                playerPos.y + state.playerJumpY + pushHopY + headBob,
                playerPos.z
              );
              camera.rotation.order = 'YXZ';
              camera.rotation.y = yaw;
              camera.rotation.x = pitch + (state.eatAnim > 0 ? Math.sin(state.eatAnim * Math.PI * 3) * 0.05 : 0);

              viewModelGroup.position.set(
                0,
                (state.playerJumpY <= 0.001 && state.dodgeTimer <= 0 && (fwdInput !== 0 || strafeInput !== 0)
                  ? Math.sin(nowSec * 11) * 0.015
                  : 0) -
                  state.recoilKick * 0.03,
                state.recoilKick * 0.14
              );
              viewModelGroup.rotation.x = state.recoilKick * 0.18;
              if (fighter === 'EGOR' && egorSkewerGroup && egorCucumberGroup) {
                const showSkewer = state.shashlik > 0;
                egorSkewerGroup.visible = showSkewer;
                egorCucumberGroup.visible = !showSkewer;
              }
            }
          }

          // Radar highlight on Boss Dima
          const rRingMat = bossModel.radarRing.material as THREE.MeshBasicMaterial;
          const rBeamMat = bossModel.radarBeam.material as THREE.MeshBasicMaterial;
          if (state.radarLeft > 0) {
            rRingMat.opacity = 0.75 + Math.sin(nowSec * 8) * 0.2;
            rBeamMat.opacity = 0.16 + Math.sin(nowSec * 6) * 0.05;
          } else {
            rRingMat.opacity = 0;
            rBeamMat.opacity = 0;
          }

          // Active Minion AI (ИЛИХЕ or МАКС-индюк)
          if (minion === 'ILIHE') {
            if (state.iliheSlamState === 'CHARGING') {
              state.iliheSlamTimer -= dt;
              const bdx = bossModel.root.position.x - iliheModel.root.position.x;
              const bdz = bossModel.root.position.z - iliheModel.root.position.z;
              const dist = Math.hypot(bdx, bdz) || 1;
              iliheModel.root.rotation.y = Math.atan2(bdx, bdz);
              iliheModel.root.position.x += (bdx / dist) * 14 * dt;
              iliheModel.root.position.z += (bdz / dist) * 14 * dt;
              iliheModel.root.position.y = Math.abs(Math.sin(nowSec * 14)) * 0.45;
              iliheModel.bellyGroup.scale.set(1.45, 1.25, 1.55);

              if (dist < 1.85 || state.iliheSlamTimer <= 0) {
                state.iliheSlamState = 'IDLE';
                iliheModel.root.position.y = 0;
                iliheModel.bellyGroup.scale.set(1, 1, 1);
                soundFX.playBellySlam();
                spawnFlash(bossModel.root.position.x, 1.4, bossModel.root.position.z, 0xfbbf24, 3.2);
                const dmg = state.radarLeft > 0 ? 120 : 100;
                applyBossHit(dmg, 'BELLY');
              }
            } else {
              const targetIx = THREE.MathUtils.clamp(playerPos.x - _right.x * 2.4 + _forward.x * 2.5, -12, 12);
              const targetIz = THREE.MathUtils.clamp(playerPos.z - _right.z * 2.4 + _forward.z * 2.5, -12, 12);
              const idx = targetIx - iliheModel.root.position.x;
              const idz = targetIz - iliheModel.root.position.z;
              const idist = Math.hypot(idx, idz);
              if (idist > 0.35) {
                iliheModel.root.position.x += (idx / idist) * Math.min(idist, 6.2 * dt);
                iliheModel.root.position.z += (idz / idist) * Math.min(idist, 6.2 * dt);
                iliheModel.root.position.y = Math.abs(Math.sin(nowSec * 10)) * 0.14;
                iliheModel.root.rotation.y = Math.atan2(idx, idz);
              } else {
                iliheModel.root.position.y = 0;
                iliheModel.root.rotation.x = 0;
                iliheModel.root.rotation.z = 0;
                const bdx = bossModel.root.position.x - iliheModel.root.position.x;
                const bdz = bossModel.root.position.z - iliheModel.root.position.z;
                iliheModel.root.rotation.y = Math.atan2(bdx, bdz);
              }
            }
          } else {
            // Minion МАКС (Turkey) AI & Flying Beak Peck
            const wingSpeed = state.maksPeckState === 'FLYING' ? 28 : 9;
            const wingAmp = state.maksPeckState === 'FLYING' ? 0.85 : 0.22;
            maksModel.leftWing.rotation.z = Math.sin(nowSec * wingSpeed) * wingAmp;
            maksModel.rightWing.rotation.z = -Math.sin(nowSec * wingSpeed) * wingAmp;

            if (state.maksPeckState === 'FLYING') {
              state.maksPeckTimer -= dt;
              const bdx = bossModel.root.position.x - maksModel.root.position.x;
              const bdz = bossModel.root.position.z - maksModel.root.position.z;
              const dist = Math.hypot(bdx, bdz) || 1;
              maksModel.root.rotation.y = Math.atan2(bdx, bdz);
              maksModel.root.rotation.x = 0.32;
              maksModel.root.position.x += (bdx / dist) * 19 * dt;
              maksModel.root.position.z += (bdz / dist) * 19 * dt;
              maksModel.root.position.y = THREE.MathUtils.lerp(maksModel.root.position.y, 2.25, Math.min(1, dt * 8));

              if (dist < 1.65 || state.maksPeckTimer <= 0) {
                state.maksPeckState = 'RETURNING';
                state.maksPeckTimer = 0.55;
                maksModel.root.rotation.x = 0;
                soundFX.playTurkeyPeck();
                spawnFlash(bossModel.root.position.x, 2.1, bossModel.root.position.z, 0xf97316, 2.6);
                const dmg = state.radarLeft > 0 ? 60 : 50;
                applyBossHit(dmg, 'PECK');
              }
            } else {
              if (state.maksPeckState === 'RETURNING') {
                state.maksPeckTimer -= dt;
                if (state.maksPeckTimer <= 0) state.maksPeckState = 'IDLE';
              }
              const targetMx = THREE.MathUtils.clamp(playerPos.x - _right.x * 2.3 + _forward.x * 2.4, -12, 12);
              const targetMz = THREE.MathUtils.clamp(playerPos.z - _right.z * 2.3 + _forward.z * 2.4, -12, 12);
              const mdx = targetMx - maksModel.root.position.x;
              const mdz = targetMz - maksModel.root.position.z;
              const mdist = Math.hypot(mdx, mdz);
              maksModel.root.rotation.x = 0;
              if (mdist > 0.35) {
                maksModel.root.position.x += (mdx / mdist) * Math.min(mdist, 7.6 * dt);
                maksModel.root.position.z += (mdz / mdist) * Math.min(mdist, 7.6 * dt);
                maksModel.root.position.y = Math.max(0, maksModel.root.position.y * (1 - Math.min(1, dt * 6))) + Math.abs(Math.sin(nowSec * 14)) * 0.16;
                maksModel.root.rotation.y = Math.atan2(mdx, mdz);
              } else {
                maksModel.root.position.y = THREE.MathUtils.lerp(maksModel.root.position.y, 0, Math.min(1, dt * 8));
                maksModel.root.rotation.x = 0;
                maksModel.root.rotation.z = 0;
                const bdx = bossModel.root.position.x - maksModel.root.position.x;
                const bdz = bossModel.root.position.z - maksModel.root.position.z;
                maksModel.root.rotation.y = Math.atan2(bdx, bdz);
              }
            }
          }

          // Thrown healing fruit flight toward player camera
          for (let i = thrownFruits.length - 1; i >= 0; i--) {
            const f = thrownFruits[i];
            f.t += dt / f.duration;
            const p = Math.min(1, f.t);
            f.mesh.position.x = THREE.MathUtils.lerp(f.startX, playerPos.x, p);
            f.mesh.position.z = THREE.MathUtils.lerp(f.startZ, playerPos.z, p);
            f.mesh.position.y = 1.4 + Math.sin(p * Math.PI) * 1.4 + p * (playerPos.y - 1.55);
            f.mesh.rotation.y += dt * 10;
            if (p >= 1) {
              scene.remove(f.mesh);
              thrownFruits.splice(i, 1);
              const healAmount = Math.round(maxPlayerHp * 0.1);
              state.playerHp = Math.min(maxPlayerHp, state.playerHp + healAmount);
              state.eatAnim = 1;
              state.healFlashTimer = 0.65;
              soundFX.playFruitEat();
              setBanner(`Ням! Ты съел фрукт от ИЛИХЕ и восстановил +${healAmount} HP!`, 2.4);
            }
          }

          // Shashlik & Radar dogs (2-phase: dash & bite boss -> return with +3 shashlik & +15 HP)
          if (shashlikDogMesh) {
            shashlikDogTimer -= dt;
            if (state.shashlikDogPhase === 'DASH_TO_BOSS') {
              const bx = bossModel.root.position.x;
              const bz = bossModel.root.position.z;
              const dx = bx - shashlikDogMesh.position.x;
              const dz = bz - shashlikDogMesh.position.z;
              const dist = Math.hypot(dx, dz) || 1;
              shashlikDogMesh.position.x += (dx / dist) * 22 * dt;
              shashlikDogMesh.position.z += (dz / dist) * 22 * dt;
              shashlikDogMesh.position.y = Math.abs(Math.sin(nowSec * 18)) * 0.28;
              shashlikDogMesh.lookAt(bx, 0, bz);

              if (dist < 2.2 || shashlikDogTimer <= 0) {
                if (dist < 2.6 && state.outcome === 'ACTIVE') {
                  const biteDmg = state.radarLeft > 0 ? Math.round(EGOR_DOG_BITE_DMG * 1.2) : EGOR_DOG_BITE_DMG;
                  state.shashlikDogBiteDmg = biteDmg;
                  soundFX.playDogBark();
                  soundFX.playBossHit();
                  spawnFlash(bx, 1.5, bz, 0xf59e0b, 2.4);
                  applyBossHit(biteDmg, 'DOG_BITE');
                }
                state.shashlikDogPhase = 'RETURN_TO_PLAYER';
                shashlikDogTimer = 1.45;
              }
            } else {
              const tx = playerPos.x + _right.x * 1.2;
              const tz = playerPos.z + _right.z * 1.2;
              const dx = tx - shashlikDogMesh.position.x;
              const dz = tz - shashlikDogMesh.position.z;
              const dist = Math.hypot(dx, dz) || 1;
              shashlikDogMesh.position.x += (dx / dist) * Math.min(dist, 19 * dt);
              shashlikDogMesh.position.z += (dz / dist) * Math.min(dist, 19 * dt);
              shashlikDogMesh.position.y = Math.abs(Math.sin(nowSec * 16)) * 0.2;
              shashlikDogMesh.lookAt(playerPos.x, 0, playerPos.z);

              if (dist < 1.9 || shashlikDogTimer <= 0) {
                state.shashlik = Math.min(EGOR_MAX_SHASHLIK, state.shashlik + EGOR_DOG_SHASHLIK);
                const prevHp = state.playerHp;
                state.playerHp = Math.min(maxPlayerHp, state.playerHp + EGOR_DOG_HEAL);
                const healed = state.playerHp - prevHp;
                state.eatAnim = 0.85;
                state.healFlashTimer = 0.55;
                soundFX.playFruitEat();
                setBanner(
                  state.shashlikDogBiteDmg > 0
                    ? `Пёс куснул ${bossGenitiveName} (-${state.shashlikDogBiteDmg} HP) и принёс +${EGOR_DOG_SHASHLIK} шашлыка (+${healed > 0 ? healed : EGOR_DOG_HEAL} HP)!`
                    : `Пёс принёс +${EGOR_DOG_SHASHLIK} шашлыка и огурец (+${healed > 0 ? healed : EGOR_DOG_HEAL} HP)!`,
                  2.6
                );
                state.shashlikDogPhase = 'NONE';
                state.shashlikDogBiteDmg = 0;
                scene.remove(shashlikDogMesh);
                shashlikDogMesh = null;
              }
            }
          }

          if (radarDogMesh) {
            if (state.radarLeft > 0) {
              const ang = nowSec * 1.8;
              radarDogMesh.position.set(
                bossModel.root.position.x + Math.cos(ang) * 4.5,
                0,
                bossModel.root.position.z + Math.sin(ang) * 4.5
              );
              radarDogMesh.lookAt(bossModel.root.position.x, 0, bossModel.root.position.z);
              const dish = radarDogMesh.userData.dish as THREE.Group | undefined;
              if (dish) dish.rotation.y += dt * 7;
            } else {
              scene.remove(radarDogMesh);
              radarDogMesh = null;
            }
          }

          // Continuous realistic blood drip when belly wound is visible (disabled for Wild Cucumber)
          if (!isWildCucumber && bossModel.bellyWoundGroup.visible) {
            state.bloodDripTimer -= dt;
            if (state.bloodDripTimer <= 0) {
              state.bloodDripTimer = state.bossPhase === 'PHASE2_INTRO' ? 0.14 : 0.34;
              spawnBloodBurst(1);
            }
          }

          // =====================================================================
          // BOSS DIMA & WILD CUCUMBER AI & ABILITIES
          // =====================================================================
          if (state.bossPhase === 'WILD_PHASE3_INTRO') {
            // 23-second Live 3D Dimension-Shift Cutscene (IFRAME)
            state.wildPhase3IntroTimer -= dt;
            const elapsed = WILD_PHASE3_INTRO_DURATION - Math.max(0, state.wildPhase3IntroTimer);

            viewModelGroup.visible = false;
            knifeGroup.visible = false;
            impaledSkewerGroup.visible = false;
            iliheModel.root.visible = false;
            maksModel.root.visible = false;
            playerAvatar.root.visible = true;
            bossModel.root.visible = true;
            bossModel.upperBodyGroup.visible = true;
            bossModel.upperBodyGroup.position.set(0, 0, 0);
            bossModel.leftLeg.legGroup.position.y = 1.05;
            bossModel.rightLeg.legGroup.position.y = 1.05;
            bossModel.leftLeg.knee.rotation.x = 0;
            bossModel.rightLeg.knee.rotation.x = 0;
            if (bossModel.backJarGroup) bossModel.backJarGroup.visible = true;
            cutsceneVfxGroup.visible = true;
            for (const obj of wildFrontOccludingObjs) obj.visible = false;

            const targetFov = 54 - Math.sin(elapsed * 0.55) * 3.5;
            if (Math.abs(camera.fov - targetFov) > 0.05) {
              camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
              camera.updateProjectionMatrix();
            }

            // Strict side profile camera: player on left (-X), Wild Cucumber on right (+X)
            const camZ = 10.9 - (elapsed / WILD_PHASE3_INTRO_DURATION) * 1.35 + Math.sin(elapsed * 2.2) * 0.25;
            camera.position.set(0, 2.38, camZ);
            camera.lookAt(0, 1.82, 0);

            // Keep both fighters crisply lit so green cucumber never goes muddy/black
            hemiLight.intensity = 0.98;
            keyLight.intensity = 1.48;

            // Flicker central purple lightning bolts between both heroes
            for (let b = 0; b < cutsceneBolts.length; b++) {
              const bolt = cutsceneBolts[b];
              bolt.visible = Math.sin(nowSec * (26 + b * 7) + b * 1.9) > -0.15;
              bolt.position.x = Math.sin(nowSec * 15 + b * 2.1) * 0.75;
              bolt.scale.y = 0.88 + Math.cos(nowSec * 19 + b) * 0.18;
            }

            const clashBeats = [2.2, 4.5, 6.8, 9.1, 11.4, 13.7, 16.0, 18.4, 20.5];
            const dimensionPalettes = [
              { bg: 0x16072b, fog: 0x1f0a3d, hemi: 0xd8b4fe, key: 0xf5f3ff, rim: 0xa855f7 },
              { bg: 0x240612, fog: 0x38081b, hemi: 0xfda4af, key: 0xfff1f2, rim: 0xe11d48 },
              { bg: 0x0f172a, fog: 0x1e293b, hemi: 0xe2e8f0, key: 0xffffff, rim: 0x94a3b8 },
              { bg: 0x052017, fog: 0x093024, hemi: 0x86efac, key: 0xdcfce7, rim: 0x10b981 },
              { bg: 0x0b0f33, fog: 0x182059, hemi: 0x93c5fd, key: 0xe0e7ff, rim: 0x818cf8 },
            ];

            let currentBeatWindow = 0;
            for (let i = 0; i < clashBeats.length; i++) {
              if (elapsed >= clashBeats[i]) currentBeatWindow = i + 1;
            }

            if (currentBeatWindow - 1 > state.wildCutsceneBeatIdx && currentBeatWindow - 1 < clashBeats.length) {
              const beatIdx = currentBeatWindow - 1;
              state.wildCutsceneBeatIdx = beatIdx;
              state.wildDimIdx = (state.wildDimIdx + 1) % dimensionPalettes.length;
              const pal = dimensionPalettes[state.wildDimIdx];
              const isMono = beatIdx % 2 === 1;

              state.wildCutsceneFlashMode = isMono ? 'BW_INVERT' : 'PURPLE';
              state.wildCutsceneFlashTimer = isMono ? 0.16 : 0.34;
              renderer.domElement.style.filter = isMono
                ? 'grayscale(1) contrast(1.42) invert(1) brightness(1.05)'
                : 'saturate(1.45) contrast(1.16) brightness(1.14)';

              if (scene.background instanceof THREE.Color) scene.background.setHex(pal.bg);
              if (scene.fog instanceof THREE.FogExp2) scene.fog.color.setHex(pal.fog);
              hemiLight.color.setHex(pal.hemi);
              keyLight.color.setHex(pal.key);
              rimLight.color.setHex(pal.rim);

              soundFX.playGlassShatter(beatIdx >= 6);
              triggerGlassBurst(beatIdx >= 6, isMono);
              triggerScreenShake(0.32 + beatIdx * 0.032, 1.35);
              spawnFlash(0, 1.85, 0, isMono ? 0xffffff : 0xc084fc, 3.6 + beatIdx * 0.2);

              for (let a = 0; a < cutsceneSlashArcs.length; a++) {
                const arc = cutsceneSlashArcs[a];
                arc.visible = true;
                arc.rotation.set(
                  ((beatIdx + a) % 3) * 0.55 - 0.5,
                  ((beatIdx * 2 + a) % 4) * 0.4 - 0.6,
                  beatIdx * 0.95 + a * 1.1
                );
              }
            }

            // Fade slash arcs between beats
            for (let a = 0; a < cutsceneSlashArcs.length; a++) {
              const arc = cutsceneSlashArcs[a];
              if (arc.visible) {
                arc.rotation.z += dt * (a % 2 === 0 ? 4.5 : -4.5);
                const mat = arc.material as THREE.MeshBasicMaterial;
                mat.opacity = Math.max(0, state.wildCutsceneFlashTimer * 2.8);
                if (mat.opacity <= 0.02) arc.visible = false;
              }
            }

            // Choreograph dash -> clash -> spring back across each beat!
            const prevBeatT = currentBeatWindow > 0 ? clashBeats[currentBeatWindow - 1] : 0;
            const nextBeatT = currentBeatWindow < clashBeats.length ? clashBeats[currentBeatWindow] : 23.0;
            const segLen = Math.max(0.5, nextBeatT - prevBeatT);
            const segP = THREE.MathUtils.clamp((elapsed - prevBeatT) / segLen, 0, 1);

            let fighterOffsetX = 4.2;
            let hopY = 0;
            let strikeRot = 0;
            if (elapsed >= 20.5) {
              // Climax barrage exchange right at the center before final shatter
              const barrage = Math.sin((elapsed - 20.5) * 14);
              fighterOffsetX = 1.45 + Math.abs(barrage) * 0.85;
              hopY = Math.abs(Math.sin((elapsed - 20.5) * 11)) * 0.45;
              strikeRot = barrage * 1.4;
            } else if (segP < 0.28) {
              // Recoil back from impact
              const recP = segP / 0.28;
              fighterOffsetX = THREE.MathUtils.lerp(1.25, 4.25, recP);
              hopY = Math.sin(recP * Math.PI) * 0.42;
              strikeRot = (1 - recP) * 0.9;
            } else if (segP < 0.72) {
              // Stance charge in profile
              fighterOffsetX = 4.25 - ((segP - 0.28) / 0.44) * 0.45;
              strikeRot = -0.65;
            } else {
              // High-speed dash into weapon clash at center!
              const dashP = (segP - 0.72) / 0.28;
              fighterOffsetX = THREE.MathUtils.lerp(3.8, 1.2, dashP * dashP);
              hopY = Math.sin(dashP * Math.PI) * 0.35;
              strikeRot = THREE.MathUtils.lerp(-0.65, 1.15, dashP);
            }

            playerPos.set(-fighterOffsetX, eyeHeight, 0);
            playerAvatar.root.position.set(-fighterOffsetX, hopY, 0);
            playerAvatar.root.rotation.set(0, Math.PI / 2 - 0.18, 0);
            playerAvatar.upperBodyGroup.rotation.set(0.16, 0, 0);
            playerAvatar.rightArm.rotation.set(-0.75 + strikeRot, 0, 0);
            playerAvatar.leftArm.rotation.set(0.35 - strikeRot * 0.4, 0, 0);
            playerAvatar.leftLeg.legGroup.rotation.x = Math.sin(elapsed * 16) * 0.45;
            playerAvatar.rightLeg.legGroup.rotation.x = -Math.sin(elapsed * 16) * 0.45;

            bossModel.root.scale.set(1.06, 1.06, 1.06);
            bossModel.root.position.set(fighterOffsetX, hopY, 0);
            bossModel.root.rotation.set(0, -Math.PI / 2 + 0.34, 0);
            bossModel.upperBodyGroup.rotation.set(0.14, 0, 0);
            bossModel.rightArm.rotation.set(-0.85 + strikeRot, 0.2, 0);
            bossModel.leftArm.rotation.set(0.3 - strikeRot * 0.35, 0, 0);
            bossModel.leftLeg.legGroup.rotation.x = -Math.sin(elapsed * 16) * 0.45;
            bossModel.rightLeg.legGroup.rotation.x = Math.sin(elapsed * 16) * 0.45;
            bossModel.skewerGroup?.rotation.set(0.82, 0, 0);

            // Manifest ghostly dog paws behind Wild Cucumber's shoulder near the end of cutscene!
            if (elapsed >= 20.4) {
              const pawAppear = Math.min(1, (elapsed - 20.4) / 2.0);
              ghostPawsGroup.visible = true;
              ghostPawsGroup.scale.setScalar(pawAppear);
              leftGhostPaw.position.set(fighterOffsetX + 0.9, 3.15 + Math.sin(nowSec * 5) * 0.14, -0.7);
              leftGhostPaw.rotation.set(0.35, -Math.PI / 2, 0);
              rightGhostPaw.position.set(fighterOffsetX + 0.85, 3.25 + Math.cos(nowSec * 5) * 0.14, 0.7);
              rightGhostPaw.rotation.set(0.35, -Math.PI / 2, 0);
            } else {
              ghostPawsGroup.visible = false;
            }

            if (state.wildPhase3IntroTimer <= 0) {
              if (isCoopClientNow()) {
                state.wildPhase3IntroTimer = 0.01;
              } else {
                // End of 23rd second: Final Massive Screen Shatter -> Phase 3 Side-Profile Combat!
                soundFX.playGlassShatter(true);
                triggerGlassBurst(true, false);
                triggerScreenShake(0.62, 1.15);
                spawnFlash(0, 1.9, 0, 0xe879f9, 5.5);

                renderer.domElement.style.filter = '';
                state.wildCutsceneFlashTimer = 0;
                state.wildCutsceneFlashMode = 'NONE';
                cutsceneVfxGroup.visible = false;
                for (const arc of cutsceneSlashArcs) arc.visible = false;

                if (scene.background instanceof THREE.Color) scene.background.copy(wildBgDark);
                if (scene.fog instanceof THREE.FogExp2) scene.fog.color.setHex(0x130824);
                hemiLight.color.setHex(0xa855f7);
                hemiLight.intensity = 0.72;
                keyLight.color.setHex(0xd8b4fe);
                keyLight.intensity = 1.15;
                rimLight.color.setHex(0x9333ea);

                ghostPawsGroup.visible = true;
                ghostPawsGroup.scale.setScalar(1);
                playerPos.set(-4.5, eyeHeight, 0);
                playerAvatar.root.position.set(-4.5, 0, 0);
                playerAvatar.root.rotation.set(0, Math.PI / 2, 0);
                playerAvatar.upperBodyGroup.rotation.set(0, 0, 0);
                iliheModel.root.visible = minion === 'ILIHE';
                maksModel.root.visible = minion === 'MAKS';

                bossModel.root.scale.set(1, 1, 1);
                bossModel.root.position.set(4.5, 0, 0);
                bossModel.root.rotation.set(0, -Math.PI / 2, 0);
                bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                bossModel.leftArm.rotation.set(0, 0, 0);
                bossModel.rightArm.rotation.set(0, 0, 0);
                bossModel.leftLeg.legGroup.rotation.x = 0;
                bossModel.rightLeg.legGroup.rotation.x = 0;
                bossModel.skewerGroup?.rotation.set(0.72, 0, 0);

                state.bossPhase = 'WILD_PHASE3';
                state.wildPawPhase = 'NONE';
                state.wildPawCd = 2.5;
                state.dimaWireCd = 3.5;
                lastVioletPhase = 'WILD_PHASE3';
                seekVioletTo(186, true);
                soundFX.playRage();
                const p3CombatBanner =
                  '3-Я ФАЗА WILD ОГУРЦА · БОЙ В ПРОФИЛЬ! Призрачные лапы пса (28 DMG) и беспощадный штурм!';
                setBanner(p3CombatBanner, 5.0);
                onCoopBossEventRef.current?.({
                  type: 'PHASE_CHANGE',
                  bossPhase: 'WILD_PHASE3',
                  bossHp: state.bossHp,
                  dimaStamina: state.dimaStamina,
                  bossDmgBoost: state.bossDmgBoost,
                  banner: p3CombatBanner,
                });
              }
            }
          } else if (isCoopClientNow()) {
            // Non-Host Co-op Client: interpolate authoritative shared boss from Host + run local hazard collisions
            state.dimaSpinWireHitCd = Math.max(0, state.dimaSpinWireHitCd - dt);
            state.dimaDashHitCd = Math.max(0, state.dimaDashHitCd - dt);
            if (state.bossPhase === 'PHASE2_INTRO') {
              state.phase2IntroTimer = Math.max(0.01, state.phase2IntroTimer - dt);
            }
            if (state.sonicWaveAnim > 0) {
              state.sonicWaveAnim -= dt;
              const progressWave = 1 - state.sonicWaveAnim / 0.7;
              sonicWaveRing.visible = true;
              sonicWaveRing.scale.setScalar(1 + progressWave * 14);
              (sonicWaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - progressWave));
              if (state.sonicWaveAnim <= 0) {
                sonicWaveRing.visible = false;
              }
            }

            const bs = coopBossStateRefProp.current?.current;
            if (bs) {
              clientBossMissingTimer = 0;
              clientBossMissingWarned = false;
              if (bs.bossPhase !== state.bossPhase && bs.bossPhase !== 'STOMPING') {
                applyRemotePhaseChange(bs.bossPhase, bs.bossHp, bs.dimaStamina, bs.bossDmgBoost);
              }
              state.bossHp = bs.bossHp;
              state.dimaStamina = bs.dimaStamina;
              state.bossDmgBoost = bs.bossDmgBoost;

              state.wildSkewerPhase = bs.wildSkewerPhase as typeof state.wildSkewerPhase;
              state.wildSlamPhase = bs.wildSlamPhase as typeof state.wildSlamPhase;
              state.wildJarPhase = bs.wildJarPhase as typeof state.wildJarPhase;
              state.wildPawPhase = bs.wildPawPhase as typeof state.wildPawPhase;
              state.dimaUltPhase = bs.dimaUltPhase as typeof state.dimaUltPhase;
              state.dimaDashPhase = bs.dimaDashPhase as typeof state.dimaDashPhase;
              state.dimaSpinWirePhase = bs.dimaSpinWirePhase as typeof state.dimaSpinWirePhase;
              state.dimaSisterPhase = bs.dimaSisterPhase as typeof state.dimaSisterPhase;
              state.dimaSpinWireAngle = bs.spinWireAngle;

              const bAlpha = clientBossSyncedOnce ? Math.min(1, dt * 18) : 1;
              clientBossSyncedOnce = true;
              bossModel.root.position.x = THREE.MathUtils.lerp(bossModel.root.position.x, bs.x, bAlpha);
              bossModel.root.position.y = THREE.MathUtils.lerp(bossModel.root.position.y, bs.y, bAlpha);
              bossModel.root.position.z = THREE.MathUtils.lerp(bossModel.root.position.z, bs.z, bAlpha);
              const curYaw = bossModel.root.rotation.y;
              const dYaw = ((bs.yaw - curYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
              bossModel.root.rotation.y = curYaw + dYaw * bAlpha;
              bossModel.root.rotation.x = THREE.MathUtils.lerp(bossModel.root.rotation.x, bs.rx, bAlpha);
              bossModel.root.rotation.z = THREE.MathUtils.lerp(bossModel.root.rotation.z, bs.rz, bAlpha);
              bossModel.root.scale.set(
                THREE.MathUtils.lerp(bossModel.root.scale.x, bs.scaleX, bAlpha),
                THREE.MathUtils.lerp(bossModel.root.scale.y, bs.scaleY, bAlpha),
                THREE.MathUtils.lerp(bossModel.root.scale.z, bs.scaleZ, bAlpha)
              );

              bossModel.upperBodyGroup.position.set(
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.position.x, bs.ubX, bAlpha),
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.position.y, bs.ubY, bAlpha),
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.position.z, bs.ubZ, bAlpha)
              );
              bossModel.upperBodyGroup.rotation.set(
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.rotation.x, bs.ubRx, bAlpha),
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.rotation.y, bs.ubRy, bAlpha),
                THREE.MathUtils.lerp(bossModel.upperBodyGroup.rotation.z, bs.ubRz, bAlpha)
              );
              bossModel.leftArm.rotation.set(bs.laRx, bs.laRy, bs.laRz);
              bossModel.rightArm.rotation.set(bs.raRx, bs.raRy, bs.raRz);
              bossModel.leftLeg.legGroup.position.y = bs.llY;
              bossModel.leftLeg.legGroup.rotation.x = bs.llRx;
              bossModel.leftLeg.knee.rotation.x = bs.lkRx;
              bossModel.rightLeg.legGroup.position.y = bs.rlY;
              bossModel.rightLeg.legGroup.rotation.x = bs.rlRx;
              bossModel.rightLeg.knee.rotation.x = bs.rkRx;
              bossModel.potGroup.rotation.set(bs.potRx, bs.potRy, bs.potRz);
              if (bossModel.skewerGroup) {
                bossModel.skewerGroup.rotation.x = bs.skRx;
              }
              bossModel.bellyWoundGroup.visible = bs.bellyWound;
              bossModel.potCrack.visible = bs.shieldBroken || bs.bellyWound;
              if (!isWildCucumber) {
                bossModel.intactShieldGroup.visible = !bs.shieldBroken;
                bossModel.brokenShieldGroup.visible = bs.shieldBroken;
              }
              if (bossModel.backJarGroup) {
                bossModel.backJarGroup.visible = bs.backJarVisible;
              }

              lungeAimGroup.visible = bs.lungeVisible;
              if (bs.lungeVisible) {
                lungeAimGroup.position.set(bossModel.root.position.x, 0.05, bossModel.root.position.z);
                lungeAimGroup.rotation.y = bs.lungeYaw;
                lungeAimCoreMat.opacity = 0.55 + Math.sin(nowSec * 22) * 0.35;
              }

              wildSlamRingGroup.visible = bs.slamRingVisible;
              if (bs.slamRingVisible) {
                wildSlamRingGroup.position.set(bs.slamX, 0.05, bs.slamZ);
                wildSlamOuterMat.opacity = 0.72 + Math.sin(nowSec * 24) * 0.25;
                wildSlamFillMat.opacity = 0.2 + bs.slamProg * 0.38;
                wildSlamInner.scale.setScalar(0.35 + bs.slamProg * 2.45);
              }

              if (bs.jarVisible) {
                thrownJarGroup.visible = true;
                thrownJarGroup.position.set(bs.jarX, bs.jarY, bs.jarZ);
                thrownJarGroup.rotation.x = bs.jarRx;
                thrownJarGroup.rotation.z = bs.jarRz;
                updateJarChain(bossModel.root.position.x, 1.85, bossModel.root.position.z, bs.jarX, bs.jarY, bs.jarZ, 0.2);
              } else {
                hideJarAndChain();
              }

              ghostPawsGroup.visible = bs.ghostPawsVisible;
              if (bs.ghostPawsVisible) {
                ghostPawsGroup.scale.setScalar(bs.pawScale);
                leftGhostPaw.position.set(bs.lpX, bs.lpY, bs.lpZ);
                leftGhostPaw.rotation.set(bs.lpRx, bs.lpRy, bs.lpRz);
                rightGhostPaw.position.set(bs.rpX, bs.rpY, bs.rpZ);
                rightGhostPaw.rotation.set(bs.rpRx, bs.rpRy, bs.rpRz);
                rightGhostPaw.scale.setScalar(bs.rpScale);
              }

              pawSlamRingGroup.visible = bs.pawRingVisible;
              if (bs.pawRingVisible) {
                pawSlamRingGroup.position.set(bs.pawRingX, 0.055, bs.pawRingZ);
                pawSlamOuterMat.opacity = 0.72 + Math.sin(nowSec * 24) * 0.25;
                pawSlamFillMat.opacity = 0.22 + bs.pawRingProg * 0.36;
                pawSlamInner.scale.setScalar(0.35 + bs.pawRingProg * 2.35);
              }

              if (bs.ultRingVisible) {
                bossSlamRing.position.set(bs.ultRingX, 0.04, bs.ultRingZ);
                (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = bs.ultRingOp;
              } else {
                (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
              }

              wireSweepGroup.visible = bs.spinWireVisible;
              if (bs.spinWireVisible) {
                wireSweepGroup.position.set(bossModel.root.position.x, 0, bossModel.root.position.z);
                wireSweepGroup.rotation.y = bs.spinWireAngle;
              }

              sisterModel.visible = bs.sisterVisible;
              if (bs.sisterVisible) {
                sisterModel.position.set(bs.sisterX, bs.sisterY, bs.sisterZ);
                sisterModel.rotation.y = bs.sisterYaw;
              }
              sonicWarnRing.position.set(bs.sonicOriginX, 0.04, bs.sonicOriginZ);
              (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = bs.sonicWarnOp;

              // Continuous Client-side hazard checks against Host-driven boss mechanics
              if (bs.dimaSpinWirePhase === 'SPINNING') {
                const dirX = Math.cos(bs.spinWireAngle);
                const dirZ = -Math.sin(bs.spinWireAngle);
                const relX = playerPos.x - bossModel.root.position.x;
                const relZ = playerPos.z - bossModel.root.position.z;
                const proj = THREE.MathUtils.clamp(relX * dirX + relZ * dirZ, 0, sweepCableLen);
                const closestX = bossModel.root.position.x + dirX * proj;
                const closestZ = bossModel.root.position.z + dirZ * proj;
                const distToWire = Math.hypot(playerPos.x - closestX, playerPos.z - closestZ);
                if (distToWire < 0.95) {
                  if (state.playerJumpY < 0.72) {
                    if (state.dimaSpinWireHitCd <= 0) {
                      state.dimaSpinWireHitCd = 0.45;
                      if (damagePlayer(20, 'УДАР ПРОВОДОМ ОТ МЫШКИ! -20 HP (Прыгай на [ПРОБЕЛ]!)', 2.0)) {
                        soundFX.playQteMiss();
                        triggerScreenShake(0.4, 1.45);
                      }
                    }
                  } else if (!state.jumpClearedWireNotified) {
                    state.jumpClearedWireNotified = true;
                    setBanner(`ПРЫЖОК! Чётко перепрыгнул провод ${bossGenitiveName}!`, 1.4);
                  }
                }
              }

              if (bs.dimaDashPhase === 'DASHING') {
                const hitDist = Math.hypot(
                  playerPos.x - bossModel.root.position.x,
                  playerPos.z - bossModel.root.position.z
                );
                if (hitDist < 1.85 && state.dimaDashHitCd <= 0) {
                  state.dimaDashHitCd = 0.95;
                  const dashDmg = getBossDmg(15);
                  if (damagePlayer(dashDmg, `ТАРАН ${isWildCucumber ? 'WILD ОГУРЦА' : 'ДИМЫ'}! Сбил с разгона (-${dashDmg} HP)!`, 2.0)) {
                    soundFX.playBossHit();
                    triggerScreenShake(0.42, 1.45);
                  }
                }
              }

              if (bs.wildSkewerPhase === 'LUNGE_DASH') {
                if (!clientLungeHitLock) {
                  const bx = bossModel.root.position.x;
                  const bz = bossModel.root.position.z;
                  const segLen = 2.95;
                  const relX = playerPos.x - bx;
                  const relZ = playerPos.z - bz;
                  const proj = THREE.MathUtils.clamp(relX * bs.lungeDirX + relZ * bs.lungeDirZ, 0, segLen);
                  const closestX = bx + bs.lungeDirX * proj;
                  const closestZ = bz + bs.lungeDirZ * proj;
                  const distToSkewer = Math.hypot(playerPos.x - closestX, playerPos.z - closestZ);
                  if (distToSkewer < 1.3 && state.playerJumpY < 1.35) {
                    clientLungeHitLock = true;
                    if (state.lupikKnifePhase !== 'NONE') {
                      // iframe
                    } else if (state.dodgeIframeTimer > 0) {
                      soundFX.playDodgeEvade();
                      setBanner('УКЛОНЕНИЕ! Проскочил мимо рывка шампуром!', 1.5);
                    } else if (damagePlayer(24, 'ПРОНЗЁН ШАМПУРОМ! Wild Огурец проткнул тебя (-24 HP)!', 2.4)) {
                      soundFX.playKnifeSlash();
                      soundFX.playBossHit();
                      triggerScreenShake(0.48, 1.3);
                      spawnFlash(playerPos.x, 1.4, playerPos.z, 0x991b1b, 2.4);
                    }
                  }
                }
              } else {
                clientLungeHitLock = false;
              }

              if (bs.wildJarPhase === 'JAR_FLYING') {
                if (!clientJarHitLock) {
                  const distToJar = Math.hypot(playerPos.x - bs.jarX, playerPos.z - bs.jarZ);
                  if (distToJar < 1.38 && state.playerJumpY < 1.65) {
                    clientJarHitLock = true;
                    if (state.lupikKnifePhase !== 'NONE') {
                      // iframe
                    } else if (state.dodgeIframeTimer > 0) {
                      soundFX.playDodgeEvade();
                      setBanner('УКЛОНЕНИЕ! Банка с огурцами пролетела мимо (IFRAME)!', 1.5);
                    } else if (damagePlayer(32, 'УДАР БАНКОЙ С ОГУРЦАМИ! -32 HP и отброс назад!', 2.2)) {
                      soundFX.playExplosion();
                      soundFX.playBossHit();
                      triggerScreenShake(0.5, 1.3);
                      spawnFlash(playerPos.x, 1.4, playerPos.z, 0xc084fc, 2.8);
                    }
                  }
                }
              } else {
                clientJarHitLock = false;
              }
            } else {
              clientBossMissingTimer += dt;
              if (clientBossMissingTimer >= 2.2 && !clientBossMissingWarned) {
                clientBossMissingWarned = true;
                setBanner('НЕТ СИГНАЛА БОССА ОТ ХОСТА! Перезапустите server.cjs (taskkill /F /IM node.exe).', 5.5);
              }
            }
          } else if (state.bossPhase === 'PHASE2_INTRO') {
            // 16s Kneeling on one knee animation + invulnerable speech + sans v2 playing immediately!
            state.phase2IntroTimer -= dt;
            const elapsed = PHASE2_INTRO_DURATION - Math.max(0, state.phase2IntroTimer);
            let kneel = 1;
            if (elapsed < 0.9) {
              kneel = elapsed / 0.9;
            } else if (state.phase2IntroTimer < 1.2) {
              kneel = Math.max(0, state.phase2IntroTimer / 1.2);
            }

            const introTarget = getBossTarget();
            bossModel.root.lookAt(introTarget.x, 0, introTarget.z);
            bossModel.root.position.y = 0;
            bossModel.root.rotation.x = 0;
            bossModel.root.rotation.z = 0;

            const breath = Math.sin(nowSec * 4.5) * 0.025 * kneel;
            bossModel.upperBodyGroup.position.set(0, -0.5 * kneel + breath, 0.06 * kneel);
            bossModel.upperBodyGroup.rotation.x = (0.18 + Math.sin(nowSec * 2.2) * 0.04) * kneel;

            // Left leg planted forward, Right leg kneeling onto snow
            bossModel.leftLeg.legGroup.position.y = 1.05 - 0.5 * kneel;
            bossModel.leftLeg.legGroup.rotation.x = -1.35 * kneel;
            bossModel.leftLeg.knee.rotation.x = 1.35 * kneel;
            bossModel.rightLeg.legGroup.position.y = 1.05 - 0.5 * kneel;
            bossModel.rightLeg.legGroup.rotation.x = 0.25 * kneel;
            bossModel.rightLeg.knee.rotation.x = 1.35 * kneel;

            // Arms clutching his wounded bleeding belly
            bossModel.leftArm.rotation.set(0.35 * kneel, 0.25 * kneel, 0.2 * kneel);
            bossModel.rightArm.rotation.set(-0.55 * kneel, -0.45 * kneel, -0.35 * kneel);

            if (state.phase2IntroTimer < 1.2) {
              const surge = 1 + Math.sin(((1.2 - state.phase2IntroTimer) / 1.2) * Math.PI) * 0.16;
              bossModel.root.scale.set(surge, surge, surge);
            }

            if (state.phase2IntroTimer <= 0) {
              // Reset pose to standing and unleash Phase 2!
              bossModel.root.scale.set(1, 1, 1);
              bossModel.upperBodyGroup.position.set(0, 0, 0);
              bossModel.upperBodyGroup.rotation.set(0, 0, 0);
              bossModel.leftLeg.legGroup.position.y = 1.05;
              bossModel.leftLeg.legGroup.rotation.x = 0;
              bossModel.leftLeg.knee.rotation.x = 0;
              bossModel.rightLeg.legGroup.position.y = 1.05;
              bossModel.rightLeg.legGroup.rotation.x = 0;
              bossModel.rightLeg.knee.rotation.x = 0;
              bossModel.leftArm.rotation.set(0, 0, 0);
              bossModel.rightArm.rotation.set(0, 0, 0);

              state.bossPhase = 'LAST_BREATH';
              if (sansAudio.paused) {
                sansAudio.play().catch(() => {});
              }
              soundFX.playRage();
              triggerScreenShake(0.42, 1.25);
              spawnFlash(bossModel.root.position.x, 2.0, bossModel.root.position.z, 0x38bdf8, 4.2);
              const lbBanner = isHardcore
                ? `3 ФАЗА ХАРДКОРА · ПОСЛЕДНИЙ ВЗДОХ! ${DIMA_MAX_STAMINA} стамины, провод по всей карте, лазеры и таран!`
                : `2 ФАЗА · ПОСЛЕДНИЙ ВЗДОХ! ${DIMA_MAX_STAMINA} стамины, лазеры и таран активны!`;
              setBanner(lbBanner, 4.5);
              onCoopBossEventRef.current?.({
                type: 'PHASE_CHANGE',
                bossPhase: 'LAST_BREATH',
                bossHp: state.bossHp,
                dimaStamina: state.dimaStamina,
                bossDmgBoost: state.bossDmgBoost,
                banner: lbBanner,
              });
            }
          } else if (state.bossPhase === 'EXHAUSTED') {
            // Collapsed on knees panting, waiting to be stomped!
            wireSweepGroup.visible = false;
            state.dimaSpinWirePhase = 'NONE';
            bossModel.upperBodyGroup.position.set(0, 0, 0);
            bossModel.upperBodyGroup.rotation.set(0, 0, 0);
            bossModel.leftArm.rotation.set(0, 0, 0);
            bossModel.rightArm.rotation.set(0, 0, 0);
            bossModel.leftLeg.legGroup.position.y = 1.05;
            bossModel.leftLeg.legGroup.rotation.x = 0;
            bossModel.leftLeg.knee.rotation.x = 0;
            bossModel.rightLeg.legGroup.position.y = 1.05;
            bossModel.rightLeg.legGroup.rotation.x = 0;
            bossModel.rightLeg.knee.rotation.x = 0;

            const exTarget = getBossTarget();
            bossModel.root.position.y = -0.68;
            bossModel.root.rotation.x = 0.42;
            bossModel.root.rotation.z = Math.sin(nowSec * 6) * 0.05;
            bossModel.root.lookAt(exTarget.x, -0.68, exTarget.z);
          } else if (state.wildSkewerPhase === 'IMPALE_CUTSCENE') {
            // Boss poses & animates inside the 5s Impale Cutscene block above
          } else if (state.lupikKnifePhase !== 'NONE') {
            // Frozen Boss during Lupik's Knife Cut IFRAME animation: reacts with stagger when knife lands!
            if (state.dimaStaggerTimer > 0) {
              const sp = state.dimaStaggerTimer / Math.max(0.01, state.dimaStaggerDuration);
              const snap = Math.sin((1 - sp) * Math.PI);
              const wobble = Math.sin((1 - sp) * Math.PI * 3.2) * sp;
              const pw = state.dimaStaggerPower;
              bossModel.upperBodyGroup.rotation.set(-0.36 * pw * snap, state.dimaStaggerDir * 0.28 * pw * wobble, state.dimaStaggerDir * 0.25 * pw * snap);
              bossModel.upperBodyGroup.position.set(state.dimaStaggerDir * 0.12 * pw * wobble, -0.06 * pw * snap, -0.18 * pw * snap);
            } else {
              bossModel.upperBodyGroup.rotation.set(0, 0, 0);
              bossModel.upperBodyGroup.position.set(0, 0, 0);
            }
            bossModel.root.rotation.z = Math.sin(nowSec * 40) * 0.04;
          } else {
            bossModel.root.rotation.x = 0;
            bossModel.root.rotation.z =
              state.dimaDodgeAnim > 0 ? state.dimaDodgeDir * Math.sin(state.dimaDodgeAnim * 18) * 0.32 : 0;

            // Apply Dima Stagger (wobble / torso recoil / pot helmet rattle / arm flinch) on damage!
            const isPotAskew = !isWildCucumber && state.bossPhase === 'LAST_BREATH';
            const basePotRx = isPotAskew ? -0.34 : 0;
            const basePotRy = isPotAskew ? 0.25 : 0;
            const basePotRz = isPotAskew ? -0.68 : 0;
            let staggerArmFlinch = 0;
            let staggerSpeedMult = 1;

            if (state.dimaStaggerTimer > 0) {
              const sp = state.dimaStaggerTimer / Math.max(0.01, state.dimaStaggerDuration);
              const snap = Math.sin((1 - sp) * Math.PI);
              const wobble = Math.sin((1 - sp) * Math.PI * 3.2) * sp;
              const pw = state.dimaStaggerPower;
              const dir = state.dimaStaggerDir;

              bossModel.upperBodyGroup.rotation.set(
                -0.32 * pw * snap,
                dir * 0.28 * pw * wobble,
                dir * (0.24 * pw * snap + 0.14 * pw * wobble)
              );
              bossModel.upperBodyGroup.position.set(
                dir * 0.12 * pw * wobble,
                -0.06 * pw * snap,
                -0.16 * pw * snap
              );
              bossModel.potGroup.rotation.set(
                basePotRx - 0.22 * pw * wobble,
                basePotRy,
                basePotRz + dir * 0.26 * pw * wobble
              );
              bossModel.leftArm.rotation.z = -0.28 * pw * snap;
              bossModel.rightArm.rotation.z = 0.34 * pw * snap;
              staggerArmFlinch = -0.42 * pw * snap;
              staggerSpeedMult = isWildCucumber
                ? Math.max(0.56, 1 - 0.36 * pw * sp)
                : Math.max(0.32, 1 - 0.5 * pw * sp);
            } else {
              bossModel.upperBodyGroup.rotation.set(0, 0, 0);
              bossModel.upperBodyGroup.position.set(0, 0, 0);
              bossModel.potGroup.rotation.set(basePotRx, basePotRy, basePotRz);
              bossModel.leftArm.rotation.z = 0;
              bossModel.rightArm.rotation.z = 0;
            }

            state.dimaAbilityGapTimer = Math.max(0, state.dimaAbilityGapTimer - dt);
            state.dimaWireCd = Math.max(0, state.dimaWireCd - dt);
            state.dimaSisterCd = Math.max(0, state.dimaSisterCd - dt);
            if (state.bossPhase === 'LAST_BREATH') {
              state.dimaLaserCd = Math.max(0, state.dimaLaserCd - dt);
              state.dimaDashCd = Math.max(0, state.dimaDashCd - dt);
              if (isHardcore) {
                state.dimaSpinWireCd = Math.max(0, state.dimaSpinWireCd - dt);
              }
            }
            state.dimaUltCd = Math.max(0, state.dimaUltCd - dt);
            state.dimaMeleeCd = Math.max(0, state.dimaMeleeCd - dt);
            state.dimaSpinWireHitCd = Math.max(0, state.dimaSpinWireHitCd - dt);
            if (isWildCucumber) {
              state.wildSkewerSwingCd = Math.max(0, state.wildSkewerSwingCd - dt);
              state.wildSkewerLungeCd = Math.max(0, state.wildSkewerLungeCd - dt);
              if (state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') {
                state.wildSlamCd = Math.max(0, state.wildSlamCd - dt);
                state.wildJarCd = Math.max(0, state.wildJarCd - dt);
              }
              if (state.bossPhase === 'WILD_PHASE3') {
                state.wildPawCd = Math.max(0, state.wildPawCd - dt);
              }
            }

            const bossTarget = getBossTarget();
            const bdx = bossTarget.x - bossModel.root.position.x;
            const bdz = bossTarget.z - bossModel.root.position.z;
            const bDist = Math.hypot(bdx, bdz) || 1;
            const dimaSpecialBusy =
              skyLasers.length > 0 ||
              state.dimaDashPhase !== 'NONE' ||
              state.dimaSpinWirePhase !== 'NONE' ||
              state.dimaUltPhase !== 'NONE' ||
              state.dimaSisterPhase === 'ARGUING';

            // Expanding sonic wave ring animation
            if (state.sonicWaveAnim > 0) {
              state.sonicWaveAnim -= dt;
              const progressWave = 1 - state.sonicWaveAnim / 0.7;
              sonicWaveRing.visible = true;
              sonicWaveRing.scale.setScalar(1 + progressWave * 14);
              (sonicWaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - progressWave));
              if (state.sonicWaveAnim <= 0) {
                sonicWaveRing.visible = false;
              }
            }

            // Boss Ability 3 (Phase 2 ONLY): 7 Sky Lasers (10 DMG each, 13s CD — NO move-stack!)
            if (
              !isWildCucumber &&
              state.bossPhase === 'LAST_BREATH' &&
              state.dimaLaserCd <= 0 &&
              !dimaSpecialBusy &&
              state.dimaAbilityGapTimer <= 0
            ) {
              state.dimaLaserCd = 13;
              soundFX.playRadarPing();
              triggerScreenShake(0.22, 1.65);
              const laserBanner = `${bossShortName.toUpperCase()} ВЫЗЫВАЕТ 7 НЕБЕСНЫХ ЛАЗЕРОВ! Уходи с красных кругов (10 DMG за лазер)!`;
              setBanner(laserBanner, 2.8);

              const laserDefs: Array<{ x: number; z: number; warnTimer: number }> = [];
              for (let i = 0; i < 7; i++) {
                const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
                const dist = i === 0 ? 0.4 : 2.6 + Math.random() * 5.2;
                const lx = THREE.MathUtils.clamp(bossTarget.x + Math.cos(angle) * dist, -11.6, 11.6);
                const lz = THREE.MathUtils.clamp(bossTarget.z + Math.sin(angle) * dist, -12.4, 12.4);
                laserDefs.push({ x: lx, z: lz, warnTimer: 1.05 + i * 0.16 });
              }
              spawnSkyLasersAt(laserDefs);
              onCoopBossEventRef.current?.({
                type: 'SKY_LASERS',
                lasers: laserDefs,
                banner: laserBanner,
              });
            }

            // Boss Ability 1: Summon Sister -> Quarrel -> 45 DMG Sonic Wave (45s CD) — Dima only!
            if (
              !isWildCucumber &&
              state.dimaSisterPhase === 'NONE' &&
              state.dimaSisterCd <= 0 &&
              !dimaSpecialBusy &&
              state.dimaAbilityGapTimer <= 0
            ) {
              state.dimaSisterCd = 45;
              state.dimaSisterPhase = 'ARGUING';
              state.dimaSisterTimer = 2.3;
              const sx = THREE.MathUtils.clamp(bossModel.root.position.x + 2.3, -11.5, 11.5);
              const sz = THREE.MathUtils.clamp(bossModel.root.position.z + 0.4, -12, 12);
              sisterModel.position.set(sx, 0, sz);
              sisterModel.visible = true;
              state.sonicOriginX = (bossModel.root.position.x + sx) * 0.5;
              state.sonicOriginZ = (bossModel.root.position.z + sz) * 0.5;
              sonicWarnRing.position.set(state.sonicOriginX, 0.04, state.sonicOriginZ);
              sonicWaveRing.position.set(state.sonicOriginX, 1.1, state.sonicOriginZ);
              soundFX.playDogBark();
              triggerScreenShake(0.16, 1.8);
              const sisterBanner = `${bossShortName.toUpperCase()} ПРИЗВАЛ СЕСТРУ! Они ссорятся — убегай за синий круг от звуковой волны (45 DMG)!`;
              setBanner(sisterBanner, 3.2);
              onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: sisterBanner, dur: 3.2 });
            }

            // Boss Ability 4 (Phase 2 ONLY): Garage-Ricochet Dash (3.8s, 15 DMG, 18s CD — NO move-stack!)
            if (
              !isWildCucumber &&
              !isTraining &&
              state.bossPhase === 'LAST_BREATH' &&
              state.dimaDashPhase === 'NONE' &&
              state.dimaDashCd <= 0 &&
              !dimaSpecialBusy &&
              state.dimaAbilityGapTimer <= 0
            ) {
              state.dimaDashCd = 18;
              state.dimaDashPhase = 'REVUP';
              state.dimaDashTimer = 0.75;
              state.dimaDashHitCd = 0;
              soundFX.playBossDash();
              triggerScreenShake(0.24, 1.6);
              const dashBanner = `${bossShortName.toUpperCase()} РАЗГОНЯЕТСЯ! Отскакивает от краёв арены и несётся в тебя (15 DMG)!`;
              setBanner(dashBanner, 3.2);
              onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: dashBanner, dur: 3.2 });
            }

            // Hardcore Phase 3 Ability 3: Arena-wide Spinning Mouse Wire (3 rotations, 20 DMG, 17s CD — NO move-stack!)
            if (
              !isWildCucumber &&
              isHardcore &&
              state.bossPhase === 'LAST_BREATH' &&
              state.dimaSpinWirePhase === 'NONE' &&
              state.dimaSpinWireCd <= 0 &&
              !dimaSpecialBusy &&
              state.dimaAbilityGapTimer <= 0
            ) {
              state.dimaSpinWireCd = 17;
              state.dimaSpinWirePhase = 'WINDUP';
              state.dimaSpinWireTimer = 0.95;
              state.dimaSpinWireAngle = Math.atan2(-(bossTarget.z - bossModel.root.position.z), bossTarget.x - bossModel.root.position.x) + Math.PI * 0.65;
              state.dimaSpinWireRemainingRot = Math.PI * 6; // 3 full rotations!
              wireSweepGroup.visible = true;
              wireSweepGroup.position.set(bossModel.root.position.x, 0, bossModel.root.position.z);
              wireSweepGroup.rotation.y = state.dimaSpinWireAngle;
              soundFX.playWireShot();
              triggerScreenShake(0.24, 1.6);
              const spinBanner = `3 ФАЗА · ПРОВОД ОТ МЫШКИ! ${bossShortName} закручивает его по всей карте 3 раза (20 DMG) — ПРЫГАЙ [ПРОБЕЛ]!`;
              setBanner(spinBanner, 3.6);
              onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: spinBanner, dur: 3.6 });
            }

            if (state.dimaSisterPhase === 'ARGUING') {
              state.dimaSisterTimer -= dt;
              bossModel.root.lookAt(sisterModel.position.x, 0, sisterModel.position.z);
              sisterModel.lookAt(bossModel.root.position.x, 0, bossModel.root.position.z);
              sisterModel.position.y = Math.abs(Math.sin(nowSec * 18)) * 0.16;
              bossModel.rightArm.rotation.x = Math.sin(nowSec * 16) * 0.65;
              (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(nowSec * 14) * 0.25;

              if (state.dimaSisterTimer <= 0) {
                (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity = 0;
                bossModel.rightArm.rotation.x = 0;
                soundFX.playSonicWave();
                triggerScreenShake(0.46, 1.25);
                state.sonicWaveAnim = 0.7;
                state.dimaSisterPhase = 'LEAVING';
                state.dimaSisterTimer = 1.1;
                state.dimaAbilityGapTimer = 2.0;

                const sDmg = getBossDmg(45);
                onCoopBossEventRef.current?.({
                  type: 'SISTER_SONIC',
                  originX: state.sonicOriginX,
                  originZ: state.sonicOriginZ,
                  dmg: sDmg,
                });

                const dWave = Math.hypot(playerPos.x - state.sonicOriginX, playerPos.z - state.sonicOriginZ);
                if (dWave <= 14.5) {
                  if (damagePlayer(sDmg, `ЗВУКОВАЯ ВОЛНА ССОРЫ! Сестра и ${bossShortName} снесли ${sDmg} HP!`, 2.6)) {
                    soundFX.playQteMiss();
                    triggerScreenShake(0.54, 1.2);
                  }
                } else {
                  setBanner('Красава! Ты убежал от звуковой волны ссоры!', 2.2);
                }
              }
            } else if (state.dimaSisterPhase === 'LEAVING') {
              state.dimaSisterTimer -= dt;
              sisterModel.position.y = 0;
              if (state.dimaSisterTimer <= 0) {
                sisterModel.visible = false;
                state.dimaSisterPhase = 'NONE';
              }
            }

            // Boss Ult: Super Tall & Fat Giant Jump onto Player
            if (
              !isTraining &&
              state.bossPhase !== 'WILD_PHASE3' &&
              state.dimaUltPhase === 'NONE' &&
              state.dimaUltCd <= 0 &&
              (isWildCucumber
                ? state.wildSkewerPhase === 'NONE' &&
                  state.wildSlamPhase === 'NONE' &&
                  state.wildJarPhase === 'NONE' &&
                  state.wildPawPhase === 'NONE' &&
                  state.dimaAbilityGapTimer <= 0
                : !dimaSpecialBusy && state.dimaAbilityGapTimer <= 0)
            ) {
              state.dimaUltCd = isWildCucumber ? 23 : 24;
              state.dimaUltPhase = 'GROWING';
              state.dimaUltTimer = 1.25;
              state.dimaJumpStartX = bossModel.root.position.x;
              state.dimaJumpStartZ = bossModel.root.position.z;
              state.dimaJumpTargetX = THREE.MathUtils.clamp(bossTarget.x, -11.5, 11.5);
              state.dimaJumpTargetZ = THREE.MathUtils.clamp(bossTarget.z, -12, 12);
              bossSlamRing.position.set(state.dimaJumpTargetX, 0.04, state.dimaJumpTargetZ);
              soundFX.playRage();
              triggerScreenShake(0.22, 1.5);
              const ultBanner = `УЛЬТА ${isWildCucumber ? 'WILD ОГУРЦА' : 'ДИМЫ'}! Он стал гигантским — выпрыгивай из красного круга!`;
              setBanner(ultBanner, 3.2);
              onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: ultBanner, dur: 3.2 });
            }

            if (state.dimaUltPhase === 'GROWING') {
              state.dimaUltTimer -= dt;
              const p = 1 - Math.max(0, state.dimaUltTimer) / 1.25;
              bossModel.root.scale.set(
                THREE.MathUtils.lerp(1, 2.35, p),
                THREE.MathUtils.lerp(1, 2.15, p),
                THREE.MathUtils.lerp(1, 2.35, p)
              );
              bossModel.root.rotation.y = Math.atan2(bdx, bdz);
              (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(nowSec * 18) * 0.25;

              if (state.dimaUltTimer <= 0) {
                state.dimaUltPhase = 'JUMPING';
                state.dimaUltTimer = 1.05;
                soundFX.playBossJump();
                triggerScreenShake(0.26, 1.8);
              }
            } else if (state.dimaUltPhase === 'JUMPING') {
              state.dimaUltTimer -= dt;
              const p = 1 - Math.max(0, state.dimaUltTimer) / 1.05;
              bossModel.root.position.x = THREE.MathUtils.lerp(state.dimaJumpStartX, state.dimaJumpTargetX, p);
              bossModel.root.position.z = THREE.MathUtils.lerp(state.dimaJumpStartZ, state.dimaJumpTargetZ, p);
              bossModel.root.position.y = Math.sin(p * Math.PI) * 9.5;
              (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0.85;

              if (state.dimaUltTimer <= 0) {
                bossModel.root.position.y = 0;
                (bossSlamRing.material as THREE.MeshBasicMaterial).opacity = 0;
                soundFX.playExplosion();
                triggerScreenShake(0.58, 1.15);
                spawnFlash(state.dimaJumpTargetX, 1.0, state.dimaJumpTargetZ, isWildCucumber ? 0xa855f7 : 0xef4444, 4.8);
                const jDmg = getBossDmg(35);
                onCoopBossEventRef.current?.({
                  type: 'ULT_JUMP_IMPACT',
                  x: state.dimaJumpTargetX,
                  z: state.dimaJumpTargetZ,
                  dmg: jDmg,
                });
                const dJump = Math.hypot(playerPos.x - state.dimaJumpTargetX, playerPos.z - state.dimaJumpTargetZ);
                if (dJump < 4.4) {
                  if (damagePlayer(jDmg, `ПЛЮХ! Гигантский ${bossShortName} прыгнул прямо на тебя (-${jDmg} HP)!`, 2.4)) {
                    soundFX.playBossHit();
                  }
                }
                state.dimaUltPhase = 'SHRINKING';
                state.dimaUltTimer = 0.85;
              }
            } else if (state.dimaUltPhase === 'SHRINKING') {
              state.dimaUltTimer -= dt;
              const p = 1 - Math.max(0, state.dimaUltTimer) / 0.85;
              bossModel.root.scale.set(
                THREE.MathUtils.lerp(2.35, 1, p),
                THREE.MathUtils.lerp(2.15, 1, p),
                THREE.MathUtils.lerp(2.35, 1, p)
              );
              if (state.dimaUltTimer <= 0) {
                bossModel.root.scale.set(1, 1, 1);
                state.dimaUltPhase = 'NONE';
                state.dimaAbilityGapTimer = isWildCucumber ? 1.4 : 2.0;
              }
            } else if (state.dimaSpinWirePhase === 'WINDUP') {
              state.dimaSpinWireTimer -= dt;
              wireSweepGroup.visible = true;
              wireSweepGroup.position.set(bossModel.root.position.x, 0, bossModel.root.position.z);
              state.dimaSpinWireAngle += 1.4 * dt;
              wireSweepGroup.rotation.y = state.dimaSpinWireAngle;
              bossModel.root.rotation.y = -state.dimaSpinWireAngle + Math.PI * 0.5;
              bossModel.rightArm.rotation.x = -1.1;
              if (state.dimaSpinWireTimer <= 0) {
                state.dimaSpinWirePhase = 'SPINNING';
                soundFX.playBossDash();
                triggerScreenShake(0.28, 1.5);
              }
            } else if (state.dimaSpinWirePhase === 'SPINNING') {
              const rotStep = 5.2 * dt; // ~3.6 seconds for 3 full rotations across the arena
              state.dimaSpinWireAngle += rotStep;
              state.dimaSpinWireRemainingRot -= rotStep;
              wireSweepGroup.visible = true;
              wireSweepGroup.position.set(bossModel.root.position.x, 0, bossModel.root.position.z);
              wireSweepGroup.rotation.y = state.dimaSpinWireAngle;
              bossModel.root.rotation.y = -state.dimaSpinWireAngle + Math.PI * 0.5;
              bossModel.rightArm.rotation.x = -0.95;

              // Exact line-segment sweep check vs player position & jump height
              const dirX = Math.cos(state.dimaSpinWireAngle);
              const dirZ = -Math.sin(state.dimaSpinWireAngle);
              const relX = playerPos.x - bossModel.root.position.x;
              const relZ = playerPos.z - bossModel.root.position.z;
              const proj = THREE.MathUtils.clamp(relX * dirX + relZ * dirZ, 0, sweepCableLen);
              const closestX = bossModel.root.position.x + dirX * proj;
              const closestZ = bossModel.root.position.z + dirZ * proj;
              const distToWire = Math.hypot(playerPos.x - closestX, playerPos.z - closestZ);

              if (distToWire < 0.95) {
                if (state.playerJumpY < 0.72) {
                  if (state.dimaSpinWireHitCd <= 0) {
                    state.dimaSpinWireHitCd = 0.45;
                    if (damagePlayer(20, 'УДАР ПРОВОДОМ ОТ МЫШКИ! -20 HP (Прыгай на [ПРОБЕЛ]!)', 2.0)) {
                      soundFX.playQteMiss();
                      triggerScreenShake(0.4, 1.45);
                    }
                  }
                } else if (!state.jumpClearedWireNotified) {
                  state.jumpClearedWireNotified = true;
                  setBanner(`ПРЫЖОК! Чётко перепрыгнул провод ${bossGenitiveName}!`, 1.4);
                }
              }

              if (state.dimaSpinWireRemainingRot <= 0) {
                state.dimaSpinWirePhase = 'NONE';
                wireSweepGroup.visible = false;
                bossModel.rightArm.rotation.x = 0;
                if (!isWildCucumber) state.dimaAbilityGapTimer = 2.0;
              }
            } else if (state.dimaDashPhase === 'REVUP') {
              state.dimaDashTimer -= dt;
              bossModel.root.rotation.y = Math.atan2(bdx, bdz);
              bossModel.root.rotation.x = 0.28;
              bossModel.root.position.y = Math.abs(Math.sin(nowSec * 36)) * 0.14;
              if (state.dimaDashTimer <= 0) {
                state.dimaDashPhase = 'DASHING';
                state.dimaDashTimer = 3.8;
                state.dimaDashVx = (bdx / bDist) * 17.5;
                state.dimaDashVz = (bdz / bDist) * 17.5;
              }
            } else if (state.dimaDashPhase === 'DASHING') {
              state.dimaDashTimer -= dt;
              state.dimaDashHitCd = Math.max(0, state.dimaDashHitCd - dt);
              state.dimaDashTrailTimer -= dt;

              bossModel.root.position.x += state.dimaDashVx * dt;
              bossModel.root.position.z += state.dimaDashVz * dt;
              bossModel.root.position.y = Math.abs(Math.sin(nowSec * 28)) * 0.25;
              bossModel.root.rotation.x = 0.34;
              bossModel.root.rotation.y = Math.atan2(state.dimaDashVx, state.dimaDashVz);

              if (state.dimaDashTrailTimer <= 0) {
                state.dimaDashTrailTimer = 0.09;
                spawnFlash(bossModel.root.position.x, 1.2, bossModel.root.position.z, isWildCucumber ? 0xa855f7 : 0xf97316, 1.35);
              }

              // Bounce off garage walls and redirect straight toward target player!
              let bounced = false;
              if (bossModel.root.position.x <= -12.4) {
                bossModel.root.position.x = -12.4;
                bounced = true;
              } else if (bossModel.root.position.x >= 12.4) {
                bossModel.root.position.x = 12.4;
                bounced = true;
              }
              if (bossModel.root.position.z <= -13.4) {
                bossModel.root.position.z = -13.4;
                bounced = true;
              } else if (bossModel.root.position.z >= 13.4) {
                bossModel.root.position.z = 13.4;
                bounced = true;
              }

              if (bounced) {
                soundFX.playGarageBounce();
                triggerScreenShake(0.32, 1.85);
                spawnFlash(bossModel.root.position.x, 1.6, bossModel.root.position.z, isWildCucumber ? 0xc084fc : 0xfbbf24, 2.2);
                onCoopBossEventRef.current?.({
                  type: 'DIMA_DASH_BOUNCE',
                  x: bossModel.root.position.x,
                  z: bossModel.root.position.z,
                });
                const rdx = bossTarget.x - bossModel.root.position.x;
                const rdz = bossTarget.z - bossModel.root.position.z;
                const rLen = Math.hypot(rdx, rdz) || 1;
                state.dimaDashVx = (rdx / rLen) * 18.5;
                state.dimaDashVz = (rdz / rLen) * 18.5;
              }

              // Dash collision with player
              const hitDist = Math.hypot(
                playerPos.x - bossModel.root.position.x,
                playerPos.z - bossModel.root.position.z
              );
              if (hitDist < 1.85 && state.dimaDashHitCd <= 0) {
                state.dimaDashHitCd = 0.95;
                const dashDmg = getBossDmg(15);
                if (damagePlayer(dashDmg, `ТАРАН ${isWildCucumber ? 'WILD ОГУРЦА' : 'ДИМЫ'}! Сбил с разгона (-${dashDmg} HP)!`, 2.0)) {
                  soundFX.playBossHit();
                  triggerScreenShake(0.42, 1.45);
                }
              }

              if (state.dimaDashTimer <= 0) {
                state.dimaDashPhase = 'NONE';
                bossModel.root.position.y = 0;
                bossModel.root.rotation.x = 0;
                if (!isWildCucumber) state.dimaAbilityGapTimer = 2.0;
              }
            } else if (
              isWildCucumber &&
              (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
              state.wildSkewerPhase === 'LUNGE_STANCE'
            ) {
              // Ability 2: Skewer Lunge Stance (1.5s windup, pointing skewer tip directly at player)
              state.wildSkewerTimer -= dt;
              const aimYaw = Math.atan2(bdx, bdz);
              bossModel.root.rotation.y = aimYaw;
              bossModel.root.position.y = 0;
              bossModel.leftLeg.legGroup.rotation.x = -0.45;
              bossModel.leftLeg.knee.rotation.x = 0.45;
              bossModel.rightLeg.legGroup.rotation.x = 0.45;
              bossModel.rightLeg.knee.rotation.x = 0.25;
              bossModel.upperBodyGroup.rotation.set(0.14, -0.35, 0);
              bossModel.leftArm.rotation.set(0.35, 0.2, -0.3);
              bossModel.rightArm.rotation.set(0.85, 0.35, 0);
              bossModel.skewerGroup?.rotation.set(0.72, 0, 0);

              lungeAimGroup.visible = true;
              lungeAimGroup.position.set(bossModel.root.position.x, 0.05, bossModel.root.position.z);
              lungeAimGroup.rotation.y = aimYaw;
              lungeAimCoreMat.opacity = 0.55 + Math.sin(nowSec * 22) * 0.35;

              if (state.wildSkewerTimer <= 0) {
                state.wildSkewerPhase = 'LUNGE_DASH';
                state.wildSkewerTimer = 0.42;
                state.wildSkewerHitDone = false;
                state.wildSkewerTrailTimer = 0;
                state.wildLungeDirX = bdx / bDist;
                state.wildLungeDirZ = bdz / bDist;
                lungeAimGroup.visible = false;
                soundFX.playBossDash();
                triggerScreenShake(0.24, 1.8);
              }
            } else if (
              isWildCucumber &&
              (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
              state.wildSkewerPhase === 'LUNGE_DASH'
            ) {
              // Ability 2 Execute: High-speed skewer lunge forward!
              state.wildSkewerTimer -= dt;
              state.wildSkewerTrailTimer -= dt;
              const dashSpeed = 31;
              bossModel.root.position.x = THREE.MathUtils.clamp(
                bossModel.root.position.x + state.wildLungeDirX * dashSpeed * dt,
                -12.5,
                12.5
              );
              bossModel.root.position.z = THREE.MathUtils.clamp(
                bossModel.root.position.z + state.wildLungeDirZ * dashSpeed * dt,
                state.bossPhase === 'WILD_PHASE3' ? -7.5 : -13.5,
                state.bossPhase === 'WILD_PHASE3' ? 7.5 : 13.5
              );
              bossModel.root.rotation.y = Math.atan2(state.wildLungeDirX, state.wildLungeDirZ);
              bossModel.root.position.y = 0.08;
              bossModel.upperBodyGroup.rotation.set(0.28, -0.18, 0);
              bossModel.rightArm.rotation.set(0.95, 0.16, 0);
              bossModel.skewerGroup?.rotation.set(0.68, 0, 0);

              if (state.wildSkewerTrailTimer <= 0) {
                state.wildSkewerTrailTimer = 0.07;
                spawnFlash(bossModel.root.position.x, 1.5, bossModel.root.position.z, 0xa855f7, 1.5);
              }

              // Check skewer tip line-segment collision vs player
              if (!state.wildSkewerHitDone) {
                const bx = bossModel.root.position.x;
                const bz = bossModel.root.position.z;
                const segLen = 2.95;
                const relX = playerPos.x - bx;
                const relZ = playerPos.z - bz;
                const proj = THREE.MathUtils.clamp(
                  relX * state.wildLungeDirX + relZ * state.wildLungeDirZ,
                  0,
                  segLen
                );
                const closestX = bx + state.wildLungeDirX * proj;
                const closestZ = bz + state.wildLungeDirZ * proj;
                const distToSkewer = Math.hypot(playerPos.x - closestX, playerPos.z - closestZ);

                if (distToSkewer < 1.3 && state.playerJumpY < 1.35) {
                  if (state.lupikKnifePhase !== 'NONE') {
                    // Lupik Knife IFRAME ignores it
                  } else if (state.dodgeIframeTimer > 0) {
                    state.wildSkewerHitDone = true;
                    soundFX.playDodgeEvade();
                    setBanner('УКЛОНЕНИЕ! Проскочил мимо рывка шампуром!', 1.5);
                  } else {
                    // Hit! Start 5-second IFRAME Impale Cutscene!
                    state.wildSkewerHitDone = true;
                    state.wildSkewerPhase = 'IMPALE_CUTSCENE';
                    state.wildImpaleElapsed = 0;
                    state.wildImpaleDmgDone = false;
                    state.wildImpaleKickDone = false;
                    state.wildImpaleBossX = bx;
                    state.wildImpaleBossZ = bz;
                    state.wildImpaleKickDirX = state.wildLungeDirX;
                    state.wildImpaleKickDirZ = state.wildLungeDirZ;
                    lungeAimGroup.visible = false;
                    wildSlamRingGroup.visible = false;
                    hideJarAndChain();
                    state.wildSlamPhase = 'NONE';
                    state.wildJarPhase = 'NONE';
                    soundFX.playKnifeSlash();
                    triggerScreenShake(0.45, 1.4);
                  }
                }
              }

              if (state.wildSkewerPhase === 'LUNGE_DASH' && state.wildSkewerTimer <= 0) {
                state.wildSkewerPhase = 'NONE';
                state.wildSkewerLungeCd = state.bossPhase === 'PHASE1' ? 10.5 : 9.0;
                state.dimaAbilityGapTimer = 1.2;
                bossModel.root.position.y = 0;
                bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                bossModel.rightArm.rotation.set(0, 0, 0);
                bossModel.leftLeg.legGroup.rotation.x = 0;
                bossModel.leftLeg.knee.rotation.x = 0;
                bossModel.rightLeg.legGroup.rotation.x = 0;
                bossModel.rightLeg.knee.rotation.x = 0;
                bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
              }
            } else if (
              isWildCucumber &&
              (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
              state.wildSkewerPhase === 'SWING_WINDUP'
            ) {
              // Ability 1: Skewer Swing Windup (1.0s — keeps advancing toward player so spacing matters)
              state.wildSkewerTimer -= dt;
              const windP = 1 - Math.max(0, state.wildSkewerTimer) / 1.0;
              bossModel.root.rotation.y = Math.atan2(bdx, bdz);
              if (!isTraining && bDist > 2.3) {
                const advSpeed = state.bossPhase === 'PHASE1' ? 2.1 : 2.7;
                bossModel.root.position.x = THREE.MathUtils.clamp(
                  bossModel.root.position.x + (bdx / bDist) * advSpeed * dt,
                  -12.5,
                  12.5
                );
                bossModel.root.position.z = THREE.MathUtils.clamp(
                  bossModel.root.position.z + (bdz / bDist) * advSpeed * dt,
                  state.bossPhase === 'WILD_PHASE3' ? -7.5 : -13.5,
                  state.bossPhase === 'WILD_PHASE3' ? 7.5 : 13.5
                );
                const advStride = Math.sin(nowSec * 12);
                bossModel.leftLeg.legGroup.rotation.x = advStride * 0.35;
                bossModel.rightLeg.legGroup.rotation.x = -advStride * 0.35;
              } else {
                bossModel.leftLeg.legGroup.rotation.x = 0;
                bossModel.rightLeg.legGroup.rotation.x = 0;
              }
              bossModel.root.position.y = 0;
              bossModel.leftLeg.knee.rotation.x = 0;
              bossModel.rightLeg.knee.rotation.x = 0;
              bossModel.upperBodyGroup.rotation.set(0.06 * windP, -0.5 * windP, 0);
              bossModel.rightArm.rotation.set(
                THREE.MathUtils.lerp(0, -1.85, windP),
                -0.38 * windP,
                -0.55 * windP
              );
              bossModel.leftArm.rotation.set(-0.3 * windP, 0.25 * windP, 0);
              bossModel.skewerGroup?.rotation.set(0.55, 0, 0);

              if (state.wildSkewerTimer <= 0) {
                state.wildSkewerPhase = 'SWING_STRIKE';
                state.wildSkewerTimer = 0.28;
                state.wildSkewerHitDone = false;
                soundFX.playKnifeSlash();
              }
            } else if (
              isWildCucumber &&
              (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
              state.wildSkewerPhase === 'SWING_STRIKE'
            ) {
              // Ability 1 Execute: Skewer Swing Strike with forward step lunge!
              state.wildSkewerTimer -= dt;
              const strikeP = 1 - Math.max(0, state.wildSkewerTimer) / 0.28;
              bossModel.root.rotation.y = Math.atan2(bdx, bdz);
              if (!isTraining && bDist > 1.8) {
                bossModel.root.position.x = THREE.MathUtils.clamp(
                  bossModel.root.position.x + (bdx / bDist) * 7.0 * dt,
                  -12.5,
                  12.5
                );
                bossModel.root.position.z = THREE.MathUtils.clamp(
                  bossModel.root.position.z + (bdz / bDist) * 7.0 * dt,
                  state.bossPhase === 'WILD_PHASE3' ? -7.5 : -13.5,
                  state.bossPhase === 'WILD_PHASE3' ? 7.5 : 13.5
                );
              }
              bossModel.upperBodyGroup.rotation.set(0.18 * (1 - strikeP), THREE.MathUtils.lerp(-0.5, 0.52, strikeP), 0);
              bossModel.rightArm.rotation.set(
                THREE.MathUtils.lerp(-1.85, 1.05, strikeP),
                THREE.MathUtils.lerp(-0.38, 0.55, strikeP),
                THREE.MathUtils.lerp(-0.55, 0.35, strikeP)
              );
              bossModel.skewerGroup?.rotation.set(0.95, 0, 0);

              if (strikeP >= 0.3 && !state.wildSkewerHitDone) {
                state.wildSkewerHitDone = true;
                const swingDmg = state.bossPhase === 'PHASE1' ? 18 : 22;
                onCoopBossEventRef.current?.({
                  type: 'WILD_SWING_IMPACT',
                  bx: bossModel.root.position.x,
                  bz: bossModel.root.position.z,
                  dmg: swingDmg,
                });
                const localSwingDist = Math.hypot(
                  playerPos.x - bossModel.root.position.x,
                  playerPos.z - bossModel.root.position.z
                );
                if (localSwingDist <= 3.85 && state.playerJumpY < 1.35) {
                  if (damagePlayer(swingDmg, `УДАР ШАМПУРОМ! Wild Огурец нанёс ${swingDmg} урона!`, 1.8)) {
                    soundFX.playBossHit();
                    spawnFlash(playerPos.x, 1.3, playerPos.z, 0x991b1b, 1.6);
                  }
                }
              }

              if (state.wildSkewerTimer <= 0) {
                state.wildSkewerPhase = 'NONE';
                state.wildSkewerSwingCd = state.bossPhase === 'PHASE1' ? 2.7 : 2.3;
                bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                bossModel.rightArm.rotation.set(0, 0, 0);
                bossModel.leftArm.rotation.set(0, 0, 0);
                bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
              }
            } else if (isWildCucumber && state.wildSlamPhase === 'JUMPING') {
              // Phase 2 Ability 1: Overhead Slam (1.0s jump, red glow under player, 30 HP + 1.5s stun)
              state.wildSlamTimer -= dt;
              const p = 1 - Math.max(0, state.wildSlamTimer) / 1.0;
              if (p < 0.28) {
                state.wildSlamTargetX = THREE.MathUtils.lerp(
                  state.wildSlamTargetX,
                  THREE.MathUtils.clamp(bossTarget.x, -12.0, 12.0),
                  Math.min(1, dt * 11)
                );
                state.wildSlamTargetZ = THREE.MathUtils.lerp(
                  state.wildSlamTargetZ,
                  THREE.MathUtils.clamp(
                    bossTarget.z,
                    state.bossPhase === 'WILD_PHASE3' ? -7.2 : -12.8,
                    state.bossPhase === 'WILD_PHASE3' ? 7.2 : 12.8
                  ),
                  Math.min(1, dt * 11)
                );
              }

              bossModel.root.position.x = THREE.MathUtils.lerp(state.wildSlamStartX, state.wildSlamTargetX, p);
              bossModel.root.position.z = THREE.MathUtils.lerp(state.wildSlamStartZ, state.wildSlamTargetZ, p);
              bossModel.root.position.y = Math.sin(p * Math.PI) * 8.4;
              bossModel.root.rotation.y = Math.atan2(
                state.wildSlamTargetX - state.wildSlamStartX,
                state.wildSlamTargetZ - state.wildSlamStartZ
              );
              bossModel.upperBodyGroup.rotation.set(p < 0.65 ? -0.25 : 0.48 * ((p - 0.65) / 0.35), 0, 0);
              bossModel.rightArm.rotation.set(p < 0.65 ? -2.25 : THREE.MathUtils.lerp(-2.25, 1.05, (p - 0.65) / 0.35), 0, 0);
              bossModel.leftArm.rotation.set(-1.1, 0, 0);
              bossModel.skewerGroup?.rotation.set(0.95, 0, 0);

              wildSlamRingGroup.visible = true;
              wildSlamRingGroup.position.set(state.wildSlamTargetX, 0.05, state.wildSlamTargetZ);
              wildSlamOuterMat.opacity = 0.72 + Math.sin(nowSec * 24) * 0.25;
              wildSlamFillMat.opacity = 0.2 + p * 0.38;
              wildSlamInner.scale.setScalar(0.35 + p * 2.45);

              if (state.wildSlamTimer <= 0) {
                state.wildSlamPhase = 'NONE';
                state.dimaAbilityGapTimer = 1.4;
                wildSlamRingGroup.visible = false;
                bossModel.root.position.set(state.wildSlamTargetX, 0, state.wildSlamTargetZ);
                bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                bossModel.rightArm.rotation.set(0, 0, 0);
                bossModel.leftArm.rotation.set(0, 0, 0);
                bossModel.skewerGroup?.rotation.set(0.72, 0, 0);
                soundFX.playExplosion();
                soundFX.playBellySlam();
                triggerScreenShake(0.55, 1.2);
                spawnFlash(state.wildSlamTargetX, 0.6, state.wildSlamTargetZ, 0xef4444, 4.6);
                onCoopBossEventRef.current?.({
                  type: 'WILD_SLAM_IMPACT',
                  x: state.wildSlamTargetX,
                  z: state.wildSlamTargetZ,
                  dmg: 30,
                });

                const dSlam = Math.hypot(playerPos.x - state.wildSlamTargetX, playerPos.z - state.wildSlamTargetZ);
                if (dSlam <= 3.4 && state.playerJumpY < 2.2) {
                  if (
                    damagePlayer(
                      30,
                      'УДАР СВЕРХУ! Wild Огурец обрушился на тебя (-30 HP · СТАН 1.5с)!',
                      2.4
                    )
                  ) {
                    state.playerStunTimer = 1.5;
                    state.dodgeTimer = 0;
                    soundFX.playBossHit();
                  }
                }
              }
            } else if (isWildCucumber && state.wildJarPhase !== 'NONE') {
              // Phase 2 Ability 2: Jar on Chains Throw (1s windup, 30s CD, pull + 40 dmg + pushback)
              const bx = bossModel.root.position.x;
              const bz = bossModel.root.position.z;
              const yawToPlayer = Math.atan2(bdx, bdz);

              if (state.wildJarPhase === 'JAR_WINDUP') {
                state.wildJarTimer -= dt;
                const wP = 1 - Math.max(0, state.wildJarTimer) / 1.0;
                bossModel.root.rotation.y = yawToPlayer;
                bossModel.root.position.y = 0;
                bossModel.leftLeg.legGroup.rotation.x = 0;
                bossModel.rightLeg.legGroup.rotation.x = 0;
                bossModel.leftLeg.knee.rotation.x = 0;
                bossModel.rightLeg.knee.rotation.x = 0;
                bossModel.upperBodyGroup.rotation.set(0.08 * wP, 0.55 * wP, 0);
                bossModel.leftArm.rotation.set(THREE.MathUtils.lerp(-0.4, -2.15, wP), -0.35 * wP, -0.3);
                bossModel.rightArm.rotation.set(0.3, 0, 0);

                if (wP >= 0.42) {
                  if (bossModel.backJarGroup) bossModel.backJarGroup.visible = false;
                  thrownJarGroup.visible = true;
                  const spinAng = nowSec * 14;
                  const handX = bx - Math.cos(yawToPlayer) * 0.85 + Math.sin(yawToPlayer + spinAng) * 0.45;
                  const handZ = bz + Math.sin(yawToPlayer) * 0.85 + Math.cos(yawToPlayer + spinAng) * 0.45;
                  const handY = 2.55 + Math.sin(wP * Math.PI) * 0.45;
                  thrownJarGroup.position.set(handX, handY, handZ);
                  thrownJarGroup.rotation.set(spinAng, yawToPlayer, 0.4);
                  updateJarChain(bx, 1.9, bz, handX, handY, handZ, 0.15);
                }

                if (state.wildJarTimer <= 0) {
                  state.wildJarPhase = 'JAR_FLYING';
                  state.wildJarTimer = 0.58;
                  state.wildJarDirX = bdx / bDist;
                  state.wildJarDirZ = bdz / bDist;
                  state.wildJarPosX = bx + state.wildJarDirX * 0.95;
                  state.wildJarPosY = 1.6;
                  state.wildJarPosZ = bz + state.wildJarDirZ * 0.95;
                  soundFX.playBossDash();
                  triggerScreenShake(0.24, 1.8);
                }
              } else if (state.wildJarPhase === 'JAR_FLYING') {
                state.wildJarTimer -= dt;
                bossModel.root.rotation.y = Math.atan2(state.wildJarDirX, state.wildJarDirZ);
                bossModel.upperBodyGroup.rotation.set(0.22, -0.25, 0);
                bossModel.leftArm.rotation.set(0.85, 0.25, 0);

                state.wildJarPosX += state.wildJarDirX * 30 * dt;
                state.wildJarPosZ += state.wildJarDirZ * 30 * dt;
                thrownJarGroup.visible = true;
                thrownJarGroup.position.set(state.wildJarPosX, state.wildJarPosY, state.wildJarPosZ);
                thrownJarGroup.rotation.x += dt * 14;
                thrownJarGroup.rotation.z += dt * 9;
                updateJarChain(bx, 1.85, bz, state.wildJarPosX, state.wildJarPosY, state.wildJarPosZ, 0.28);

                const distToPlayer = Math.hypot(playerPos.x - state.wildJarPosX, playerPos.z - state.wildJarPosZ);
                const outOfArena = Math.abs(state.wildJarPosX) > 13.8 || Math.abs(state.wildJarPosZ) > 14.5;

                if (distToPlayer < 1.38 && state.playerJumpY < 1.65) {
                  if (state.lupikKnifePhase !== 'NONE') {
                    // Lupik knife IFRAME ignores it
                  } else if (state.dodgeIframeTimer > 0) {
                    state.wildJarPhase = 'JAR_RETRACT';
                    state.wildJarTimer = 0.32;
                    soundFX.playDodgeEvade();
                    setBanner('УКЛОНЕНИЕ! Банка с огурцами пролетела мимо (IFRAME)!', 1.5);
                  } else {
                    state.wildJarPhase = 'JAR_PULL';
                    state.wildJarTimer = 0.42;
                    state.wildJarPullStartX = playerPos.x;
                    state.wildJarPullStartZ = playerPos.z;
                    state.dodgeTimer = 0;
                    state.playerJumpY = 0;
                    state.playerVelY = 0;
                    soundFX.playArmorBreak();
                    triggerScreenShake(0.32, 1.6);
                    spawnFlash(playerPos.x, 1.4, playerPos.z, 0x4ade80, 2.2);
                    setBanner('ПОПАЛСЯ НА ЦЕПИ! Банка с огурцами тащит тебя к Wild Огурцу!', 2.0);
                  }
                } else if (outOfArena || state.wildJarTimer <= 0) {
                  state.wildJarPhase = 'JAR_RETRACT';
                  state.wildJarTimer = 0.32;
                }
              } else if (state.wildJarPhase === 'JAR_PULL') {
                state.wildJarTimer -= dt;
                const pullP = 1 - Math.max(0, state.wildJarTimer) / 0.42;
                const easePull = 1 - Math.pow(1 - pullP, 2);
                const targetX = THREE.MathUtils.clamp(bx + state.wildJarDirX * 2.1, -12.6, 12.6);
                const targetZ = THREE.MathUtils.clamp(bz + state.wildJarDirZ * 2.1, -13.3, 13.3);
                playerPos.x = THREE.MathUtils.lerp(state.wildJarPullStartX, targetX, easePull);
                playerPos.z = THREE.MathUtils.lerp(state.wildJarPullStartZ, targetZ, easePull);

                bossModel.root.rotation.y = Math.atan2(state.wildJarDirX, state.wildJarDirZ);
                bossModel.upperBodyGroup.rotation.set(-0.24 * easePull, 0, 0);
                bossModel.leftArm.rotation.set(THREE.MathUtils.lerp(0.85, -0.55, easePull), 0, 0);
                bossModel.rightArm.rotation.set(-0.45 * easePull, 0, 0);

                thrownJarGroup.position.set(playerPos.x, 1.4, playerPos.z);
                thrownJarGroup.rotation.y += dt * 10;
                updateJarChain(bx, 1.85, bz, playerPos.x, 1.4, playerPos.z, 0.1);

                if (state.wildJarTimer <= 0) {
                  hideJarAndChain();
                  const hitOk = damagePlayer(32, 'УДАР БАНКОЙ С ОГУРЦАМИ! -32 HP и отброс назад!', 2.4);
                  if (hitOk) {
                    soundFX.playBossHit();
                  }
                  if (state.outcome === 'ACTIVE') {
                    state.wildJarPhase = 'JAR_PUSH';
                    state.wildJarTimer = 0.52;
                    state.wildJarPushStartX = playerPos.x;
                    state.wildJarPushStartZ = playerPos.z;
                    soundFX.playExplosion();
                    soundFX.playBellySlam();
                    triggerScreenShake(0.55, 1.25);
                    spawnFlash(playerPos.x, 1.4, playerPos.z, 0xc084fc, 3.0);
                  } else {
                    state.wildJarPhase = 'NONE';
                  }
                }
              } else if (state.wildJarPhase === 'JAR_PUSH') {
                state.wildJarTimer -= dt;
                const pushP = 1 - Math.max(0, state.wildJarTimer) / 0.52;
                const easePush = 1 - Math.pow(1 - pushP, 2);
                playerPos.x = THREE.MathUtils.clamp(state.wildJarPushStartX + state.wildJarDirX * 7.5 * easePush, -12.8, 12.8);
                playerPos.z = THREE.MathUtils.clamp(state.wildJarPushStartZ + state.wildJarDirZ * 7.5 * easePush, -13.5, 13.5);

                bossModel.root.rotation.y = Math.atan2(state.wildJarDirX, state.wildJarDirZ);
                bossModel.upperBodyGroup.rotation.set(0.32 * (1 - pushP), 0, 0);
                bossModel.leftArm.rotation.set(THREE.MathUtils.lerp(-0.55, 0.9, Math.min(1, pushP * 2)), 0, 0);
                bossModel.rightArm.rotation.set(THREE.MathUtils.lerp(-0.45, 0.9, Math.min(1, pushP * 2)), 0, 0);

                if (state.wildJarTimer <= 0) {
                  state.wildJarPhase = 'NONE';
                  state.dimaAbilityGapTimer = 1.4;
                  bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                  bossModel.leftArm.rotation.set(0, 0, 0);
                  bossModel.rightArm.rotation.set(0, 0, 0);
                }
              } else if (state.wildJarPhase === 'JAR_RETRACT') {
                state.wildJarTimer -= dt;
                const retP = 1 - Math.max(0, state.wildJarTimer) / 0.32;
                const rx = THREE.MathUtils.lerp(state.wildJarPosX, bx, retP);
                const ry = THREE.MathUtils.lerp(state.wildJarPosY, 2.0, retP);
                const rz = THREE.MathUtils.lerp(state.wildJarPosZ, bz, retP);
                thrownJarGroup.position.set(rx, ry, rz);
                updateJarChain(bx, 1.9, bz, rx, ry, rz, 0.12);
                if (state.wildJarTimer <= 0) {
                  hideJarAndChain();
                  state.wildJarPhase = 'NONE';
                  state.dimaAbilityGapTimer = 1.0;
                  bossModel.upperBodyGroup.rotation.set(0, 0, 0);
                  bossModel.leftArm.rotation.set(0, 0, 0);
                  bossModel.rightArm.rotation.set(0, 0, 0);
                }
              }
            } else if (state.dimaSisterPhase !== 'ARGUING') {
              // Check Phase 1, Phase 2 & Phase 3 Wild Cucumber Ability Triggers
              if (
                isWildCucumber &&
                (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
                state.wildSkewerPhase === 'NONE' &&
                state.wildSlamPhase === 'NONE' &&
                state.wildJarPhase === 'NONE' &&
                state.dimaUltPhase === 'NONE'
              ) {
                if (
                  (state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
                  !isTraining &&
                  state.wildPawPhase === 'NONE' &&
                  state.dimaAbilityGapTimer <= 0 &&
                  state.wildSlamCd <= 0 &&
                  bDist <= 18.0
                ) {
                  state.wildSlamPhase = 'JUMPING';
                  state.wildSlamTimer = 1.0;
                  state.wildSlamCd = state.bossPhase === 'WILD_PHASE3' ? 12.5 : 14.0;
                  state.wildSlamStartX = bossModel.root.position.x;
                  state.wildSlamStartZ = bossModel.root.position.z;
                  state.wildSlamTargetX = THREE.MathUtils.clamp(bossTarget.x, -12.0, 12.0);
                  state.wildSlamTargetZ = THREE.MathUtils.clamp(
                    bossTarget.z,
                    state.bossPhase === 'WILD_PHASE3' ? -7.2 : -12.8,
                    state.bossPhase === 'WILD_PHASE3' ? 7.2 : 12.8
                  );
                  soundFX.playBossJump();
                  const slamBanner = 'УДАР СВЕРХУ! Wild Огурец подпрыгнул — выходи из красного свечения (30 HP + стан)!';
                  setBanner(slamBanner, 2.0);
                  onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: slamBanner, dur: 2.0 });
                } else if (
                  (state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3') &&
                  !isTraining &&
                  state.wildPawPhase === 'NONE' &&
                  state.dimaAbilityGapTimer <= 0 &&
                  state.wildJarCd <= 0 &&
                  bDist <= 17.5
                ) {
                  state.wildJarPhase = 'JAR_WINDUP';
                  state.wildJarTimer = 1.0;
                  state.wildJarCd = 24.0;
                  soundFX.playArmorBreak();
                  const jarBanner = 'БРОСОК БАНКИ НА ЦЕПЯХ! Wild Огурец замахивается банкой со спины (1с · 32 HP)!';
                  setBanner(jarBanner, 2.2);
                  onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: jarBanner, dur: 2.2 });
                } else if (
                  !isTraining &&
                  state.wildPawPhase === 'NONE' &&
                  state.dimaAbilityGapTimer <= 0 &&
                  state.wildSkewerLungeCd <= 0 &&
                  bDist <= 15.5
                ) {
                  state.wildSkewerPhase = 'LUNGE_STANCE';
                  state.wildSkewerTimer = 1.5;
                  state.wildSkewerHitDone = false;
                  soundFX.playArmorBreak();
                  const lungeBanner = 'СТОЙКА! Wild Огурец наводит шампур (1,5с) — уходи с линии или [F]!';
                  setBanner(lungeBanner, 2.2);
                  onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: lungeBanner, dur: 2.2 });
                } else if (state.wildSkewerSwingCd <= 0 && bDist <= 3.85) {
                  state.wildSkewerPhase = 'SWING_WINDUP';
                  state.wildSkewerTimer = 1.0;
                  state.wildSkewerHitDone = false;
                  soundFX.playQtePrompt();
                  setBanner('ЗАМАХ ШАМПУРОМ! Wild Огурец замахивается (1с) — отойди или [F]!', 1.5);
                }
              }

              bossModel.root.rotation.y = Math.atan2(bdx, bdz);
              if (state.wildSkewerPhase === 'NONE' && state.wildSlamPhase === 'NONE' && state.wildJarPhase === 'NONE') {
                if (!isTraining && bDist > (isWildCucumber ? 2.8 : 3.2)) {
                  const baseBossSpeed = isWildCucumber
                    ? state.bossPhase === 'WILD_PHASE3'
                      ? 8.2
                      : state.bossPhase === 'HC_PHASE2'
                      ? 7.5
                      : 6.8
                    : isHardcore
                    ? state.bossPhase === 'LAST_BREATH'
                      ? 6.4
                      : state.bossPhase === 'HC_PHASE2'
                      ? 6.8
                      : 5.5
                    : state.bossPhase === 'LAST_BREATH'
                    ? 3.9
                    : state.bossHp < 2500
                    ? 4.0
                    : 3.1;
                  const radarSlowMult = state.radarLeft > 0 ? 0.85 : 1.0;
                  const artemSlowMult = state.artemSlowLeft > 0 ? 0.8 : 1.0;
                  const bossSpeed = baseBossSpeed * staggerSpeedMult * radarSlowMult * artemSlowMult;

                  bossModel.root.position.x = THREE.MathUtils.clamp(
                    bossModel.root.position.x + (bdx / bDist) * bossSpeed * dt,
                    -12.5,
                    12.5
                  );
                  bossModel.root.position.z = THREE.MathUtils.clamp(
                    bossModel.root.position.z + (bdz / bDist) * bossSpeed * dt,
                    state.bossPhase === 'WILD_PHASE3' ? -7.5 : -13.5,
                    state.bossPhase === 'WILD_PHASE3' ? 7.5 : 13.5
                  );

                  // Running stride animation (faster & higher cadence in Hardcore!)
                  const strideFreq = isHardcore ? 15 : 8.5;
                  const strideAmp = isHardcore ? 0.62 : 0.34;
                  const stride = Math.sin(nowSec * strideFreq);
                  bossModel.leftLeg.legGroup.rotation.x = stride * strideAmp;
                  bossModel.rightLeg.legGroup.rotation.x = -stride * strideAmp;
                  bossModel.leftLeg.knee.rotation.x = Math.max(0, -stride * 0.55);
                  bossModel.rightLeg.knee.rotation.x = Math.max(0, stride * 0.55);
                  bossModel.leftArm.rotation.x = -stride * 0.25 + staggerArmFlinch;
                  bossModel.rightArm.rotation.x = stride * 0.25 + staggerArmFlinch;
                  bossModel.root.position.y = Math.abs(stride) * (isHardcore ? 0.12 : 0.04);
                } else {
                  bossModel.leftLeg.legGroup.rotation.x = 0;
                  bossModel.rightLeg.legGroup.rotation.x = 0;
                  bossModel.leftLeg.knee.rotation.x = 0;
                  bossModel.rightLeg.knee.rotation.x = 0;
                  bossModel.leftArm.rotation.x = staggerArmFlinch;
                  bossModel.rightArm.rotation.x = staggerArmFlinch;
                  bossModel.root.position.y = 0;

                  if (
                    !(
                      isWildCucumber &&
                      (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2' || state.bossPhase === 'WILD_PHASE3')
                    ) &&
                    bDist <= 3.2 &&
                    state.dimaMeleeCd <= 0
                  ) {
                    state.dimaMeleeCd = isHardcore ? 2.1 : 2.6;
                    const meleeDmg = getBossDmg(8);
                    onCoopBossEventRef.current?.({
                      type: 'MELEE_STRIKE',
                      bx: bossModel.root.position.x,
                      bz: bossModel.root.position.z,
                      dmg: meleeDmg,
                    });
                    const localMeleeDist = Math.hypot(
                      playerPos.x - bossModel.root.position.x,
                      playerPos.z - bossModel.root.position.z
                    );
                    if (localMeleeDist <= 3.25 && damagePlayer(meleeDmg)) {
                      soundFX.playBossHit();
                    }
                  }
                }

                // Fire Mouse Wires / Shards (Wild Cucumber shoots 3 medium volleys across all phases without stacking specials)
                if (
                  state.dimaWireCd <= 0 &&
                  (isWildCucumber
                    ? state.dimaUltPhase === 'NONE' &&
                      state.wildPawPhase === 'NONE' &&
                      state.dimaAbilityGapTimer <= 0
                    : state.bossPhase !== 'WILD_PHASE3' && !dimaSpecialBusy)
                ) {
                  if (isWildCucumber) {
                    state.dimaWireCd =
                      state.bossPhase === 'PHASE1' ? 8.5 : state.bossPhase === 'HC_PHASE2' ? 7.5 : 9.0;
                    soundFX.playWireShot();
                    triggerScreenShake(0.14, 2.2);
                    const wireDmg = state.bossPhase === 'PHASE1' ? 11 : 14;
                    const wireBanner = `Wild Огурец запускает веер снарядов (по ${wireDmg} HP)!`;
                    setBanner(wireBanner, 2.0);
                    const baseAngle = Math.atan2(bdx, bdz);
                    const netWires: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; dmg: number }> = [];
                    for (const spread of [-0.18, 0, 0.18]) {
                      const ang = baseAngle + spread;
                      const w = {
                        x: bossModel.root.position.x,
                        y: 1.65,
                        z: bossModel.root.position.z,
                        vx: Math.sin(ang) * 17.5,
                        vy: 0,
                        vz: Math.cos(ang) * 17.5,
                        dmg: wireDmg,
                      };
                      netWires.push(w);
                      spawnProjectile(w.x, w.y, w.z, w.vx, w.vy, w.vz, w.dmg, false, 'MOUSE_WIRE');
                    }
                    onCoopBossEventRef.current?.({
                      type: 'WIRE_SHOT',
                      wires: netWires,
                      banner: wireBanner,
                    });
                  } else {
                    state.dimaWireCd = 11;
                    soundFX.playWireShot();
                    triggerScreenShake(0.13, 2.3);
                    const wireDmg = getBossDmg(10);
                    const wireBanner = `${bossShortName} стреляет проводами от мышки (по ${wireDmg} HP)!`;
                    setBanner(wireBanner, 2.2);
                    const baseAngle = Math.atan2(bdx, bdz);
                    const netWires: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; dmg: number }> = [];
                    for (const spread of [-0.11, 0.11]) {
                      const ang = baseAngle + spread;
                      const w = {
                        x: bossModel.root.position.x,
                        y: 1.65,
                        z: bossModel.root.position.z,
                        vx: Math.sin(ang) * 16.5,
                        vy: 0,
                        vz: Math.cos(ang) * 16.5,
                        dmg: wireDmg,
                      };
                      netWires.push(w);
                      spawnProjectile(w.x, w.y, w.z, w.vx, w.vy, w.vz, w.dmg, false, 'MOUSE_WIRE');
                    }
                    onCoopBossEventRef.current?.({
                      type: 'WIRE_SHOT',
                      wires: netWires,
                      banner: wireBanner,
                    });
                  }
                }
              }
            }

            // Phase 3 Spectral Dog Spirit: Two Huge Floating Ghostly Paws + "Удар лапой" (1s windup, 28 DMG, 8.5s CD)
            if (isWildCucumber && state.bossPhase === 'WILD_PHASE3') {
              ghostPawsGroup.visible = true;
              ghostPawsGroup.scale.setScalar(1);
              const bx = bossModel.root.position.x;
              const bz = bossModel.root.position.z;
              const facingSign = bossTarget.x >= bx ? 1 : -1;
              const lookYaw = Math.atan2(bdx, bdz);

              leftGhostPaw.position.set(
                bx - facingSign * 0.95,
                3.15 + Math.sin(nowSec * 3.1) * 0.18,
                bz - 0.85
              );
              leftGhostPaw.rotation.set(0.32 + Math.sin(nowSec * 2.2) * 0.1, lookYaw, 0.12);
              leftGhostPaw.scale.setScalar(1.0);

              if (
                state.wildPawPhase === 'NONE' &&
                state.wildPawCd <= 0 &&
                state.wildSkewerPhase === 'NONE' &&
                state.wildSlamPhase === 'NONE' &&
                state.wildJarPhase === 'NONE' &&
                state.dimaUltPhase === 'NONE' &&
                state.dimaAbilityGapTimer <= 0
              ) {
                state.wildPawPhase = 'PAW_WINDUP';
                state.wildPawTimer = 1.0;
                state.wildPawCd = 12.5;
                state.wildPawHitDone = false;
                state.wildPawTargetX = THREE.MathUtils.clamp(bossTarget.x, -12.0, 12.0);
                state.wildPawTargetZ = THREE.MathUtils.clamp(bossTarget.z, -7.2, 7.2);
                soundFX.playQtePrompt();
                const pawBanner = 'УДАР ЛАПОЙ! Призрачная лапа пса замахивается (1с · 22 урона)!';
                setBanner(pawBanner, 2.0);
                onCoopBossEventRef.current?.({ type: 'BOSS_BANNER', text: pawBanner, dur: 2.0 });
              }

              if (state.wildPawPhase === 'PAW_WINDUP') {
                state.wildPawTimer -= dt;
                const wP = 1 - Math.max(0, state.wildPawTimer) / 1.0;
                if (wP < 0.28) {
                  state.wildPawTargetX = THREE.MathUtils.lerp(
                    state.wildPawTargetX,
                    THREE.MathUtils.clamp(bossTarget.x, -12.0, 12.0),
                    Math.min(1, dt * 11)
                  );
                  state.wildPawTargetZ = THREE.MathUtils.lerp(
                    state.wildPawTargetZ,
                    THREE.MathUtils.clamp(bossTarget.z, -7.2, 7.2),
                    Math.min(1, dt * 11)
                  );
                }
                rightGhostPaw.position.set(
                  THREE.MathUtils.lerp(bx + facingSign * 0.85, state.wildPawTargetX, Math.min(1, wP * 1.35)),
                  3.3 + Math.sin(wP * Math.PI * 0.5) * 2.3,
                  THREE.MathUtils.lerp(bz + 0.85, state.wildPawTargetZ, Math.min(1, wP * 1.35))
                );
                rightGhostPaw.rotation.set(THREE.MathUtils.lerp(0.3, -0.58, wP), lookYaw, 0);
                rightGhostPaw.scale.setScalar(1.0 + wP * 0.55);

                pawSlamRingGroup.visible = true;
                pawSlamRingGroup.position.set(state.wildPawTargetX, 0.055, state.wildPawTargetZ);
                pawSlamOuterMat.opacity = 0.72 + Math.sin(nowSec * 24) * 0.25;
                pawSlamFillMat.opacity = 0.22 + wP * 0.36;
                pawSlamInner.scale.setScalar(0.35 + wP * 2.35);

                if (state.wildPawTimer <= 0) {
                  state.wildPawPhase = 'PAW_STRIKE';
                  state.wildPawTimer = 0.45;
                  soundFX.playBossDash();
                }
              } else if (state.wildPawPhase === 'PAW_STRIKE') {
                state.wildPawTimer -= dt;
                const sP = 1 - Math.max(0, state.wildPawTimer) / 0.45;
                const dropP = Math.min(1, sP / 0.32);
                rightGhostPaw.position.set(
                  state.wildPawTargetX,
                  THREE.MathUtils.lerp(5.6, 0.32, dropP * dropP),
                  state.wildPawTargetZ
                );
                rightGhostPaw.rotation.set(THREE.MathUtils.lerp(-0.58, 0.22, dropP), lookYaw, 0);
                rightGhostPaw.scale.setScalar(1.55);

                if (!state.wildPawHitDone && sP >= 0.28) {
                  state.wildPawHitDone = true;
                  pawSlamRingGroup.visible = false;
                  soundFX.playBellySlam();
                  soundFX.playExplosion();
                  triggerScreenShake(0.45, 1.35);
                  spawnFlash(state.wildPawTargetX, 0.45, state.wildPawTargetZ, 0xc084fc, 3.8);
                  onCoopBossEventRef.current?.({
                    type: 'WILD_PAW_IMPACT',
                    x: state.wildPawTargetX,
                    z: state.wildPawTargetZ,
                    dmg: 22,
                  });
                  const dPaw = Math.hypot(playerPos.x - state.wildPawTargetX, playerPos.z - state.wildPawTargetZ);
                  if (dPaw <= 3.4 && state.playerJumpY < 1.55) {
                    if (damagePlayer(22, 'УДАР ЛАПОЙ! Призрачная лапа пса нанесла 22 урона!', 2.0)) {
                      soundFX.playBossHit();
                    }
                  }
                }

                if (state.wildPawTimer <= 0) {
                  state.wildPawPhase = 'NONE';
                  state.dimaAbilityGapTimer = 1.1;
                  pawSlamRingGroup.visible = false;
                  rightGhostPaw.scale.setScalar(1);
                }
              } else {
                pawSlamRingGroup.visible = false;
                rightGhostPaw.position.set(
                  bx + facingSign * 0.85,
                  3.25 + Math.cos(nowSec * 2.8) * 0.18,
                  bz + 0.85
                );
                rightGhostPaw.rotation.set(0.32 + Math.cos(nowSec * 2.4) * 0.1, lookYaw, -0.12);
                rightGhostPaw.scale.setScalar(1.0);
              }
            } else {
              ghostPawsGroup.visible = false;
              pawSlamRingGroup.visible = false;
            }
          }
        }
      }

      // Projectiles update
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.kind === 'SHASHLIK' || p.kind === 'CUCUMBER') p.mesh.rotation.y += dt * 12;
        if (p.kind === 'MOUSE_WIRE') p.mesh.rotation.y = Math.atan2(p.vx, p.vz);

        let remove = p.life <= 0 || p.mesh.position.y < 0;
        let hitBoss = false;
        if (!remove && state.outcome === 'ACTIVE' && state.bossPhase !== 'STOMPING') {
          if (p.fromPlayer) {
            const distXZ = Math.hypot(
              p.mesh.position.x - bossModel.root.position.x,
              p.mesh.position.z - bossModel.root.position.z
            );
            const hitHeightMax = state.dimaUltPhase !== 'NONE' ? 6.8 : 3.7;
            const hitRadiusBonus = state.dimaUltPhase !== 'NONE' ? 1.7 : 0.95;
            const hitY =
              p.mesh.position.y >= Math.min(0, bossModel.root.position.y) &&
              p.mesh.position.y <= bossModel.root.position.y + hitHeightMax;
            if (distXZ < p.radius + hitRadiusBonus && hitY) {
              hitBoss = true;
              if (state.bossPhase === 'PHASE2_INTRO') {
                spawnFlash(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, isWildCucumber ? 0xa855f7 : 0x38bdf8, 1.2);
                if (!p.isVisualOnly) {
                  setBanner(
                    `${bossShortName} НЕУЯЗВИМ во время превращения в ${isHardcore ? '3-ю' : '2-ю'} фазу!`,
                    1.2
                  );
                }
                remove = true;
              } else {
                if (!p.isVisualOnly) {
                  const finalDmg = state.radarLeft > 0 ? Math.round(p.damage * 1.2) : p.damage;
                  applyBossHit(finalDmg, p.kind as 'SHOTGUN' | 'SHASHLIK' | 'CUCUMBER' | 'SHELL');
                  if (fighter === 'ARTEM' && p.kind === 'SHELL' && state.bossPhase !== 'WILD_PHASE3_INTRO') {
                    state.artemHitStreak = Math.min(4, state.artemHitStreak + 1);
                  }
                  if (
                    fighter === 'EGOR' &&
                    (p.kind === 'SHASHLIK' || p.kind === 'CUCUMBER') &&
                    state.radarLeft > 0 &&
                    state.egorPickleDropsLeft > 0
                  ) {
                    state.egorRadarHitCounter += 1;
                    if (state.egorRadarHitCounter % 4 === 0) {
                      state.egorPickleDropsLeft -= 1;
                      spawnFallingPickle(bossModel.root.position.x, bossModel.root.position.z);
                      setBanner(
                        `4-е ПОПАДАНИЕ ПО РАССОЛУ! Солёный огурец (${EGOR_PICKLE_DROP_DMG} DMG) падает с неба!`,
                        2.0
                      );
                    }
                  }
                  if (state.bossPhase === 'PHASE1' || state.bossPhase === 'HC_PHASE2') {
                    soundFX.playBossHit();
                    spawnFlash(
                      p.mesh.position.x,
                      p.mesh.position.y,
                      p.mesh.position.z,
                      p.kind === 'CUCUMBER' ? 0x4ade80 : 0xfbbf24,
                      1.4
                    );
                  }
                } else {
                  spawnFlash(
                    p.mesh.position.x,
                    p.mesh.position.y,
                    p.mesh.position.z,
                    p.kind === 'CUCUMBER' ? 0x4ade80 : 0xfbbf24,
                    1.15
                  );
                }
                remove = true;
              }
            }
          } else {
            const dist = Math.hypot(p.mesh.position.x - playerPos.x, p.mesh.position.z - playerPos.z);
            if (dist < p.radius + 0.45 && state.playerJumpY < 1.15) {
              if (damagePlayer(p.damage)) {
                soundFX.playQteMiss();
              }
              remove = true;
            }
          }
        }

        if (remove) {
          if (
            !hitBoss &&
            p.fromPlayer &&
            !p.isVisualOnly &&
            fighter === 'ARTEM' &&
            p.kind === 'SHELL' &&
            state.artemHitStreak > 0 &&
            state.bossPhase !== 'PHASE2_INTRO' &&
            state.bossPhase !== 'WILD_PHASE3_INTRO'
          ) {
            state.artemHitStreak = 0;
          }
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
        }
      }

      // Falling bombs (Artem's 67001 Airstrike & Egor's Radar Salty Pickle drops)
      for (let i = fallingBombs.length - 1; i >= 0; i--) {
        const b = fallingBombs[i];
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        b.y -= (b.isPickleDrop ? 28 : 24) * dt;
        b.mesh.position.y = Math.max(0, b.y);
        if (b.isPickleDrop) {
          b.mesh.rotation.y += dt * 7;
        }
        if (b.y <= 0.4 && !b.exploded) {
          b.exploded = true;
          if (b.isPickleDrop) {
            soundFX.playBellySlam();
            spawnFlash(b.targetX, 0.8, b.targetZ, 0x22c55e, 3.8);
          } else {
            soundFX.playExplosion();
            spawnFlash(b.targetX, 0.8, b.targetZ, 0xf97316, 4.4);
          }
          if (b.damage > 0 && state.outcome === 'ACTIVE' && state.bossPhase !== 'STOMPING') {
            const dist = Math.hypot(b.targetX - bossModel.root.position.x, b.targetZ - bossModel.root.position.z);
            if (dist < 5.4) {
              applyBossHit(b.damage, 'BOMB');
              if (b.isArtemAirstrike) {
                state.artemSlowLeft = ARTEM_SLOW_DURATION;
              }
            }
          }
          scene.remove(b.mesh);
          scene.remove(b.ring);
          fallingBombs.splice(i, 1);
        }
      }

      // Sky Lasers (Ability 3: 7 Sky Lasers, 10 DMG each — paused during Lupik Knife IFRAME)
      for (let i = skyLasers.length - 1; i >= 0; i--) {
        const l = skyLasers[i];
        if (l.phase === 'WARN') {
          if (state.lupikKnifePhase === 'NONE' && state.wildSkewerPhase !== 'IMPALE_CUTSCENE') {
            l.warnTimer -= dt;
          }
          (l.ring.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(nowSec * 22) * 0.3;
          (l.aimLine.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(nowSec * 24) * 0.25;
          if (l.warnTimer <= 0) {
            l.phase = 'STRIKE';
            l.aimLine.visible = false;
            l.beam.visible = true;
            soundFX.playSkyLaser();
            triggerScreenShake(0.26, 2.0);
            spawnFlash(l.x, 0.45, l.z, 0xf43f5e, 2.3);
            if (state.outcome === 'ACTIVE' && state.bossPhase !== 'STOMPING') {
              const dLaser = Math.hypot(playerPos.x - l.x, playerPos.z - l.z);
              if (dLaser < 1.95) {
                const lDmg = getBossDmg(10);
                if (damagePlayer(lDmg, `ЛАЗЕР С НЕБА! Попадание на -${lDmg} HP!`, 1.8)) {
                  soundFX.playQteMiss();
                  triggerScreenShake(0.36, 1.6);
                }
              }
            }
          }
        } else {
          l.strikeTimer -= dt;
          const p = Math.max(0, l.strikeTimer / 0.42);
          l.beam.scale.set(p, 1, p);
          (l.beam.material as THREE.MeshBasicMaterial).opacity = p * 0.92;
          (l.ring.material as THREE.MeshBasicMaterial).opacity = p * 0.65;
          if (l.strikeTimer <= 0) {
            scene.remove(l.ring);
            scene.remove(l.aimLine);
            scene.remove(l.beam);
            skyLasers.splice(i, 1);
            if (skyLasers.length === 0 && !isWildCucumber) {
              state.dimaAbilityGapTimer = 2.0;
            }
          }
        }
      }

      // Phase 2 Armor Break Debris
      for (let i = debrisList.length - 1; i >= 0; i--) {
        const d = debrisList[i];
        d.life -= dt;
        d.vy -= 18 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.rx * dt;
        d.mesh.rotation.z += d.rz * dt;
        if (d.mesh.position.y < 0.08) {
          d.mesh.position.y = 0.08;
          d.vx *= 0.6;
          d.vz *= 0.6;
          d.vy = Math.abs(d.vy) * 0.22;
          d.rx *= 0.4;
          d.rz *= 0.4;
        }
        if (d.life <= 0) {
          scene.remove(d.mesh);
          debrisList.splice(i, 1);
        }
      }

      // Realistic Dripping Blood Droplets onto Snow
      for (let i = bloodDrops.length - 1; i >= 0; i--) {
        const b = bloodDrops[i];
        b.life -= dt;
        if (!b.splatted) {
          b.vy -= 14 * dt;
          b.mesh.position.x += b.vx * dt;
          b.mesh.position.y += b.vy * dt;
          b.mesh.position.z += b.vz * dt;
          if (b.mesh.position.y <= 0.03) {
            b.splatted = true;
            b.mesh.position.y = 0.03;
            b.mesh.scale.set(2.2, 0.22, 2.2);
          }
        }
        if (b.life <= 0) {
          scene.remove(b.mesh);
          bloodDrops.splice(i, 1);
        }
      }

      // Flashes
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.life += dt;
        const ratio = f.life / f.maxLife;
        f.mesh.scale.setScalar(0.5 + ratio * (f.mesh.userData.maxScale || 2));
        (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - ratio);
        if (f.life >= f.maxLife) {
          scene.remove(f.mesh);
          flashes.splice(i, 1);
        }
      }

      // Combo Sparks (spiraling energy particles around Boss Dima & Player Hero)
      for (let i = comboSparks.length - 1; i >= 0; i--) {
        const s = comboSparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          scene.remove(s.mesh);
          comboSparks.splice(i, 1);
          continue;
        }
        s.angle += s.angularSpeed * dt;
        s.radius += s.radiusSpeed * dt;
        s.y += s.vy * dt;
        s.vy -= 2.2 * dt;
        const cx = s.orbitCenter === 'BOSS' ? bossModel.root.position.x : playerPos.x;
        const cz = s.orbitCenter === 'BOSS' ? bossModel.root.position.z : playerPos.z;
        s.mesh.position.set(cx + Math.cos(s.angle) * s.radius, Math.max(0.08, s.y), cz + Math.sin(s.angle) * s.radius);
        s.mesh.rotation.x += dt * 9;
        s.mesh.rotation.y += dt * 11;
        const lifeRatio = Math.max(0, s.life / s.maxLife);
        s.mesh.scale.setScalar(Math.max(0.01, s.baseScale * Math.pow(lifeRatio, 0.65)));
      }

      // Expanding Combo Shockwave Rings around characters
      for (let i = comboRings.length - 1; i >= 0; i--) {
        const r = comboRings[i];
        r.life += dt;
        const ratio = Math.min(1, r.life / r.maxLife);
        const cx = r.orbitCenter === 'BOSS' ? bossModel.root.position.x : playerPos.x;
        const cz = r.orbitCenter === 'BOSS' ? bossModel.root.position.z : playerPos.z;
        r.mesh.position.set(cx, r.yOffset, cz);
        r.mesh.scale.setScalar(0.6 + ratio * r.maxScale);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - ratio) * 0.82);
        if (r.life >= r.maxLife) {
          scene.remove(r.mesh);
          (r.mesh.material as THREE.Material).dispose();
          comboRings.splice(i, 1);
        }
      }

      // Dynamic Boss Shadow & Threat SpotLight (sharpens & saturates in Phase 2 / Phase 3)
      const targetThreatLevel =
        state.outcome !== 'ACTIVE' || state.bossPhase === 'STOMPING'
          ? 0
          : state.bossPhase === 'PHASE2_INTRO' || state.bossPhase === 'LAST_BREATH'
          ? 1.0
          : state.bossPhase === 'HC_PHASE2'
          ? 0.65
          : state.bossPhase === 'EXHAUSTED'
          ? 0.25
          : 0;
      shadowThreatLevel += (targetThreatLevel - shadowThreatLevel) * Math.min(1, dt * 4.5);

      const useSharpTex = shadowThreatLevel >= 0.25;
      if (useSharpTex !== usingSharpShadowTex) {
        usingSharpShadowTex = useSharpTex;
        bossShadowCoreMat.map = useSharpTex ? sharpBossShadowTex : softBossShadowTex;
        bossShadowCoreMat.needsUpdate = true;
      }

      const bxPos = bossModel.root.position.x;
      const byPos = Math.max(0, bossModel.root.position.y);
      const bzPos = bossModel.root.position.z;
      const bossRootScale = bossModel.root.scale.x;
      const heightAtten = Math.max(0.42, 1 - byPos * 0.055);
      const threatPulse = 0.5 + 0.5 * Math.sin(nowSec * (shadowThreatLevel > 0.8 ? 6.5 : 4.2));
      const specialBoost =
        state.dimaDashPhase !== 'NONE' ||
        state.dimaUltPhase !== 'NONE' ||
        state.dimaSpinWirePhase !== 'NONE'
          ? 0.2
          : 0;

      bossShadowGroup.position.set(bxPos, 0.026, bzPos);
      const shadowScale = bossRootScale * (1 + shadowThreatLevel * 0.28 + specialBoost * 0.4) * (1 - Math.min(0.28, byPos * 0.025));
      bossShadowGroup.scale.setScalar(shadowScale);

      // Core shadow gets darker, sharper, and tighter under Dima as phases escalate
      bossShadowCoreMat.opacity = Math.min(
        0.96,
        (0.46 + shadowThreatLevel * 0.46 + specialBoost * 0.15) * heightAtten
      );
      bossShadowCore.scale.setScalar(1 - shadowThreatLevel * 0.08 + threatPulse * shadowThreatLevel * 0.05);

      // Menacing saturated outer shadow halo & crimson/purple shadow rim in Phase 2 & 3
      const auraIntensity = Math.max(0, shadowThreatLevel - 0.15) / 0.85;
      bossShadowAuraMat.color.setHex(
        isWildCucumber
          ? 0x3b0764
          : state.bossPhase === 'LAST_BREATH' || state.bossPhase === 'PHASE2_INTRO'
          ? 0x450a0a
          : 0x7f1d1d
      );
      bossShadowAuraMat.opacity = Math.min(
        0.85,
        auraIntensity * (0.48 + threatPulse * 0.26 + specialBoost * 0.3) * heightAtten
      );
      bossShadowAura.scale.setScalar(1 + threatPulse * 0.12 * auraIntensity);

      bossShadowRimMat.color.setHex(
        isWildCucumber
          ? 0xc084fc
          : state.bossPhase === 'LAST_BREATH' || state.bossPhase === 'PHASE2_INTRO'
          ? 0xf43f5e
          : 0xdc2626
      );
      bossShadowRimMat.opacity = Math.min(
        0.62,
        auraIntensity * (0.24 + threatPulse * 0.26 + specialBoost * 0.25) * heightAtten
      );

      // Update arena shadows & dedicated Boss Threat SpotLight for real-time crisp cast shadow
      if (!isSoftwareGl) {
        keyLight.shadow.radius = THREE.MathUtils.lerp(3.2, 0.55, shadowThreatLevel);
      }
      if (state.bossPhase !== 'WILD_PHASE3_INTRO') {
        hemiLight.intensity = THREE.MathUtils.lerp(isWildCucumber ? 0.72 : 0.9, 0.56, shadowThreatLevel);
      }
      bossThreatSpot.position.set(bxPos + 3.6, 10.5, bzPos + 4.2);
      bossThreatSpot.target.position.set(bxPos, 1.0, bzPos);
      bossThreatSpot.target.updateMatrixWorld();
      if (state.bossPhase === 'WILD_PHASE3_INTRO') {
        bossThreatSpot.intensity = 3.6;
        bossThreatSpot.penumbra = 0.35;
        bossThreatSpot.color.setHex(0xdcfce7);
      } else {
        bossThreatSpot.intensity = shadowThreatLevel * (3.2 + threatPulse * 1.4 + specialBoost * 2.2);
        bossThreatSpot.penumbra = THREE.MathUtils.lerp(0.45, 0.04, shadowThreatLevel);
        bossThreatSpot.color.setHex(
          isWildCucumber
            ? 0xa855f7
            : state.bossPhase === 'LAST_BREATH' || state.bossPhase === 'PHASE2_INTRO'
            ? 0xf43f5e
            : 0xf97316
        );
      }

      // Snow / Stormy Rain particles + Purple Lightning Flashes
      const posAttr = snowPointsGeo.attributes.position as THREE.BufferAttribute;
      if (isWildCucumber) {
        for (let i = 0; i < snowCount; i++) {
          let sx = posAttr.getX(i) - 4.8 * dt;
          let sy = posAttr.getY(i) - 18.5 * dt;
          if (sy < 0) {
            sy = 18;
            sx = (Math.random() - 0.5) * 44;
          } else if (sx < -22) {
            sx += 44;
          }
          posAttr.setX(i, sx);
          posAttr.setY(i, sy);
        }

        wildLightningTimer -= dt;
        if (wildLightningTimer <= 0 && wildLightningBolts.length > 0) {
          wildLightningTimer = 1.8 + Math.random() * 2.8;
          wildLightningActiveTimer = 0.28 + Math.random() * 0.16;
          const primaryIdx = Math.floor(Math.random() * wildLightningBolts.length);
          const secondaryIdx = (primaryIdx + 1 + Math.floor(Math.random() * (wildLightningBolts.length - 1))) % wildLightningBolts.length;
          for (let i = 0; i < wildLightningBolts.length; i++) {
            wildLightningBolts[i].visible = i === primaryIdx || (Math.random() > 0.45 && i === secondaryIdx);
          }
        }
        if (wildLightningActiveTimer > 0) {
          wildLightningActiveTimer -= dt;
          const flicker = Math.sin(nowSec * 92) > -0.25 ? 1 : 0.28;
          if (wildLightningFlashLight) {
            wildLightningFlashLight.intensity = 18 * flicker;
          }
          if (state.bossPhase !== 'WILD_PHASE3_INTRO' && scene.background instanceof THREE.Color) {
            scene.background.copy(flicker > 0.5 ? wildBgFlash : wildBgDark);
          }
          if (wildLightningActiveTimer <= 0) {
            for (const b of wildLightningBolts) b.visible = false;
            if (wildLightningFlashLight) wildLightningFlashLight.intensity = 0;
            if (state.bossPhase !== 'WILD_PHASE3_INTRO' && scene.background instanceof THREE.Color) {
              scene.background.copy(wildBgDark);
            }
          }
        }
      } else {
        for (let i = 0; i < snowCount; i++) {
          let sy = posAttr.getY(i) - 3.2 * dt;
          if (sy < 0) sy = 18;
          posAttr.setY(i, sy);
        }
      }
      posAttr.needsUpdate = true;

      // 3D Broken Glass Shards burst animation across camera viewport
      if (glassBurstTimer > 0) {
        glassBurstTimer = Math.max(0, glassBurstTimer - dt);
        const burstElapsed = glassBurstMax - glassBurstTimer;
        const fadeOut = THREE.MathUtils.clamp(glassBurstTimer / Math.max(0.15, glassBurstMax * 0.42), 0, 1);
        shardPurpleMat.opacity = 0.92 * fadeOut;
        shardMonoMat.opacity = 0.94 * fadeOut;
        for (let i = 0; i < glassShards.length; i++) {
          const s = glassShards[i];
          const r = s.baseDist + burstElapsed * s.speed;
          s.mesh.position.set(
            Math.cos(s.angle) * r * 1.48,
            Math.sin(s.angle) * r * 0.9 - burstElapsed * burstElapsed * 0.45,
            ((i % 5) - 2) * 0.1 + burstElapsed * 0.2
          );
          s.mesh.rotation.x += s.spinX * dt;
          s.mesh.rotation.y += s.spinY * dt;
          s.mesh.rotation.z += s.spinZ * dt;
        }
        if (glassBurstTimer <= 0) {
          glassShardGroup.visible = false;
          for (const s of glassShards) s.mesh.visible = false;
        }
      }

      // Damped screen shake applied safely right before render and restored afterward
      let appliedShake = false;
      let savedCamX = 0;
      let savedCamY = 0;
      let savedCamZ = 0;
      if (state.shakeIntensity > 0.001) {
        appliedShake = true;
        savedCamX = camera.position.x;
        savedCamY = camera.position.y;
        savedCamZ = camera.position.z;
        const amp = state.shakeIntensity;
        const sx = (Math.sin(nowSec * 57.3) * 0.65 + (Math.random() - 0.5) * 0.7) * amp;
        const sy = (Math.cos(nowSec * 63.7) * 0.65 + (Math.random() - 0.5) * 0.7) * amp * 0.85;
        const sz = Math.sin(nowSec * 49.1) * amp * 0.38;
        const roll = (Math.sin(nowSec * 53.9) * 0.5 + (Math.random() - 0.5) * 0.5) * amp * 0.16;
        camera.position.set(savedCamX + sx, savedCamY + sy, savedCamZ + sz);
        camera.rotation.z = roll;
        state.shakeIntensity = Math.max(0, state.shakeIntensity - state.shakeDecay * dt);
      } else {
        state.shakeIntensity = 0;
        camera.rotation.z = 0;
      }

      // Co-op real-time local pose & Host boss state broadcast (20 Hz)
      coopSyncAcc += dt;
      if (coopSyncAcc >= 0.05 && onCoopSyncStateRef.current) {
        coopSyncAcc = 0;
        const localMeshYaw = isSideView()
          ? Math.atan2(bossModel.root.position.x - playerPos.x, bossModel.root.position.z - playerPos.z)
          : yaw + Math.PI;
        onCoopSyncStateRef.current({
          screen: 'BOSS_3D',
          scene: 'STREET',
          worldX: 2960,
          worldFacing: 1,
          x: playerPos.x,
          y: state.playerJumpY,
          z: playerPos.z,
          yaw: localMeshYaw,
          hp: state.playerHp,
          maxHp: maxPlayerHp,
          fighter,
          minion,
          isKingTiger,
          isPickle,
          isGilbert,
          moving: localMovingNow,
          dashing: state.dodgeTimer > 0,
          attacking: state.playerAttackAnim > 0.02,
        });

        if (isCoopHostNow() && onCoopSyncBossStateRef.current && state.outcome !== 'WON') {
          const slamProg =
            state.wildSlamPhase === 'JUMPING'
              ? 1 - Math.max(0, state.wildSlamTimer) / 1.0
              : 0;
          const pawRingProg =
            state.wildPawPhase === 'PAW_WINDUP'
              ? 1 - Math.max(0, state.wildPawTimer) / 1.0
              : 0;
          onCoopSyncBossStateRef.current({
            bossPhase: state.bossPhase,
            bossHp: state.bossHp,
            dimaStamina: state.dimaStamina,
            bossDmgBoost: state.bossDmgBoost,
            x: bossModel.root.position.x,
            y: bossModel.root.position.y,
            z: bossModel.root.position.z,
            yaw: bossModel.root.rotation.y,
            rx: bossModel.root.rotation.x,
            rz: bossModel.root.rotation.z,
            scaleX: bossModel.root.scale.x,
            scaleY: bossModel.root.scale.y,
            scaleZ: bossModel.root.scale.z,
            ubX: bossModel.upperBodyGroup.position.x,
            ubY: bossModel.upperBodyGroup.position.y,
            ubZ: bossModel.upperBodyGroup.position.z,
            ubRx: bossModel.upperBodyGroup.rotation.x,
            ubRy: bossModel.upperBodyGroup.rotation.y,
            ubRz: bossModel.upperBodyGroup.rotation.z,
            laRx: bossModel.leftArm.rotation.x,
            laRy: bossModel.leftArm.rotation.y,
            laRz: bossModel.leftArm.rotation.z,
            raRx: bossModel.rightArm.rotation.x,
            raRy: bossModel.rightArm.rotation.y,
            raRz: bossModel.rightArm.rotation.z,
            llY: bossModel.leftLeg.legGroup.position.y,
            llRx: bossModel.leftLeg.legGroup.rotation.x,
            lkRx: bossModel.leftLeg.knee.rotation.x,
            rlY: bossModel.rightLeg.legGroup.position.y,
            rlRx: bossModel.rightLeg.legGroup.rotation.x,
            rkRx: bossModel.rightLeg.knee.rotation.x,
            potRx: bossModel.potGroup.rotation.x,
            potRy: bossModel.potGroup.rotation.y,
            potRz: bossModel.potGroup.rotation.z,
            skRx: bossModel.skewerGroup?.rotation.x ?? 0.72,
            bellyWound: bossModel.bellyWoundGroup.visible,
            shieldBroken: !isWildCucumber && bossModel.brokenShieldGroup.visible,
            backJarVisible: bossModel.backJarGroup ? bossModel.backJarGroup.visible : true,
            wildSkewerPhase: state.wildSkewerPhase,
            wildSlamPhase: state.wildSlamPhase,
            wildJarPhase: state.wildJarPhase,
            wildPawPhase: state.wildPawPhase,
            dimaUltPhase: state.dimaUltPhase,
            dimaDashPhase: state.dimaDashPhase,
            dimaSpinWirePhase: state.dimaSpinWirePhase,
            dimaSisterPhase: state.dimaSisterPhase,
            lungeDirX: state.wildLungeDirX,
            lungeDirZ: state.wildLungeDirZ,
            lungeVisible: lungeAimGroup.visible,
            lungeYaw: lungeAimGroup.rotation.y,
            slamRingVisible: wildSlamRingGroup.visible,
            slamX: state.wildSlamTargetX,
            slamZ: state.wildSlamTargetZ,
            slamProg,
            jarVisible: thrownJarGroup.visible,
            jarX: thrownJarGroup.position.x,
            jarY: thrownJarGroup.position.y,
            jarZ: thrownJarGroup.position.z,
            jarRx: thrownJarGroup.rotation.x,
            jarRz: thrownJarGroup.rotation.z,
            ghostPawsVisible: ghostPawsGroup.visible,
            pawScale: ghostPawsGroup.scale.x,
            lpX: leftGhostPaw.position.x,
            lpY: leftGhostPaw.position.y,
            lpZ: leftGhostPaw.position.z,
            lpRx: leftGhostPaw.rotation.x,
            lpRy: leftGhostPaw.rotation.y,
            lpRz: leftGhostPaw.rotation.z,
            rpX: rightGhostPaw.position.x,
            rpY: rightGhostPaw.position.y,
            rpZ: rightGhostPaw.position.z,
            rpRx: rightGhostPaw.rotation.x,
            rpRy: rightGhostPaw.rotation.y,
            rpRz: rightGhostPaw.rotation.z,
            rpScale: rightGhostPaw.scale.x,
            pawRingVisible: pawSlamRingGroup.visible,
            pawRingX: state.wildPawTargetX,
            pawRingZ: state.wildPawTargetZ,
            pawRingProg,
            ultRingVisible: (bossSlamRing.material as THREE.MeshBasicMaterial).opacity > 0.01,
            ultRingX: bossSlamRing.position.x,
            ultRingZ: bossSlamRing.position.z,
            ultRingOp: (bossSlamRing.material as THREE.MeshBasicMaterial).opacity,
            spinWireVisible: wireSweepGroup.visible,
            spinWireAngle: state.dimaSpinWireAngle,
            sisterVisible: sisterModel.visible,
            sisterX: sisterModel.position.x,
            sisterY: sisterModel.position.y,
            sisterZ: sisterModel.position.z,
            sisterYaw: sisterModel.rotation.y,
            sonicWarnOp: (sonicWarnRing.material as THREE.MeshBasicMaterial).opacity,
            sonicOriginX: state.sonicOriginX,
            sonicOriginZ: state.sonicOriginZ,
          });
        }
      }

      const remoteStateMap = coopRemoteStatesRefProp.current?.current;
      const hideTeammatesForCutscene =
        state.bossPhase === 'WILD_PHASE3_INTRO' || state.bossPhase === 'STOMPING';
      const nowMs = Date.now();
      const activeRemoteIds = new Set<string>();

      if (remoteStateMap) {
        for (const r of Object.values(remoteStateMap)) {
          if (!r || r.id === coopLocalPlayerIdRef.current) continue;
          if (r.screen !== 'BOSS_3D' || nowMs - r.updatedAt > 6500) continue;
          activeRemoteIds.add(r.id);

          const expectedSkinKey = `${r.fighter}:${r.isKingTiger ? 1 : 0}:${r.isPickle ? 1 : 0}:${r.isGilbert ? 1 : 0}`;
          let entry = remoteAvatars.get(r.id);
          if (entry && entry.skinKey !== expectedSkinKey) {
            disposeRemoteEntry(entry);
            remoteAvatars.delete(r.id);
            entry = undefined;
          }
          if (!entry) {
            entry = createRemoteAvatarEntry(r);
            remoteAvatars.set(r.id, entry);
          }

          entry.targetX = r.x;
          entry.targetY = r.y;
          entry.targetZ = r.z;
          entry.targetYaw = r.yaw;
          entry.moving = r.moving;
          entry.dashing = r.dashing;
          if (r.attacking && entry.attackAnimTimer <= 0.05) {
            entry.attackAnimTimer = 0.25;
          }

          const expectedLabelKey = `${r.nickname}:${r.hp}:${r.maxHp}:${r.fighter}`;
          if (entry.labelKey !== expectedLabelKey) {
            entry.labelKey = expectedLabelKey;
            drawNameplateCanvas(entry.nameCanvas, r.nickname, r.hp, r.maxHp, r.fighter);
            entry.nameTexture.needsUpdate = true;
          }
        }
      }

      for (const [rid, entry] of remoteAvatars.entries()) {
        if (!activeRemoteIds.has(rid)) {
          disposeRemoteEntry(entry);
          remoteAvatars.delete(rid);
          continue;
        }
        entry.avatar.root.visible = !hideTeammatesForCutscene;
        if (hideTeammatesForCutscene) continue;

        const lerpAlpha = Math.min(1, dt * 16);
        entry.avatar.root.position.x = THREE.MathUtils.lerp(entry.avatar.root.position.x, entry.targetX, lerpAlpha);
        entry.avatar.root.position.y = THREE.MathUtils.lerp(entry.avatar.root.position.y, entry.targetY, lerpAlpha);
        entry.avatar.root.position.z = THREE.MathUtils.lerp(entry.avatar.root.position.z, entry.targetZ, lerpAlpha);

        const curYaw = entry.avatar.root.rotation.y;
        const deltaYaw = ((entry.targetYaw - curYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        entry.avatar.root.rotation.y = curYaw + deltaYaw * lerpAlpha;

        entry.attackAnimTimer = Math.max(0, entry.attackAnimTimer - dt);
        const stride = entry.moving ? Math.sin(nowSec * (entry.dashing ? 22 : 14)) : 0;
        entry.avatar.leftLeg.legGroup.rotation.x = stride * 0.58;
        entry.avatar.rightLeg.legGroup.rotation.x = -stride * 0.58;
        entry.avatar.leftLeg.knee.rotation.x = Math.max(0, -stride * 0.42);
        entry.avatar.rightLeg.knee.rotation.x = Math.max(0, stride * 0.42);
        entry.avatar.rightArm.rotation.set(
          -0.3 - (entry.attackAnimTimer / 0.3) * 0.6 + stride * 0.16,
          0,
          0
        );
        entry.avatar.leftArm.rotation.set(-stride * 0.22, 0, 0);
      }

      renderer.render(scene, camera);

      if (appliedShake) {
        camera.position.set(savedCamX, savedCamY, savedCamZ);
        camera.rotation.z = 0;
      }

      hudSyncAcc += dt;
      if (hudSyncAcc > 0.065) {
        hudSyncAcc = 0;
        const p2Prog =
          state.bossPhase === 'PHASE2_INTRO'
            ? THREE.MathUtils.clamp(
                (PHASE2_INTRO_DURATION - Math.max(0, state.phase2IntroTimer)) / PHASE2_INTRO_DURATION,
                0,
                1
              )
            : 0;
        const p3Prog =
          state.bossPhase === 'WILD_PHASE3_INTRO'
            ? THREE.MathUtils.clamp(
                (WILD_PHASE3_INTRO_DURATION - Math.max(0, state.wildPhase3IntroTimer)) / WILD_PHASE3_INTRO_DURATION,
                0,
                1
              )
            : 0;
        setHud({
          hardcore: isHardcore,
          playerHp: state.playerHp,
          maxPlayerHp,
          bossHp: state.bossHp,
          maxBossHp,
          bossPhase: state.bossPhase,
          dimaDmgBoosted: state.bossDmgBoost,
          phase2IntroProgress: p2Prog,
          phase2IntroRemaining: Math.max(0, state.phase2IntroTimer),
          wildPhase3IntroProgress: p3Prog,
          wildPhase3IntroRemaining: Math.max(0, state.wildPhase3IntroTimer),
          cutsceneFlash: state.wildCutsceneFlashMode,
          sideViewActive: state.bossPhase === 'WILD_PHASE3',
          dimaStamina: state.dimaStamina,
          maxDimaStamina: DIMA_MAX_STAMINA,
          primaryCooldown: state.primaryCd,
          ability1Cooldown: state.ability1Cd,
          ultCooldown: state.ultCd,
          artemDamageCharge: state.artemDamageCharge,
          artemTotalDamage: state.artemTotalDamage,
          artemArmorLeft: state.artemArmorLeft,
          artemHitStreak: state.artemHitStreak,
          artemSlowLeft: state.artemSlowLeft,
          minion1Cooldown: state.minion1Cd,
          minion2Cooldown: state.minion2Cd,
          maksBuffLeft: state.maksBuffLeft,
          shashlikCount: state.shashlik,
          rageLeft: state.rageLeft,
          radarLeft: state.radarLeft,
          radarHitCount: state.egorRadarHitCounter % 4,
          pickleDropsLeft: state.egorPickleDropsLeft,
          lupikIframe: state.lupikKnifePhase !== 'NONE',
          playerEnergy: Math.round(state.playerEnergy),
          maxPlayerEnergy: PLAYER_MAX_ENERGY,
          dodgeIframe: state.dodgeIframeTimer > 0,
          playerAirborne: state.playerJumpY > 0.05,
          healFlash: state.healFlashTimer > 0,
          damageFlash: state.damageFlashTimer > 0,
          sisterActive: state.dimaSisterPhase !== 'NONE',
          dimaGiantActive: state.dimaUltPhase !== 'NONE',
          dimaDashActive: state.dimaDashPhase !== 'NONE',
          dimaLasersActive: skyLasers.length > 0,
          dimaSpinWireActive: state.dimaSpinWirePhase !== 'NONE',
          comboCount: state.comboCount,
          maxComboCount: state.maxComboCount,
          damageTakenTotal: state.damageTakenTotal,
          dodgeEvadeCount: state.dodgeEvadeCount,
          comboPulse: state.comboPulseTimer > 0,
          pointerLocked: state.pointerLocked,
          impaleCutsceneActive: state.wildSkewerPhase === 'IMPALE_CUTSCENE',
          wildRegenActive: state.wildRegenActive,
          playerStunnedLeft: state.playerStunTimer,
          banner: state.banner || null,
          outcome: state.outcome,
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = window.requestAnimationFrame(tick);
    }

    return () => {
      renderer.domElement.style.filter = '';
      violetDisposed = true;
      violetFetchCtrl?.abort();
      aizoAudio.removeEventListener('ended', onAizoEnded);
      janeAudio.removeEventListener('ended', onJaneEnded);
      sansAudio.removeEventListener('ended', onSansEnded);
      violetAudio.removeEventListener('loadedmetadata', onVioletMetadata);
      violetAudio.removeEventListener('canplay', onVioletCanPlay);
      violetAudio.removeEventListener('seeked', onVioletSeeked);
      violetAudio.removeEventListener('error', onVioletError);
      violetAudio.removeEventListener('ended', onVioletEnded);
      aizoAudio.pause();
      janeAudio.pause();
      sansAudio.pause();
      violetAudio.pause();
      stompAudio.pause();
      aizoAudio.src = '';
      janeAudio.src = '';
      sansAudio.src = '';
      violetAudio.src = '';
      stompAudio.src = '';
      if (violetBlobUrl) {
        URL.revokeObjectURL(violetBlobUrl);
        violetBlobUrl = null;
      }
      audioRefs.current = { aizo: null, jane: null, sans: null, violet: null, stomp: null };

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      unsubCoopAttack?.();
      unsubCoopBossEvent?.();
      unsubCoopRemoteHit?.();
      for (const entry of remoteAvatars.values()) {
        disposeRemoteEntry(entry);
      }
      remoteAvatars.clear();
      for (const r of comboRings) {
        (r.mesh.material as THREE.Material).dispose();
      }
      for (const d of disposables) d.dispose();
      renderer.dispose();
    };
  }, [artemBonusDmg, fighter, getInitialTrainingState, isGilbert, isHardcore, isKingTiger, isPickle, isTraining, isWildCucumber, maxBossHp, maxPlayerHp, minion, retryNonce, trainingTarget]);

  const bossHpPct = Math.max(0, Math.min(100, (hud.bossHp / hud.maxBossHp) * 100));
  const dimaStaminaPct = Math.max(0, Math.min(100, (hud.dimaStamina / hud.maxDimaStamina) * 100));
  const playerHpPct = Math.max(0, Math.min(100, (hud.playerHp / hud.maxPlayerHp) * 100));
  const playerEnergyPct = Math.max(0, Math.min(100, (hud.playerEnergy / hud.maxPlayerEnergy) * 100));

  const totalBossPhases = hud.hardcore ? 3 : 2;
  const bossPhaseNum: 1 | 2 | 3 =
    hud.bossPhase === 'PHASE1'
      ? 1
      : hud.bossPhase === 'HC_PHASE2'
      ? 2
      : hud.hardcore
      ? 3
      : 2;

  const fighterDisplayName =
    fighter === 'LUPIK'
      ? isGilbert
        ? 'Лупик · Гилберт'
        : 'Лупик'
      : fighter === 'EGOR'
      ? isPickle
        ? 'Егор · Огурчик'
        : 'Егор'
      : isKingTiger
      ? 'Артём · Королевский тигр'
      : 'Артём';

  // Stretch Phase 2/3 speech across the full 16-second kneeling intro
  const p2SpeechPart1 = isWildCucumber
    ? 'Холодный рассол и стальные цепи ещё держат меня.'
    : PHASE2_SPEECH_PART1;
  const p2SpeechPart2 = isWildCucumber
    ? ' В этой грозе Борбарисово тебя ждёт настоящая Дикая Охота!'
    : PHASE2_SPEECH_PART2;
  const p2Quote = (() => {
    const p = hud.phase2IntroProgress;
    if (p <= 0.42) {
      const ratio = Math.max(0, Math.min(1, (p - 0.02) / 0.4));
      return p2SpeechPart1.slice(0, Math.max(1, Math.round(p2SpeechPart1.length * ratio)));
    }
    if (p <= 0.5) {
      return p2SpeechPart1;
    }
    const ratio2 = Math.max(0, Math.min(1, (p - 0.5) / 0.44));
    return (
      p2SpeechPart1 +
      p2SpeechPart2.slice(0, Math.round(p2SpeechPart2.length * ratio2))
    );
  })();

  const maksBonus = hud.maksBuffLeft > 0 ? 10 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1320] flex flex-col">
      {/* 1st-Person 3D WebGL Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* Top-left Combo Hit Counter + Main Menu Button */}
      <div className="fixed top-4 left-4 z-30 pointer-events-none flex items-start gap-2.5">
        <div
          className={`relative bg-[#111B2B]/95 border rounded-xl px-4 py-2.5 shadow-xl transition-all duration-150 ${
            hud.comboPulse ? 'scale-105' : 'scale-100'
          } ${
            hud.comboCount >= 20
              ? 'border-cyan-300/95 shadow-cyan-400/35'
              : hud.comboCount >= 10
              ? 'border-rose-500/85 shadow-rose-500/25'
              : hud.comboCount >= 5
              ? 'border-amber-400/85 shadow-amber-500/20'
              : hud.comboCount > 0
              ? 'border-sky-400/75'
              : 'border-slate-700/80'
          }`}
          aria-live="polite"
          aria-label="Счётчик комбо-ударов"
        >
          {hud.comboCount > 0 && (
            <div className="absolute -inset-1 pointer-events-none overflow-visible">
              <span
                className={`absolute -top-1 left-3 w-2 h-2 rounded-full transition-all duration-150 ${
                  hud.comboPulse ? 'opacity-100 scale-125' : 'opacity-50 scale-75'
                } ${
                  hud.comboCount >= 20
                    ? 'bg-cyan-300'
                    : hud.comboCount >= 10
                    ? 'bg-rose-400'
                    : hud.comboCount >= 5
                    ? 'bg-amber-300'
                    : 'bg-sky-300'
                }`}
              />
              <span
                className={`absolute -bottom-1 right-4 w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                  hud.comboPulse ? 'opacity-100 scale-150' : 'opacity-45 scale-75'
                } ${
                  hud.comboCount >= 20
                    ? 'bg-fuchsia-300'
                    : hud.comboCount >= 10
                    ? 'bg-yellow-300'
                    : hud.comboCount >= 5
                    ? 'bg-orange-400'
                    : 'bg-sky-200'
                }`}
              />
              <span
                className={`absolute top-2 -right-1.5 w-1.5 h-1.5 rotate-45 transition-all duration-150 ${
                  hud.comboPulse ? 'opacity-100 scale-125' : 'opacity-40 scale-75'
                } ${
                  hud.comboCount >= 20
                    ? 'bg-yellow-200'
                    : hud.comboCount >= 10
                    ? 'bg-rose-300'
                    : hud.comboCount >= 5
                    ? 'bg-amber-200'
                    : 'bg-cyan-200'
                }`}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Комбо-удары
            </div>
            {hud.comboCount >= 5 && (
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wide ${
                  hud.comboCount >= 20
                    ? 'text-cyan-300'
                    : hud.comboCount >= 10
                    ? 'text-rose-400'
                    : 'text-amber-300'
                }`}
              >
                {hud.comboCount >= 20 ? 'УЛЬТРА · ТОН III' : hud.comboCount >= 10 ? 'ЯРОСТЬ · ТОН II' : 'ОГОНЬ'}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={`font-display font-extrabold font-mono-nums text-2xl leading-none ${
                hud.comboCount >= 20
                  ? 'text-cyan-300'
                  : hud.comboCount >= 10
                  ? 'text-rose-400'
                  : hud.comboCount >= 5
                  ? 'text-amber-400'
                  : hud.comboCount > 0
                  ? 'text-sky-300'
                  : 'text-slate-500'
              }`}
            >
              x{hud.comboCount}
            </span>
            <span className="font-mono-nums text-[11px] text-slate-400">
              Макс: {hud.maxComboCount}
            </span>
          </div>
        </div>

        {onBackToMenu && (
          <button
            type="button"
            onClick={handleBackToMenu}
            aria-label="Выйти в главное меню"
            title="Выйти в главное меню"
            className="pointer-events-auto inline-flex items-center gap-1.5 bg-[#111B2B]/95 hover:bg-[#19273E] border border-slate-700/80 hover:border-amber-400/70 rounded-xl px-3.5 py-2.5 text-slate-200 hover:text-amber-300 font-display font-bold text-xs shadow-xl transition-all active:scale-95 whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Меню</span>
          </button>
        )}
      </div>

      {/* Top-right Audio & Combo Volume Mixer + [N] Mouse Unlock */}
      <div className="fixed top-4 right-4 z-30 w-60 bg-[#111B2B]/95 border border-slate-700/80 rounded-xl p-3 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggleFightAudio}
            aria-label={audioMuted ? 'Включить музыку и звук' : 'Выключить музыку и звук'}
            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-amber-300 text-xs font-semibold transition-colors min-w-0"
          >
            {audioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate">
              {audioMuted
                ? 'Звук выкл.'
                : isWildCucumber
                ? 'Through Patches of Violet'
                : hud.bossPhase === 'PHASE1'
                ? 'AIZO (King Gnu)'
                : hud.bossPhase === 'HC_PHASE2'
                ? 'Jane!'
                : hud.bossPhase === 'PHASE2_INTRO' || hud.bossPhase === 'LAST_BREATH'
                ? 'sans v2'
                : 'Тишина'}
            </span>
          </button>
          <span className="text-[10px] font-mono-nums font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600/70 text-slate-300 shrink-0">
            [N] Мышь
          </span>
        </div>

        <label className="block">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
            <span>Громкость песен</span>
            <span className="font-mono-nums text-amber-300 font-semibold">
              {audioMuted ? 0 : Math.round(musicVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={audioMuted ? 0 : Math.round(musicVolume * 100)}
            onChange={(e) => handleMusicVolumeChange(Number(e.target.value) / 100)}
            aria-label="Громкость песен"
            className="w-full h-1.5 accent-amber-400 cursor-pointer"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
            <span>Звук серии комбо</span>
            <span className="font-mono-nums text-sky-300 font-semibold">
              {audioMuted ? 0 : Math.round(comboVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={audioMuted ? 0 : Math.round(comboVolume * 100)}
            onChange={(e) => handleComboVolumeChange(Number(e.target.value) / 100)}
            aria-label="Громкость звука серии комбо"
            className="w-full h-1.5 accent-sky-400 cursor-pointer"
          />
        </label>

        {(isBossRush || isTraining) && (
          <div className="pt-2 border-t border-slate-700/70 space-y-2">
            {isTraining && onChangeTrainingPhase && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
                  Тренировка · Быстрая фаза
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeTrainingPhase('PHASE1')}
                    className={`py-1 rounded text-[10px] font-bold transition-colors ${
                      trainingTarget === 'PHASE1'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Ф1
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTrainingPhase('PHASE2')}
                    className={`py-1 rounded text-[10px] font-bold transition-colors ${
                      trainingTarget === 'PHASE2'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Ф2
                  </button>
                  {isHardcore && (
                    <button
                      type="button"
                      onClick={() => onChangeTrainingPhase('PHASE3')}
                      className={`py-1 rounded text-[10px] font-bold transition-colors ${
                        trainingTarget === 'PHASE3'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      Ф3
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChangeTrainingPhase('STOMP')}
                    className={`py-1 rounded text-[10px] font-bold transition-colors ${
                      isHardcore ? '' : 'col-span-2'
                    } ${
                      trainingTarget === 'STOMP'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Добивка
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {isTraining && (
                <button
                  type="button"
                  onClick={handleRestartFight}
                  className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold transition-colors whitespace-nowrap"
                >
                  Рестарт
                </button>
              )}
              <button
                type="button"
                onClick={onChangeFighter}
                className="flex-1 py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-bold transition-colors whitespace-nowrap"
              >
                Сменить бойца
              </button>
              {onBackToMenu && (
                <button
                  type="button"
                  onClick={handleBackToMenu}
                  className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors whitespace-nowrap"
                >
                  В меню
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Center First-Person Crosshair (hidden during side-profile Phase 3 & Cutscenes) */}
      {hud.outcome === 'ACTIVE' &&
        hud.bossPhase !== 'STOMPING' &&
        hud.bossPhase !== 'WILD_PHASE3_INTRO' &&
        !hud.sideViewActive &&
        !hud.impaleCutsceneActive && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <div className="w-4 h-[2px] bg-amber-400/90" />
              <div className="h-4 w-[2px] bg-amber-400/90 absolute" />
            </div>
          </div>
        )}

      {/* Wild Cucumber 23s Dimension-Shift Cutscene Flash & Progress Overlay */}
      {hud.outcome === 'ACTIVE' && hud.bossPhase === 'WILD_PHASE3_INTRO' && (
        <>
          {hud.cutsceneFlash === 'PURPLE' && (
            <div
              className="fixed inset-0 pointer-events-none z-10 border-4 border-purple-400/90"
              style={{ boxShadow: 'inset 0 0 120px rgba(168, 85, 247, 0.65)' }}
            />
          )}
          {hud.cutsceneFlash === 'BW_INVERT' && (
            <div
              className="fixed inset-0 pointer-events-none z-10 border-4 border-slate-100/95"
              style={{ boxShadow: 'inset 0 0 110px rgba(255, 255, 255, 0.5)' }}
            />
          )}
          <div className="fixed bottom-44 left-1/2 -translate-x-1/2 w-[min(640px,92vw)] z-[25] pointer-events-none">
            <div className="bg-[#0B0616]/95 border-2 border-purple-500/85 rounded-xl px-5 py-3 shadow-2xl">
              <div className="flex items-center justify-between gap-2 text-xs mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-300" />
                  <span className="font-display font-extrabold text-purple-200 tracking-wide">
                    РАЗЛОМ ИЗМЕРЕНИЙ · WILD ОГУРЕЦ (ФАЗА 3)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/25 border border-purple-400/60 text-purple-200">
                    IFRAME
                  </span>
                </div>
                <span className="font-mono-nums font-bold text-purple-300">
                  {Math.ceil(hud.wildPhase3IntroRemaining)}с
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-purple-500/40">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-400 to-slate-100 transition-[width] duration-100"
                  style={{ width: `${Math.min(100, hud.wildPhase3IntroProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Phase 2/3 Kneeling Intro Dialogue Overlay (Stretched across 16s) */}
      {hud.outcome === 'ACTIVE' && hud.bossPhase === 'PHASE2_INTRO' && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 w-[min(760px,94vw)] z-[25] pointer-events-none">
          <div className="bg-[#0B1320]/95 border-2 border-rose-500/80 rounded-xl px-5 py-4 shadow-2xl">
            <div className="flex items-center gap-4">
              {isWildCucumber ? (
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-emerald-950 via-purple-950 to-slate-950 border-2 border-purple-500/80 flex items-center justify-center shrink-0">
                  <Zap className="w-8 h-8 text-purple-300" />
                </div>
              ) : (
                <img
                  src={ASSETS.PORTRAIT_DIMA}
                  alt={bossDisplayName}
                  className="w-16 h-16 rounded-lg object-cover border-2 border-rose-500/70 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-display font-extrabold text-sm ${isWildCucumber ? 'text-purple-300' : 'text-rose-400'}`}>
                      {bossDisplayName}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300">
                      НЕУЯЗВИМ ВО ВРЕМЯ АНИМАЦИИ ({hud.hardcore ? '3 ФАЗА' : '2 ФАЗА'})
                    </span>
                  </div>
                  <span className="font-mono-nums text-xs font-bold text-rose-300">
                    {Math.ceil(hud.phase2IntroRemaining)}с
                  </span>
                </div>
                <p className="text-slate-100 text-sm sm:text-base font-medium leading-snug min-h-[2.75rem]">
                  «{p2Quote}»
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-rose-500/30">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-[width] duration-100"
                style={{ width: `${Math.min(100, hud.phase2IntroProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exhausted Stomp Finisher CTA Overlay */}
      {hud.outcome === 'ACTIVE' && hud.bossPhase === 'EXHAUSTED' && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-12 z-20">
          <button
            type="button"
            onClick={() => actionsRef.current.triggerStompFinisher()}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm sm:text-base shadow-2xl border-2 border-amber-200 transition-transform active:scale-95 whitespace-nowrap"
          >
            <Footprints className="w-5 h-5" />
            <span>[F] ДОБИТЬ НОГОЙ ({isWildCucumber ? 'ВТОПТАТЬ WILD ОГУРЦА!' : 'ВТОПТАТЬ ДИМУ!'})</span>
          </button>
        </div>
      )}

      {/* Green Healing Vignette when eating Ilihe's Fruit */}
      {hud.healFlash && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-emerald-400/80"
          style={{ boxShadow: 'inset 0 0 80px rgba(16, 185, 129, 0.45)' }}
        />
      )}

      {/* Red Damage Vignette when hit by Boss abilities */}
      {hud.damageFlash && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-rose-500/80"
          style={{ boxShadow: 'inset 0 0 85px rgba(239, 68, 68, 0.5)' }}
        />
      )}

      {/* Cyan Dodge Dash I-Frame Vignette */}
      {hud.dodgeIframe && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-cyan-400/80"
          style={{ boxShadow: 'inset 0 0 75px rgba(34, 211, 238, 0.42)' }}
        />
      )}

      {/* Artem Rhombus Tank Armor (-60% DMG) Vignette */}
      {hud.artemArmorLeft > 0 && hud.outcome === 'ACTIVE' && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-emerald-400/75"
          style={{ boxShadow: 'inset 0 0 70px rgba(16, 185, 129, 0.32)' }}
        />
      )}

      {/* Crimson-Purple Wild Cucumber Skewer Impale IFRAME Cutscene Vignette */}
      {hud.impaleCutsceneActive && (
        <div
          className="fixed inset-0 pointer-events-none z-10 border-4 border-purple-500/85"
          style={{ boxShadow: 'inset 0 0 110px rgba(153, 27, 27, 0.6)' }}
        />
      )}

      {/* Stun Vignette + Alert Pill when stunned by Wild Cucumber Overhead Slam */}
      {hud.playerStunnedLeft > 0 && hud.outcome === 'ACTIVE' && (
        <>
          <div
            className="fixed inset-0 pointer-events-none z-10 border-4 border-red-500/80 animate-pulse"
            style={{ boxShadow: 'inset 0 0 95px rgba(220, 38, 38, 0.55)' }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-16 z-20 pointer-events-none">
            <div className="px-4 py-2 rounded-xl bg-rose-950/95 border-2 border-rose-400 text-rose-100 font-display font-extrabold text-sm shadow-2xl">
              ОГЛУШЁН! ({hud.playerStunnedLeft.toFixed(1)}с)
            </div>
          </div>
        </>
      )}

      {/* Top BossBar + Phase Indicator + Last Breath Stamina Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[min(740px,94vw)] z-20 pointer-events-none">
        <div
          className={`bg-[#111B2B]/95 border rounded-xl px-5 py-3 shadow-2xl transition-all duration-300 ${
            bossPhaseNum === 3
              ? 'border-rose-500/90'
              : bossPhaseNum === 2
              ? 'border-amber-400/80'
              : 'border-sky-500/50'
          }`}
          style={{
            boxShadow:
              bossPhaseNum === 3
                ? '0 0 28px rgba(244, 63, 94, 0.38), 0 20px 30px -10px rgba(0, 0, 0, 0.7)'
                : bossPhaseNum === 2
                ? '0 0 22px rgba(245, 158, 11, 0.28), 0 20px 30px -10px rgba(0, 0, 0, 0.7)'
                : '0 0 16px rgba(56, 189, 248, 0.16), 0 20px 30px -10px rgba(0, 0, 0, 0.7)',
          }}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              {isWildCucumber ? (
                <div
                  className={`w-8 h-8 rounded-md bg-gradient-to-br from-emerald-950 via-purple-950 to-slate-950 border flex items-center justify-center shrink-0 transition-all duration-300 ${
                    bossPhaseNum === 3
                      ? 'border-rose-400'
                      : bossPhaseNum === 2
                      ? 'border-amber-400'
                      : 'border-purple-400/80'
                  }`}
                >
                  <Zap className="w-4 h-4 text-purple-300" />
                </div>
              ) : (
                <img
                  src={ASSETS.PORTRAIT_DIMA}
                  alt={bossDisplayName}
                  className={`w-8 h-8 rounded-md object-cover border shrink-0 transition-all duration-300 ${
                    bossPhaseNum === 3
                      ? 'border-rose-400'
                      : bossPhaseNum === 2
                      ? 'border-amber-400'
                      : 'border-sky-400/70'
                  }`}
                />
              )}
              {/* Glowing Boss Phase Icon Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-display font-extrabold shrink-0 transition-all duration-300 ${
                  bossPhaseNum === 3
                    ? 'bg-rose-950/90 border-rose-400 text-rose-200 animate-pulse'
                    : bossPhaseNum === 2
                    ? 'bg-amber-950/90 border-amber-400 text-amber-200'
                    : 'bg-sky-950/85 border-sky-400/75 text-sky-200'
                }`}
                style={{
                  boxShadow:
                    bossPhaseNum === 3
                      ? '0 0 16px rgba(244, 63, 94, 0.85)'
                      : bossPhaseNum === 2
                      ? '0 0 14px rgba(245, 158, 11, 0.7)'
                      : '0 0 10px rgba(56, 189, 248, 0.45)',
                }}
                aria-label={`Текущая фаза босса: ${bossPhaseNum} из ${totalBossPhases}`}
              >
                {bossPhaseNum === 3 ? (
                  <Skull className="w-3.5 h-3.5 text-rose-300" />
                ) : bossPhaseNum === 2 ? (
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-sky-300" />
                )}
                <span>ФАЗА {bossPhaseNum}</span>
              </div>
              <span className="font-display font-extrabold text-rose-400 truncate">
                {bossDisplayName}
              </span>
              {hud.hardcore && (
                <span className="text-[11px] font-extrabold text-rose-300 bg-rose-950/70 border border-rose-500/50 px-1.5 py-0.5 rounded shrink-0">
                  ХАРДКОР
                </span>
              )}
              {coopPlayersCount > 1 && (
                <span className="text-[11px] font-extrabold text-sky-300 bg-sky-950/70 border border-sky-400/50 px-1.5 py-0.5 rounded shrink-0">
                  КООП · {coopPlayersCount} игр.
                </span>
              )}
              {hud.bossPhase === 'HC_PHASE2' && (
                <span className="text-xs font-bold text-amber-300 shrink-0">
                  · +20% УРОН
                </span>
              )}
              {(hud.bossPhase === 'PHASE2_INTRO' ||
                hud.bossPhase === 'LAST_BREATH' ||
                hud.bossPhase === 'EXHAUSTED' ||
                hud.bossPhase === 'STOMPING') && (
                <span className="text-xs font-bold text-cyan-300 shrink-0">
                  {hud.bossPhase === 'PHASE2_INTRO'
                    ? '· НЕУЯЗВИМ (ПЕРЕХОД)'
                    : `· ШЛЕМ СБИТ${hud.dimaDmgBoosted ? ' · +20% УРОН' : ''}`}
                </span>
              )}
              {hud.radarLeft > 0 && (
                <span className="text-xs font-semibold text-emerald-400 shrink-0">
                  · Радар &amp; Рассол ({hud.radarLeft.toFixed(1)}с · -15% скор. · +20% DMG)
                </span>
              )}
              {hud.artemSlowLeft > 0 && (
                <span className="text-xs font-semibold text-amber-300 shrink-0">
                  · Арт-обстрел ({hud.artemSlowLeft.toFixed(1)}с · -20% скор.)
                </span>
              )}
              {hud.dimaGiantActive && (
                <span className="text-xs font-semibold text-amber-400 shrink-0">
                  · ГИГАНТСКИЙ ПРЫЖОК!
                </span>
              )}
              {hud.dimaDashActive && (
                <span className="text-xs font-semibold text-orange-400 shrink-0">
                  · ТАРАН!
                </span>
              )}
              {hud.dimaLasersActive && (
                <span className="text-xs font-semibold text-rose-300 shrink-0">
                  · 7 ЛАЗЕРОВ!
                </span>
              )}
              {hud.dimaSpinWireActive && (
                <span className="text-xs font-semibold text-rose-300 shrink-0">
                  · ПРОВОД ПО КАРТЕ! ПРЫГАЙ [ПРОБЕЛ]!
                </span>
              )}
            </div>
            <span className="font-mono-nums font-bold text-slate-100 shrink-0">
              {hud.bossHp} / {hud.maxBossHp} HP
            </span>
          </div>

          {/* Glowing Segmented Phase Progress Strip */}
          <div
            className="grid gap-1.5 mb-2"
            style={{ gridTemplateColumns: `repeat(${totalBossPhases}, minmax(0, 1fr))` }}
            aria-label="Шкала фаз босса"
          >
            {Array.from({ length: totalBossPhases }, (_, idx) => {
              const pNum = (idx + 1) as 1 | 2 | 3;
              const isActive = bossPhaseNum === pNum;
              const isPassed = bossPhaseNum > pNum;
              const activeBarClass =
                pNum === 3
                  ? 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-500'
                  : pNum === 2
                  ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500'
                  : 'bg-gradient-to-r from-sky-400 to-cyan-300';
              const activeGlow =
                pNum === 3
                  ? '0 0 14px rgba(244, 63, 94, 0.95)'
                  : pNum === 2
                  ? '0 0 12px rgba(245, 158, 11, 0.85)'
                  : '0 0 10px rgba(56, 189, 248, 0.75)';
              const passedBarClass =
                pNum === 2
                  ? 'bg-amber-600/45'
                  : 'bg-sky-600/40';
              return (
                <div key={pNum} className="flex flex-col gap-0.5">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isActive
                        ? activeBarClass
                        : isPassed
                        ? passedBarClass
                        : 'bg-slate-800/90 border border-slate-700/60'
                    }`}
                    style={isActive ? { boxShadow: activeGlow } : undefined}
                  />
                </div>
              );
            })}
          </div>

          <div
            className="h-3.5 w-full bg-slate-900 rounded-md overflow-hidden border border-slate-700"
            role="progressbar"
            aria-valuenow={hud.bossHp}
            aria-valuemin={0}
            aria-valuemax={hud.maxBossHp}
            aria-label={`BossBar ${isWildCucumber ? 'Wild Огурца' : 'Димы'}`}
          >
            <div
              className={`h-full transition-[width] duration-150 ${
                bossPhaseNum === 3
                  ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-400'
                  : bossPhaseNum === 2
                  ? 'bg-gradient-to-r from-orange-600 to-amber-400'
                  : 'bg-gradient-to-r from-rose-600 to-amber-500'
              }`}
              style={{ width: `${bossHpPct}%` }}
            />
          </div>

          {/* Boss Last Breath Stamina Bar (1500 -> 0) */}
          {(hud.bossPhase === 'PHASE2_INTRO' ||
            hud.bossPhase === 'LAST_BREATH' ||
            hud.bossPhase === 'EXHAUSTED' ||
            hud.bossPhase === 'STOMPING') && (
            <div className="mt-2.5 pt-2 border-t border-slate-700/70">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-cyan-300">
                  Выносливость {isWildCucumber ? 'Wild Огурца' : 'Димы'} (Уворачивается от всех атак: -10 за уворот)
                </span>
                <span className="font-mono-nums font-bold text-cyan-200">
                  {hud.dimaStamina} / {hud.maxDimaStamina}
                </span>
              </div>
              <div
                className="h-2.5 w-full bg-slate-900 rounded-sm overflow-hidden border border-cyan-500/40"
                role="progressbar"
                aria-valuenow={hud.dimaStamina}
                aria-valuemin={0}
                aria-valuemax={hud.maxDimaStamina}
                aria-label={`Бар стамины ${isWildCucumber ? 'Wild Огурца' : 'Димы'}`}
              >
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-[width] duration-150"
                  style={{ width: `${dimaStaminaPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sister Summon Alert Card */}
        {hud.sisterActive && (
          <div className="mt-2 flex items-center justify-center gap-2.5 bg-[#111B2B]/95 border border-cyan-400/60 rounded-lg px-4 py-2 shadow-xl">
            <img
              src={ASSETS.PORTRAIT_SISTER}
              alt="Сестра Димы"
              className="w-8 h-8 rounded-md object-cover border border-cyan-400/60 shrink-0"
            />
            <Volume2 className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-xs font-bold text-cyan-200">
              Сестра Димы на арене! Ссора создаёт звуковую волну (45 DMG)!
            </span>
          </div>
        )}

        {hud.banner && (
          <div className="mt-2 text-center">
            <span className="inline-block bg-[#111B2B]/95 border border-amber-500/40 text-amber-300 text-xs font-semibold px-4 py-1.5 rounded-lg">
              {hud.banner}
            </span>
          </div>
        )}
      </div>

      {/* Unified Bottom Combat Dock (Hero + Artem Damage Bar + Minion ИЛИХЕ Commands) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(980px,96vw)] z-20">
        <div className="bg-[#111B2B]/95 border border-slate-700/80 rounded-xl px-4 py-3 shadow-2xl flex flex-col gap-2.5">
          {/* Artem-only Damage Bar for Airstrike Charging */}
          {fighter === 'ARTEM' && (
            <div className="pb-2 border-b border-slate-700/70">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-amber-300">
                  Бар урона Артёма (Арт-корректировка 67001) · Всего продамажено: {hud.artemTotalDamage} DMG
                </span>
                <span className="font-mono-nums font-bold text-amber-400">
                  {hud.artemDamageCharge >= ARTEM_AIRSTRIKE_COST
                    ? `ГОТОВО! (${ARTEM_AIRSTRIKE_COST}/${ARTEM_AIRSTRIKE_COST}) → ${ARTEM_AIRSTRIKE_DAMAGE} DMG`
                    : `${hud.artemDamageCharge} / ${ARTEM_AIRSTRIKE_COST} урона с ЛКМ`}
                </span>
              </div>
              <div
                className="h-2.5 w-full bg-slate-900 rounded-sm overflow-hidden border border-amber-500/40"
                role="progressbar"
                aria-valuenow={Math.min(ARTEM_AIRSTRIKE_COST, hud.artemDamageCharge)}
                aria-valuemin={0}
                aria-valuemax={ARTEM_AIRSTRIKE_COST}
                aria-label="Бар урона Артёма для АртУдара"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-150"
                  style={{
                    width: `${Math.min(100, (hud.artemDamageCharge / ARTEM_AIRSTRIKE_COST) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Row 1: Hero HP & Hero Abilities */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="lg:w-64 shrink-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-slate-100 truncate">
                  {fighterDisplayName}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {hud.lupikIframe && (
                    <span className="font-mono-nums text-[11px] font-bold text-cyan-300">
                      IFRAME
                    </span>
                  )}
                  {hud.artemArmorLeft > 0 && (
                    <span className="font-mono-nums text-[11px] font-bold text-emerald-300 bg-emerald-950/75 border border-emerald-400/50 px-1.5 py-0.5 rounded">
                      БРОНЯ -60% ({hud.artemArmorLeft.toFixed(1)}с)
                    </span>
                  )}
                  {hud.maksBuffLeft > 0 && (
                    <span className="font-mono-nums text-[11px] font-bold text-amber-300">
                      +10 DMG · +1 HP/2с ({hud.maksBuffLeft.toFixed(0)}с)
                    </span>
                  )}
                  {hud.wildRegenActive && (
                    <span className="font-mono-nums text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-400/50 px-1.5 py-0.5 rounded">
                      РЕГЕН +1 HP/2с
                    </span>
                  )}
                  <span className="font-mono-nums font-bold text-emerald-400">
                    {hud.playerHp} / {hud.maxPlayerHp} HP
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-slate-900 rounded-sm overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-150"
                  style={{ width: `${playerHpPct}%` }}
                />
              </div>

              {/* Player Energy Bar (100 max, 50 per [F] Dodge Dash with 150ms i-frame) */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="inline-flex items-center gap-1 font-display font-bold text-cyan-300">
                    <Zap className="w-3 h-3" />
                    Энергия · [F] Рывок
                  </span>
                  <div className="flex items-center gap-1.5">
                    {hud.dodgeIframe && (
                      <span className="font-mono-nums text-[10px] font-extrabold text-cyan-200 bg-cyan-500/25 border border-cyan-400/60 px-1 rounded">
                        IFRAME 150мс
                      </span>
                    )}
                    <span className="font-mono-nums font-bold text-sky-300">
                      {hud.playerEnergy} / {hud.maxPlayerEnergy}
                    </span>
                  </div>
                </div>
                <div
                  className="relative h-2 w-full bg-slate-900 rounded-sm overflow-hidden border border-sky-500/40"
                  role="progressbar"
                  aria-valuenow={hud.playerEnergy}
                  aria-valuemin={0}
                  aria-valuemax={hud.maxPlayerEnergy}
                  aria-label="Бар энергии игрока"
                >
                  <div
                    className={`h-full transition-[width] duration-100 ${
                      hud.playerEnergy >= PLAYER_DASH_COST
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-300'
                        : 'bg-sky-800'
                    }`}
                    style={{ width: `${playerEnergyPct}%` }}
                  />
                  {/* 50-energy dash threshold marker */}
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-200/50 pointer-events-none" />
                </div>
              </div>

              <div className="text-[11px] text-slate-400 mt-1">
                {hud.sideViewActive
                  ? 'Профиль · WASD · [ЛКМ] Выстрел в босса · [F] Рывок · [Пробел] Прыжок'
                  : hud.pointerLocked
                  ? 'Прицел захвачен ([N]/Esc) · [F] Рывок · [Пробел] Прыжок'
                  : 'WASD · [F] Рывок (150мс) · [Пробел] Прыжок · [N] Прицел'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                disabled={
                  hud.playerEnergy < PLAYER_DASH_COST ||
                  hud.dodgeIframe ||
                  hud.playerStunnedLeft > 0 ||
                  hud.outcome !== 'ACTIVE' ||
                  hud.bossPhase === 'EXHAUSTED'
                }
                onClick={() => actionsRef.current.triggerDodgeDash()}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>[F] Рывок (-{PLAYER_DASH_COST})</span>
              </button>
              <button
                type="button"
                disabled={hud.playerAirborne || hud.playerStunnedLeft > 0 || hud.outcome !== 'ACTIVE'}
                onClick={() => actionsRef.current.triggerJump()}
                className="px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-400 text-slate-100 font-display font-bold text-xs transition-colors whitespace-nowrap"
              >
                [Пробел] Прыжок
              </button>
              {fighter === 'LUPIK' && (
                <button
                  type="button"
                  disabled={hud.ability1Cooldown > 0 || hud.playerStunnedLeft > 0 || hud.outcome !== 'ACTIVE'}
                  onClick={() => actionsRef.current.triggerAbility1()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>
                    [ПКМ / 2] Разъярённый Гилберт ({100 + maksBonus} DMG + 30 HP · IFRAME){' '}
                    {hud.ability1Cooldown > 0 ? `(${hud.ability1Cooldown.toFixed(1)}с)` : ''}
                  </span>
                </button>
              )}

              {fighter === 'EGOR' && (
                <button
                  type="button"
                  disabled={hud.ability1Cooldown > 0 || hud.playerStunnedLeft > 0 || hud.outcome !== 'ACTIVE'}
                  onClick={() => actionsRef.current.triggerAbility1()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>
                    [1 / ПКМ] Собака ({EGOR_DOG_BITE_DMG} DMG + {EGOR_DOG_SHASHLIK} шашл. + {EGOR_DOG_HEAL} HP){' '}
                    {hud.ability1Cooldown > 0 ? `(${hud.ability1Cooldown.toFixed(1)}с)` : ''}
                  </span>
                </button>
              )}

              {fighter === 'ARTEM' && (
                <button
                  type="button"
                  disabled={hud.ability1Cooldown > 0 || hud.playerStunnedLeft > 0 || hud.outcome !== 'ACTIVE'}
                  onClick={() => actionsRef.current.triggerAbility1()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    [1 / ПКМ] Броня «Ромб» (-60% · +{ARTEM_ARMOR_HEAL} HP · {ARTEM_ARMOR_SHOCK_DMG + maksBonus} DMG){' '}
                    {hud.artemArmorLeft > 0
                      ? `[${hud.artemArmorLeft.toFixed(1)}с]`
                      : hud.ability1Cooldown > 0
                      ? `(${hud.ability1Cooldown.toFixed(1)}с)`
                      : ''}
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={
                  hud.primaryCooldown > 0 ||
                  hud.playerStunnedLeft > 0 ||
                  hud.outcome !== 'ACTIVE'
                }
                onClick={() => actionsRef.current.triggerPrimary()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>
                  {fighter === 'LUPIK' &&
                    `[ЛКМ] Дробовик (${(hud.rageLeft > 0 ? 50 : 25) + maksBonus}) ${
                      hud.primaryCooldown > 0 ? `· ${hud.primaryCooldown.toFixed(1)}с` : ''
                    }`}
                  {fighter === 'EGOR' &&
                    (hud.shashlikCount > 0
                      ? `[ЛКМ / 2] Шашлык (${EGOR_SHASHLIK_DMG + maksBonus} · ${hud.shashlikCount}/${EGOR_MAX_SHASHLIK}) ${
                          hud.primaryCooldown > 0 ? `· ${hud.primaryCooldown.toFixed(1)}с` : ''
                        }`
                      : `[ЛКМ / 2] Огурец (${EGOR_CUCUMBER_DMG + maksBonus} · ∞) ${
                          hud.primaryCooldown > 0 ? `· ${hud.primaryCooldown.toFixed(1)}с` : ''
                        }`)}
                  {fighter === 'ARTEM' &&
                    `[ЛКМ / 2] Орудие (${ARTEM_BASE_DMG + artemBonusDmg + maksBonus})${
                      hud.artemHitStreak > 0 ? ` · Серия x${hud.artemHitStreak}` : ''
                    } ${hud.primaryCooldown > 0 ? `· ${hud.primaryCooldown.toFixed(1)}с` : ''}`}
                </span>
              </button>

              <button
                type="button"
                disabled={
                  hud.outcome !== 'ACTIVE' ||
                  hud.playerStunnedLeft > 0 ||
                  (fighter === 'ARTEM'
                    ? hud.artemDamageCharge < ARTEM_AIRSTRIKE_COST
                    : hud.ultCooldown > 0)
                }
                onClick={() => actionsRef.current.triggerUlt()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
              >
                {fighter === 'EGOR' ? <Radar className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
                <span>
                  {fighter === 'LUPIK' &&
                    `[Q] Rage x2 ${
                      hud.rageLeft > 0
                        ? `(${hud.rageLeft.toFixed(0)}с)`
                        : hud.ultCooldown > 0
                        ? `(${hud.ultCooldown.toFixed(0)}с)`
                        : ''
                    }`}
                  {fighter === 'EGOR' &&
                    `[Q] Радар & Рассол ${
                      hud.radarLeft > 0
                        ? `(${hud.radarLeft.toFixed(0)}с${hud.pickleDropsLeft > 0 ? ` · Огурец ${hud.radarHitCount}/4` : ''})`
                        : hud.ultCooldown > 0
                        ? `(${hud.ultCooldown.toFixed(0)}с)`
                        : ''
                    }`}
                  {fighter === 'ARTEM' &&
                    `[Q] АртУдар ${ARTEM_AIRSTRIKE_DAMAGE + maksBonus} DMG (${Math.min(ARTEM_AIRSTRIKE_COST, hud.artemDamageCharge)}/${ARTEM_AIRSTRIKE_COST})`}
                </span>
              </button>

              <button
                type="button"
                onClick={onChangeFighter}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
              >
                Сменить бойца
              </button>
            </div>
          </div>

          {/* Row 2: Controllable Minion Commands (ИЛИХЕ or МАКС-индюк) */}
          <div className="pt-2 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-300 flex items-center gap-2">
              {minion === 'MAKS' ? (
                <>
                  <Bird className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    <strong className="text-orange-300 font-display">Миньон Макс</strong> (Индюк · приказы)
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>
                    <strong className="text-yellow-300 font-display">Миньон ИЛИХЕ</strong> (Толстый Луффи · приказы)
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {minion === 'MAKS' ? (
                <>
                  <button
                    type="button"
                    disabled={hud.minion1Cooldown > 0 || hud.outcome !== 'ACTIVE'}
                    onClick={() => actionsRef.current.triggerMinion1()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    <Bird className="w-3.5 h-3.5" />
                    <span>
                      [3] Удар клювом (50 DMG){' '}
                      {hud.minion1Cooldown > 0 ? `· ${hud.minion1Cooldown.toFixed(0)}с` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={hud.minion2Cooldown > 0 || hud.outcome !== 'ACTIVE'}
                    onClick={() => actionsRef.current.triggerMinion2()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>
                      [4] Бафф (+10 DMG и +1 HP/2с · 20с){' '}
                      {hud.minion2Cooldown > 0 ? `· ${hud.minion2Cooldown.toFixed(0)}с` : ''}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={hud.minion1Cooldown > 0 || hud.outcome !== 'ACTIVE'}
                    onClick={() => actionsRef.current.triggerMinion1()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    <span>
                      [3] Удар большим пузом (100 DMG){' '}
                      {hud.minion1Cooldown > 0 ? `· ${hud.minion1Cooldown.toFixed(0)}с` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={hud.minion2Cooldown > 0 || hud.outcome !== 'ACTIVE'}
                    onClick={() => actionsRef.current.triggerMinion2()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-display font-bold text-xs transition-colors whitespace-nowrap"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>
                      [4] Кинуть фрукт (+10% HP){' '}
                      {hud.minion2Cooldown > 0 ? `· ${hud.minion2Cooldown.toFixed(0)}с` : ''}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Victory / Defeat Modal */}
      {hud.outcome !== 'ACTIVE' && (
        <div className="fixed inset-0 z-30 bg-[#080E1A]/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131F33] border border-slate-600/80 rounded-xl p-6 text-center shadow-2xl">
            {hud.outcome === 'WON' ? (
              <>
                <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h2 className="font-display text-2xl font-extrabold text-emerald-400">
                  {bossDisplayName} ({hud.maxBossHp} HP{hud.hardcore ? ' · ХАРДКОР' : ''}) повержен!
                </h2>
                <p className="text-sm text-slate-300 mt-2">
                  {isWildCucumber
                    ? `Вместе с ${minion === 'MAKS' ? 'Максом (Индюком)' : 'ИЛИХЕ'} вы одолели Wild Огурца на мрачной каменной площади под грозой!`
                    : `Вместе с ${minion === 'MAKS' ? 'Максом (Индюком)' : 'ИЛИХЕ'} вы разнесли Главного злодея среди гаражей. Пора забирать братву и идти домой на 2 этаж!`}
                </p>
                <div className="mt-3 text-xs font-mono-nums font-semibold text-amber-300">
                  Лучшее комбо за бой: x{hud.maxComboCount}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  {isTraining && (
                    <button
                      type="button"
                      onClick={handleRestartFight}
                      className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Ещё раз</span>
                    </button>
                  )}
                  {(isBossRush || isTraining) && (
                    <button
                      type="button"
                      onClick={onChangeFighter}
                      className="flex-1 py-3 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
                    >
                      Сменить бойца
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onVictory({
                        fighter,
                        minion,
                        bossId,
                        hardcore: isHardcore,
                        maxCombo: hud.maxComboCount,
                        remainingHp: hud.playerHp,
                        maxHp: hud.maxPlayerHp,
                        damageTaken: hud.damageTakenTotal,
                        dodgeEvades: hud.dodgeEvadeCount,
                      })
                    }
                    className="flex-1 py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
                  >
                    {isTraining
                      ? 'Итоги тренировки'
                      : isBossRush
                      ? 'Итоги Boss Rush'
                      : 'Вернуться в Борбарисово 001'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-extrabold text-rose-400">
                  {bossDisplayName} выстоял!
                </h2>
                <p className="text-sm text-slate-300 mt-2">
                  Боец потерял все HP. Не забывай использовать способности {minion === 'MAKS' ? 'Макса' : 'ИЛИХЕ'} ([3], [4]) и уклоняться от атак {isWildCucumber ? 'Wild Огурца' : 'Димы'}!
                </p>
                <div className="mt-3 text-xs font-mono-nums font-semibold text-amber-300">
                  Лучшее комбо за попытку: x{hud.maxComboCount}
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onChangeFighter}
                    className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                  >
                    Выбрать другого бойца
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartFight}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Повторить бой</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

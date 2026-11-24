export type GameScreen =
  | 'TITLE_MENU'
  | 'MULTIPLAYER_LOBBY'
  | 'TRAINING_SETUP'
  | 'PLAYING'
  | 'QTE'
  | 'SHOP'
  | 'FIGHTER_SELECT'
  | 'MINION_SELECT'
  | 'BOSS_3D'
  | 'VICTORY';

export type LobbyMode = 'STORY' | 'BOSS_RUSH' | 'WILD_CUCUMBER';

export interface NetPlayer {
  id: string;
  nickname: string;
  fighter: FighterId;
  minion: MinionId;
  ready: boolean;
  isHost: boolean;
  scene: SceneId;
  x: number;
  hp: number;
  damageDealt: number;
}

export interface NetPlayerPose {
  screen: 'LOBBY' | 'PLAYING' | 'BOSS_3D' | 'OTHER';
  scene: SceneId;
  worldX: number;
  worldFacing: 1 | -1;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  fighter: FighterId;
  minion: MinionId;
  isKingTiger: boolean;
  isPickle: boolean;
  isGilbert: boolean;
  moving: boolean;
  dashing: boolean;
  attacking: boolean;
}

export interface NetRemotePlayerState extends NetPlayerPose {
  id: string;
  nickname: string;
  updatedAt: number;
}

export interface NetRemoteAttackEvent {
  playerId: string;
  nickname: string;
  fighter: FighterId;
  kind: 'SHOTGUN' | 'SHASHLIK' | 'CUCUMBER' | 'SHELL';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type NetBossPhase =
  | 'PHASE1'
  | 'HC_PHASE2'
  | 'PHASE2_INTRO'
  | 'LAST_BREATH'
  | 'EXHAUSTED'
  | 'STOMPING'
  | 'WILD_PHASE3_INTRO'
  | 'WILD_PHASE3';

export interface NetBossState {
  bossPhase: NetBossPhase;
  bossHp: number;
  dimaStamina: number;
  bossDmgBoost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  rx: number;
  rz: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  ubX: number;
  ubY: number;
  ubZ: number;
  ubRx: number;
  ubRy: number;
  ubRz: number;
  laRx: number;
  laRy: number;
  laRz: number;
  raRx: number;
  raRy: number;
  raRz: number;
  llY: number;
  llRx: number;
  lkRx: number;
  rlY: number;
  rlRx: number;
  rkRx: number;
  potRx: number;
  potRy: number;
  potRz: number;
  skRx: number;
  bellyWound: boolean;
  shieldBroken: boolean;
  backJarVisible: boolean;
  wildSkewerPhase: string;
  wildSlamPhase: string;
  wildJarPhase: string;
  wildPawPhase: string;
  dimaUltPhase: string;
  dimaDashPhase: string;
  dimaSpinWirePhase: string;
  dimaSisterPhase: string;
  lungeDirX: number;
  lungeDirZ: number;
  lungeVisible: boolean;
  lungeYaw: number;
  slamRingVisible: boolean;
  slamX: number;
  slamZ: number;
  slamProg: number;
  jarVisible: boolean;
  jarX: number;
  jarY: number;
  jarZ: number;
  jarRx: number;
  jarRz: number;
  ghostPawsVisible: boolean;
  pawScale: number;
  lpX: number;
  lpY: number;
  lpZ: number;
  lpRx: number;
  lpRy: number;
  lpRz: number;
  rpX: number;
  rpY: number;
  rpZ: number;
  rpRx: number;
  rpRy: number;
  rpRz: number;
  rpScale: number;
  pawRingVisible: boolean;
  pawRingX: number;
  pawRingZ: number;
  pawRingProg: number;
  ultRingVisible: boolean;
  ultRingX: number;
  ultRingZ: number;
  ultRingOp: number;
  spinWireVisible: boolean;
  spinWireAngle: number;
  sisterVisible: boolean;
  sisterX: number;
  sisterY: number;
  sisterZ: number;
  sisterYaw: number;
  sonicWarnOp: number;
  sonicOriginX: number;
  sonicOriginZ: number;
}

export type NetBossEvent =
  | {
      type: 'WIRE_SHOT';
      wires: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; dmg: number }>;
      banner?: string;
    }
  | {
      type: 'SKY_LASERS';
      lasers: Array<{ x: number; z: number; warnTimer: number }>;
      banner?: string;
    }
  | {
      type: 'SISTER_SONIC';
      originX: number;
      originZ: number;
      dmg: number;
    }
  | {
      type: 'ULT_JUMP_IMPACT';
      x: number;
      z: number;
      dmg: number;
    }
  | {
      type: 'WILD_SLAM_IMPACT';
      x: number;
      z: number;
      dmg: number;
    }
  | {
      type: 'WILD_PAW_IMPACT';
      x: number;
      z: number;
      dmg: number;
    }
  | {
      type: 'WILD_SWING_IMPACT';
      bx: number;
      bz: number;
      dmg: number;
    }
  | {
      type: 'MELEE_STRIKE';
      bx: number;
      bz: number;
      dmg: number;
    }
  | {
      type: 'DIMA_DASH_BOUNCE';
      x: number;
      z: number;
    }
  | {
      type: 'PHASE_CHANGE';
      bossPhase: NetBossPhase | 'WON';
      bossHp: number;
      dimaStamina: number;
      bossDmgBoost: boolean;
      banner?: string;
    }
  | {
      type: 'BOSS_BANNER';
      text: string;
      dur?: number;
    }
  | {
      type: 'STOMP_WON';
      stomperId: string;
    };

export interface NetRoomSettings {
  mode: LobbyMode;
  hardcore: boolean;
}

export interface NetMatchState {
  status: 'LOBBY' | 'IN_GAME';
  bossId: 'DIMA' | 'WILD_CUCUMBER';
  sharedBossHp: number;
  maxBossHp: number;
  startedAt: number | null;
}

export interface NetChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
  isSystem?: boolean;
}

export type NetConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type SceneId = 'ENTRANCE' | 'STREET';

export type FighterId = 'LUPIK' | 'EGOR' | 'ARTEM';

export type MinionId = 'ILIHE' | 'MAKS';

export type TrainingStartTarget = 'PHASE1' | 'PHASE2' | 'PHASE3' | 'STOMP' | 'CUTSCENE';

export interface TrainingConfig {
  hardcore: boolean;
  startTarget: TrainingStartTarget;
}

export type QuestStage =
  | 'GATHER_FRIENDS'
  | 'GO_TO_GARAGES'
  | 'FIGHT_NEFOR'
  | 'GO_TO_SHOP'
  | 'FIGHT_DIMA'
  | 'RETURN_HOME'
  | 'COMPLETED';

export interface DialogueSpeaker {
  name: string;
  role: string;
  portrait?: string;
  accentColor: string;
}

export interface DialogueLine {
  speaker: DialogueSpeaker;
  text: string;
}

export interface DialogueSequence {
  id: string;
  lines: DialogueLine[];
  actionLabel?: string;
  onCompleteAction?: 'RECRUIT_EGOR' | 'RECRUIT_ARTEM' | 'START_QTE' | 'START_BOSS_SELECT' | 'NONE';
}

export interface InteractableZone {
  id: string;
  scene: SceneId;
  x: number;
  width: number;
  label: string;
  sublabel?: string;
  actionText: string;
  disabledReason?: string;
}

export interface GameProgress {
  hardcore: boolean;
  egorJoined: boolean;
  artemJoined: boolean;
  artemTankSkin: boolean;
  egorPickleSkin: boolean;
  lupikGilbertSkin: boolean;
  neforDefeated: boolean;
  dimaDefeated: boolean;
  wildCucumberDefeated: boolean;
  money: number; // в копейках
  hasKhrumki: boolean;
  hasGazyava: boolean;
  qteAttempts: number;
  qteBestAccuracy: number;
}

export const PRICES = {
  KHRUMKI: 67,
  GAZYAVA: 52,
  NEFOR_REWARD: 300,
} as const;

export const ASSETS = {
  TITLE_BACKDROP: '/src/assets/images/title_borbarisovo_winter_1795368136659.jpg',
  PORTRAIT_LUPIK: '/src/assets/images/portrait_lupik_squad_1795368136116.jpg',
  PORTRAIT_NEFOR: '/src/assets/images/portrait_nefor_boss_1795368137059.jpg',
  SHOP_SNACKS: '/src/assets/images/shop_snacks_duo_1795368137034.jpg',
  PORTRAIT_GILBERT: '/assets/aistudio/Gilbert_Examination_859fa585.jpg',
  PORTRAIT_DIMA: '/assets/aistudio/_7245570A-E3DE-447A-910E-A4B7FF89AA52__302764ef.png',
  PORTRAIT_SISTER: '/assets/aistudio/_____________21__c85c27fb.jpg',
  MUSIC_AIZO: '/assets/aistudio/King_Gnu_-_AIZO_8de8519b.mp3',
  MUSIC_JANE: '/assets/aistudio/The_Long_Faces___Jane___www.lightaudio.ru__469e2c75.mp3',
  MUSIC_SANS_V2: '/assets/aistudio/sans_v2_-_Undertale_Last_Breath_a193d522.mp3',
  MUSIC_THROUGH_PATCHES_OF_VIOLET: '/assets/aistudio/mili_-_Through_patches_of_Violet_77902972_d377a402.mp3',
  SFX_STOMP_PAD: '/assets/aistudio/1recording_dc90f1a1.ogg',
  SFX_COMBO_HIT: '/assets/aistudio/combo-sound-4_NATO8Rf_7f912e38.mp3',
  SFX_COMBO_MISS: '/assets/aistudio/miss-sound_91039aae.mp3',
  SFX_GLASS_SHATTER: '/assets/aistudio/stagger-limbus-company_dabfb183.mp3',
} as const;

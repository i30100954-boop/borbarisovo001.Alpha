import { GameProgress } from '../types/game';

export type AchievementRarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export type AchievementIconKey =
  | 'swords'
  | 'shopping'
  | 'package'
  | 'zap'
  | 'target'
  | 'flame'
  | 'shield'
  | 'heart'
  | 'wind'
  | 'sparkles'
  | 'crown'
  | 'skull';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  hint: string;
  rarity: AchievementRarity;
  icon: AchievementIconKey;
  mode: 'STORY_ONLY' | 'ALL';
  check: (progress: GameProgress) => boolean;
}

export interface EvaluatedAchievements {
  unlocked: AchievementDefinition[];
  locked: AchievementDefinition[];
  totalForMode: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_brawl',
    title: 'Первый замес',
    description: 'Разобраться с боссом в 3D ПВП и доказать, кто главный в Борбарисово 001.',
    hint: 'Победить Диму или Wild Огурца в 3D-бою',
    rarity: 'COMMON',
    icon: 'swords',
    mode: 'ALL',
    check: (p) => p.dimaDefeated || p.wildCucumberDefeated,
  },
  {
    id: 'khrumki_buyer',
    title: 'Скупщик хрумок',
    description: 'Затарить хрустящие Хрумки и ледяную Газяву в магазе «Продукты 24».',
    hint: 'Купить Хрумки и Газяву в магазине',
    rarity: 'COMMON',
    icon: 'shopping',
    mode: 'STORY_ONLY',
    check: (p) => p.hasKhrumki && p.hasGazyava,
  },
  {
    id: 'bundle_wholesaler',
    title: 'Оптовик двора',
    description: 'Забрать весь пацанский набор одним кликом за 119 копеек без лишней возни.',
    hint: 'Использовать кнопку «Взять всё сразу» в магазе',
    rarity: 'RARE',
    icon: 'package',
    mode: 'STORY_ONLY',
    check: (p) => p.boughtBundle,
  },
  {
    id: 'qte_master',
    title: 'Мастер QTE',
    description: 'Отжать 300 копеек у Главного Нефора со 100% точностью без единой ошибки.',
    hint: 'Пройти QTE за гаражами со 100% точностью',
    rarity: 'RARE',
    icon: 'zap',
    mode: 'STORY_ONLY',
    check: (p) => p.neforDefeated && p.qteBestAccuracy >= 100,
  },
  {
    id: 'first_try_nefor',
    title: 'С первого наскока',
    description: 'Уложить Главного Нефора в QTE с самой первой попытки.',
    hint: 'Победить Нефора в QTE с 1-й попытки',
    rarity: 'COMMON',
    icon: 'target',
    mode: 'STORY_ONLY',
    check: (p) => p.neforDefeated && p.qteAttempts === 1,
  },
  {
    id: 'combo_machine',
    title: 'Комбо-машина',
    description: 'Разогнать серию ударов минимум до x15 комбо в одном 3D-бою.',
    hint: 'Набрать x15+ комбо в 3D ПВП',
    rarity: 'RARE',
    icon: 'flame',
    mode: 'ALL',
    check: (p) => p.bestCombo >= 15,
  },
  {
    id: 'shadow_on_snow',
    title: 'Тень на снегу',
    description: 'Поймать вражеские атаки рывком [F] в 150-мс фреймы уклонения минимум 3 раза.',
    hint: 'Сделать 3+ точных уклонения [F] за 3D-бой',
    rarity: 'RARE',
    icon: 'wind',
    mode: 'ALL',
    check: (p) => p.bestDodgeEvades >= 3,
  },
  {
    id: 'clutch_win',
    title: 'На волоске',
    description: 'Дожать босса до конца, оставшись с 20 HP или меньше в финале боя.',
    hint: 'Победить в 3D-бою с 20 HP или меньше',
    rarity: 'RARE',
    icon: 'heart',
    mode: 'ALL',
    check: (p) => p.clutchBossWin,
  },
  {
    id: 'secret_skin',
    title: 'Тайный облик',
    description: 'Затащить прохождение с активированным пасхальным скином (F1, F2 или F3).',
    hint: 'Включить скин F1, F2 или F3 до победы',
    rarity: 'RARE',
    icon: 'sparkles',
    mode: 'ALL',
    check: (p) => p.artemTankSkin || p.egorPickleSkin || p.lupikGilbertSkin,
  },
  {
    id: 'untouchable',
    title: 'Неуязвимый',
    description: 'Победить босса в 3D ПВП, не получив ни единой царапины за весь бой.',
    hint: 'Пройти 3D-бой без полученного урона',
    rarity: 'LEGENDARY',
    icon: 'shield',
    mode: 'ALL',
    check: (p) => p.noDamageBossWin,
  },
  {
    id: 'hardcore_legend',
    title: 'Легенда хардкора',
    description: 'Выстоять в режиме ХАРДКОР (9000 HP, броня, 3 фазы) и довести дело до победы.',
    hint: 'Победить в режиме ХАРДКОР',
    rarity: 'LEGENDARY',
    icon: 'crown',
    mode: 'ALL',
    check: (p) => p.hardcore && (p.dimaDefeated || p.wildCucumberDefeated),
  },
  {
    id: 'rift_conqueror',
    title: 'Покоритель разлома',
    description: 'Прорваться сквозь 3 фазы Wild Огурца (10 000 HP) и закрыть фиолетовую трещину.',
    hint: 'Победить Wild Огурца в фиолетовой трещине',
    rarity: 'LEGENDARY',
    icon: 'skull',
    mode: 'ALL',
    check: (p) => p.wildCucumberDefeated,
  },
];

export function evaluateAchievements(
  progress: GameProgress,
  options: { isBossRush: boolean; isTraining: boolean }
): EvaluatedAchievements {
  if (options.isTraining) {
    return { unlocked: [], locked: [], totalForMode: 0 };
  }

  const pool = options.isBossRush
    ? ACHIEVEMENTS.filter((a) => a.mode === 'ALL')
    : ACHIEVEMENTS;

  const unlocked = pool.filter((a) => a.check(progress));
  const locked = pool.filter((a) => !a.check(progress));

  return {
    unlocked,
    locked,
    totalForMode: pool.length,
  };
}

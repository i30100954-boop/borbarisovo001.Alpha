import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundFX } from './audio/soundFx';
import { BossFight3D } from './components/BossFight3D';
import { DialogueBox } from './components/DialogueBox';
import { FighterSelectModal } from './components/FighterSelectModal';
import { GameHUD } from './components/GameHUD';
import { MinionSelectModal } from './components/MinionSelectModal';
import { MultiplayerPanel } from './components/MultiplayerPanel';
import { NeforQTEModal } from './components/NeforQTEModal';
import { ShopModal } from './components/ShopModal';
import { TitleScreen } from './components/TitleScreen';
import { TrainingModal } from './components/TrainingModal';
import { VictoryScreen } from './components/VictoryScreen';
import { WorldCanvas } from './components/WorldCanvas';
import { useMultiplayerClient } from './network/useMultiplayerClient';
import {
  ASSETS,
  BossVictoryStats,
  DialogueSequence,
  DialogueSpeaker,
  FighterId,
  GameProgress,
  GameScreen,
  MinionId,
  PRICES,
  QuestStage,
  SceneId,
  TrainingConfig,
  TrainingStartTarget,
} from './types/game';

const SPEAKERS: Record<'LUPIK' | 'EGOR' | 'ARTEM' | 'NEFOR' | 'DIMA', DialogueSpeaker> = {
  LUPIK: {
    name: 'Лупик',
    role: 'Ровный пацан · Кв. 5',
    portrait: ASSETS.PORTRAIT_LUPIK,
    accentColor: '#38BDF8',
  },
  EGOR: {
    name: 'Егор',
    role: 'Друг · Кв. 6 (2 этаж)',
    accentColor: '#FBBF24',
  },
  ARTEM: {
    name: 'Артём',
    role: 'Друг · Кв. 7 (2 этаж)',
    accentColor: '#34D399',
  },
  NEFOR: {
    name: 'Главный Нефор',
    role: 'Держит гаражи',
    portrait: ASSETS.PORTRAIT_NEFOR,
    accentColor: '#FB7185',
  },
  DIMA: {
    name: 'Дима',
    role: 'Кастрюльный Рыцарь · За магазом',
    portrait: ASSETS.PORTRAIT_DIMA,
    accentColor: '#EF4444',
  },
};

const INITIAL_PROGRESS: GameProgress = {
  egorJoined: false,
  artemJoined: false,
  artemTankSkin: false,
  egorPickleSkin: false,
  lupikGilbertSkin: false,
  neforDefeated: false,
  dimaDefeated: false,
  wildCucumberDefeated: false,
  money: 0,
  hasKhrumki: false,
  hasGazyava: false,
  boughtBundle: false,
  qteAttempts: 0,
  qteBestAccuracy: 0,
  bestCombo: 0,
  bestDodgeEvades: 0,
  noDamageBossWin: false,
  clutchBossWin: false,
  lastBossStats: null,
  hardcore: false,
};

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [scene, setScene] = useState<SceneId>('ENTRANCE');
  const [playerX, setPlayerX] = useState<number>(175);
  const [progress, setProgress] = useState<GameProgress>(INITIAL_PROGRESS);
  const [selectedFighter, setSelectedFighter] = useState<FighterId>('LUPIK');
  const [selectedMinion, setSelectedMinion] = useState<MinionId>('ILIHE');
  const [activeBossId, setActiveBossId] = useState<'DIMA' | 'WILD_CUCUMBER'>('DIMA');
  const [bossRushMode, setBossRushMode] = useState<boolean>(false);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig | null>(null);

  const [dialogue, setDialogue] = useState<DialogueSequence | null>(null);
  const [dialogueLine, setDialogueLine] = useState<number>(0);

  const [muted, setMuted] = useState<boolean>(false);
  const [moneyDelta, setMoneyDelta] = useState<{ amount: number; id: number } | null>(null);
  const [easterEggNotice, setEasterEggNotice] = useState<string | null>(null);
  const deltaTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const mpLocalIdRef = useRef<string | null>(null);
  const remoteHitSeqRef = useRef<number>(0);
  const [remoteBossHit, setRemoteBossHit] = useState<{
    seq: number;
    attackerName: string;
    amount: number;
  } | null>(null);

  const showMoneyDelta = useCallback((amount: number) => {
    if (deltaTimerRef.current) {
      window.clearTimeout(deltaTimerRef.current);
    }
    setMoneyDelta({ amount, id: Date.now() });
    deltaTimerRef.current = window.setTimeout(() => {
      setMoneyDelta(null);
    }, 2200);
  }, []);

  const questStage = useMemo<QuestStage>(() => {
    if (screen === 'VICTORY') return 'COMPLETED';
    if (!progress.egorJoined || !progress.artemJoined) return 'GATHER_FRIENDS';
    if (!progress.neforDefeated) {
      return scene === 'STREET' && playerX > 950 ? 'FIGHT_NEFOR' : 'GO_TO_GARAGES';
    }
    if (!progress.hasKhrumki || !progress.hasGazyava) return 'GO_TO_SHOP';
    if (!progress.dimaDefeated) return 'FIGHT_DIMA';
    return 'RETURN_HOME';
  }, [playerX, progress, scene, screen]);

  const startDialogue = useCallback((seq: DialogueSequence) => {
    soundFX.playDialogueBlip();
    setDialogue(seq);
    setDialogueLine(0);
  }, []);

  const resetGame = useCallback((hardcore?: boolean) => {
    if (deltaTimerRef.current) {
      window.clearTimeout(deltaTimerRef.current);
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setMoneyDelta(null);
    setEasterEggNotice(null);
    setProgress((prev) => ({
      ...INITIAL_PROGRESS,
      hardcore: typeof hardcore === 'boolean' ? hardcore : prev.hardcore,
    }));
    setScene('ENTRANCE');
    setPlayerX(175);
    setDialogue(null);
    setDialogueLine(0);
    setBossRushMode(false);
    setTrainingConfig(null);
    setScreen('PLAYING');
  }, []);

  const mpClient = useMultiplayerClient({
    onGameStarted: (snapshot) => {
      const me = snapshot.players.find((p) => p.id === mpLocalIdRef.current);
      if (me) {
        setSelectedFighter(me.fighter);
        setSelectedMinion(me.minion);
      }
      setDialogue(null);
      setDialogueLine(0);
      setRemoteBossHit(null);
      setTrainingConfig(null);

      if (snapshot.settings.mode === 'STORY') {
        resetGame(snapshot.settings.hardcore);
        return;
      }

      const isWild = snapshot.settings.mode === 'WILD_CUCUMBER';
      setProgress((prev) => ({
        ...INITIAL_PROGRESS,
        artemTankSkin: prev.artemTankSkin,
        egorPickleSkin: prev.egorPickleSkin,
        lupikGilbertSkin: prev.lupikGilbertSkin,
        hardcore: isWild ? true : snapshot.settings.hardcore,
        egorJoined: true,
        artemJoined: true,
        neforDefeated: true,
        hasKhrumki: true,
        hasGazyava: true,
      }));
      setActiveBossId(isWild ? 'WILD_CUCUMBER' : 'DIMA');
      setBossRushMode(true);
      soundFX.playDoorTransition();
      setScreen('BOSS_3D');
    },
    onReturnedToLobby: () => {
      setBossRushMode(false);
      setTrainingConfig(null);
      setScreen('MULTIPLAYER_LOBBY');
    },
    onRemoteBossHpSync: (payload) => {
      if (payload.attackerId && payload.attackerId === mpLocalIdRef.current) return;
      if (payload.amount <= 0) return;
      remoteHitSeqRef.current += 1;
      setRemoteBossHit({
        seq: remoteHitSeqRef.current,
        attackerName: payload.attackerName || 'Союзник',
        amount: payload.amount,
      });
    },
  });

  useEffect(() => {
    mpLocalIdRef.current = mpClient.localPlayerId;
  }, [mpClient.localPlayerId]);

  useEffect(() => {
    if (mpClient.status === 'CONNECTED' && screen === 'TITLE_MENU') {
      setScreen('MULTIPLAYER_LOBBY');
    }
  }, [mpClient.status, screen]);

  // Easter Egg Hotkeys: F1 (Artem King Tiger), F2 (Egor Pickle), F3 (Lupik Gilbert)
  useEffect(() => {
    const showNotice = (msg: string) => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      setEasterEggNotice(msg);
      noticeTimerRef.current = window.setTimeout(() => {
        setEasterEggNotice(null);
      }, 2800);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setProgress((prev) => {
          const nextTank = !prev.artemTankSkin;
          soundFX.playTankToggle(nextTank);
          showNotice(
            nextTank
              ? 'Пасхалка F1: Артём — «Королевский тигр» (200 HP, +10 урона)!'
              : 'Пасхалка F1: Артём вернулся в обычный скин'
          );
          return { ...prev, artemTankSkin: nextTank };
        });
      } else if (e.key === 'F2') {
        e.preventDefault();
        setProgress((prev) => {
          const nextPickle = !prev.egorPickleSkin;
          soundFX.playFriendJoin();
          showNotice(
            nextPickle
              ? 'Пасхалка F2: Егор превратился в Огурчика!'
              : 'Пасхалка F2: Егор снова в пуховике'
          );
          return { ...prev, egorPickleSkin: nextPickle };
        });
      } else if (e.key === 'F3') {
        e.preventDefault();
        setProgress((prev) => {
          const nextGilbert = !prev.lupikGilbertSkin;
          soundFX.playTankToggle(nextGilbert);
          showNotice(
            nextGilbert
              ? 'Пасхалка F3: Лупик в скине Гилберта (Examination)!'
              : 'Пасхалка F3: Лупик снова в зимней шапке'
          );
          return { ...prev, lupikGilbertSkin: nextGilbert };
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleStartFromTitle = (hardcore: boolean) => {
    setActiveBossId('DIMA');
    resetGame(hardcore);
    startDialogue({
      id: 'INTRO',
      actionLabel: 'Погнали собирать пацанов',
      onCompleteAction: 'NONE',
      lines: [
        {
          speaker: SPEAKERS.LUPIK,
          text: hardcore
            ? 'РЕЖИМ ХАРДКОР! Зима в Борбарисово 001 стала в разы жёстче: Нефор давит на 12 клавиш (V B C H J G), а за магазом ждёт бронированный Дима на 9000 HP и с 3 фазами! Собираем Егора и Артёма на 2 этаже.'
            : 'На улице Борбарисово 001 зима лютая. Но дома скучно — надо собрать Егора и Артёма прямо тут на 2 этаже, сходить за гаражи к Нефору за лавехой, а потом в магаз за хрумками и газявой.',
        },
      ],
    });
  };

  const handleStartBossRush = (hardcore: boolean, bossId: 'DIMA' | 'WILD_CUCUMBER' = 'DIMA') => {
    if (deltaTimerRef.current) {
      window.clearTimeout(deltaTimerRef.current);
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setMoneyDelta(null);
    setEasterEggNotice(null);
    setDialogue(null);
    setDialogueLine(0);
    setActiveBossId(bossId);
    setProgress((prev) => ({
      ...INITIAL_PROGRESS,
      artemTankSkin: prev.artemTankSkin,
      egorPickleSkin: prev.egorPickleSkin,
      lupikGilbertSkin: prev.lupikGilbertSkin,
      hardcore: bossId === 'WILD_CUCUMBER' ? true : hardcore,
      egorJoined: true,
      artemJoined: true,
      neforDefeated: true,
      hasKhrumki: true,
      hasGazyava: true,
    }));
    setBossRushMode(true);
    setTrainingConfig(null);
    soundFX.playDoorTransition();
    setScreen('FIGHTER_SELECT');
  };

  const handleConfirmTraining = (config: TrainingConfig) => {
    if (deltaTimerRef.current) {
      window.clearTimeout(deltaTimerRef.current);
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setMoneyDelta(null);
    setEasterEggNotice(null);
    setDialogue(null);
    setDialogueLine(0);
    setActiveBossId('DIMA');
    setProgress((prev) => ({
      ...INITIAL_PROGRESS,
      artemTankSkin: prev.artemTankSkin,
      egorPickleSkin: prev.egorPickleSkin,
      lupikGilbertSkin: prev.lupikGilbertSkin,
      hardcore: config.hardcore,
      egorJoined: true,
      artemJoined: true,
      neforDefeated: true,
      hasKhrumki: true,
      hasGazyava: true,
    }));
    setBossRushMode(false);
    setTrainingConfig(config);
    soundFX.playDoorTransition();
    setScreen('FIGHTER_SELECT');
  };

  const handleToggleMute = () => {
    const next = !muted;
    soundFX.muted = next;
    setMuted(next);
  };

  const handleInteract = useCallback(
    (zoneId: string) => {
      if (zoneId === 'DOOR_LUPIK') {
        const canFinish =
          progress.egorJoined &&
          progress.artemJoined &&
          progress.hasKhrumki &&
          progress.hasGazyava &&
          progress.dimaDefeated;

        if (canFinish) {
          soundFX.playVictory();
          setScreen('VICTORY');
          return;
        }

        startDialogue({
          id: 'HOME_NOT_READY',
          actionLabel: 'Понял',
          onCompleteAction: 'NONE',
          lines: [
            {
              speaker: SPEAKERS.LUPIK,
              text:
                !progress.egorJoined || !progress.artemJoined
                  ? 'Это моя дверь, Кв. 5. Сначала надо забрать Егора (Кв. 6) и Артёма (Кв. 7) тут же на втором этаже!'
                  : progress.hasKhrumki && progress.hasGazyava && !progress.dimaDefeated
                  ? 'За магазом нас поджидает Главный Злодей Дима! Надо сначала разобраться с ним в 3D ПВП!'
                  : 'Рано домой заходить — сначала за гаражи за лавехой, потом в магаз за хрумками и газявой!',
            },
          ],
        });
        return;
      }

      if (zoneId === 'DOOR_EGOR') {
        if (progress.egorJoined) {
          startDialogue({
            id: 'EGOR_ALREADY',
            actionLabel: 'Идём дальше',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.EGOR,
                text: 'Я уже с тобой, Лупик! Шапка на месте, двигаем дальше.',
              },
            ],
          });
          return;
        }

        soundFX.playKnock();
        startDialogue({
          id: 'RECRUIT_EGOR',
          actionLabel: 'Взять Егора в отряд',
          onCompleteAction: 'RECRUIT_EGOR',
          lines: [
            {
              speaker: SPEAKERS.LUPIK,
              text: 'Егор, открывай! Выходим в Борбарисово 001 — надо за гаражи сгонять и потом за хрумками с газявой.',
            },
            {
              speaker: SPEAKERS.EGOR,
              text: 'О, здорово, Лупик! Сейчас пуховик застегну — я в деле. Только Артёма из 7-й квартиры тоже позови!',
            },
          ],
        });
        return;
      }

      if (zoneId === 'DOOR_ARTEM') {
        if (progress.artemJoined) {
          startDialogue({
            id: 'ARTEM_ALREADY',
            actionLabel: 'Двигаем',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.ARTEM,
                text: 'Я готов на все сто, брат. За хрумки и газяву хоть в метель!',
              },
            ],
          });
          return;
        }

        soundFX.playKnock();
        startDialogue({
          id: 'RECRUIT_ARTEM',
          actionLabel: 'Взять Артёма в отряд',
          onCompleteAction: 'RECRUIT_ARTEM',
          lines: [
            {
              speaker: SPEAKERS.LUPIK,
              text: 'Артём, выходи! Движ на районе намечается.',
            },
            {
              speaker: SPEAKERS.ARTEM,
              text: 'Залетаю в отряд! Слышал, за гаражами Главный Нефор тусуется — у него точно лавеха найдётся.',
            },
          ],
        });
        return;
      }

      if (zoneId === 'STAIRS_OUT') {
        if (!progress.egorJoined || !progress.artemJoined) {
          startDialogue({
            id: 'NEED_FRIENDS',
            actionLabel: 'Вернуться на этаж',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.LUPIK,
                text: 'Одному во двор выходить не по-пацански. Надо сначала постучать Егору (Кв. 6) и Артёму (Кв. 7)!',
              },
            ],
          });
          return;
        }

        soundFX.playDoorTransition();
        setScene('STREET');
        setPlayerX(220);
        return;
      }

      if (zoneId === 'STREET_ENTRANCE') {
        soundFX.playDoorTransition();
        setScene('ENTRANCE');
        setPlayerX(880);
        return;
      }

      if (zoneId === 'NEFOR_SPOT') {
        if (progress.neforDefeated) {
          startDialogue({
            id: 'NEFOR_AFTER',
            actionLabel: 'В магаз',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.NEFOR,
                text: 'Всё, всё, пацаны, я ж отдал вам 300 копеек... Идите уже в магаз за своими хрумками.',
              },
            ],
          });
          return;
        }

        startDialogue({
          id: 'NEFOR_CONFRONT',
          actionLabel: 'Начать QTE: Отбири лавеху',
          onCompleteAction: 'START_QTE',
          lines: [
            {
              speaker: SPEAKERS.NEFOR,
              text: 'Опа, а кто это к нам за гаражи забрёл? Район Борбарисово 001 не резиновый, чё надо?',
            },
            {
              speaker: SPEAKERS.LUPIK,
              text: 'Мы с Егором и Артёмом по делу. Выкладывай лавеху — нам на хрумки и газяву не хватает!',
            },
            {
              speaker: SPEAKERS.NEFOR,
              text: 'Ха! Попробуй сначала отбери! Если вывезешь — отдам все 300 копеек!',
            },
          ],
        });
        return;
      }

      if (zoneId === 'SHOP_DOOR') {
        if (!progress.neforDefeated) {
          startDialogue({
            id: 'SHOP_NO_MONEY',
            actionLabel: 'Идти за гаражи',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.EGOR,
                text: 'Лупик, у нас в баре денег по нулям! Надо сходить за гаражи к Главному Нефору и сделать QTE «Отбири лавеху».',
              },
            ],
          });
          return;
        }

        soundFX.playDoorTransition();
        setScreen('SHOP');
        return;
      }

      if (zoneId === 'DIMA_SPOT') {
        if (!progress.hasKhrumki || !progress.hasGazyava) {
          startDialogue({
            id: 'DIMA_LOCKED',
            actionLabel: 'В магаз',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.ARTEM,
                text: 'За магазом засел Дима, но сначала давай купим Хрумки (67 коп.) и Газяву (52 коп.) в магазе!',
              },
            ],
          });
          return;
        }

        if (progress.dimaDefeated) {
          startDialogue({
            id: 'DIMA_AFTER',
            actionLabel: 'Идём домой',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: SPEAKERS.DIMA,
                text: 'Ладно, пацаны, вы реально мощные... Забирайте свои хрумки и двигайте в Борбарисово 001.',
              },
            ],
          });
          return;
        }

        startDialogue({
          id: 'DIMA_CONFRONT',
          actionLabel: 'Выбрать бойца для 3D ПВП',
          onCompleteAction: 'START_BOSS_SELECT',
          lines: [
            {
              speaker: SPEAKERS.DIMA,
              text: progress.hardcore
                ? 'Ну что, Лупик и компания? В ХАРДКОРЕ вы отсюда просто так не уйдёте! У меня 9000 HP, бронепластины на пузе и спине и 3 фазы!'
                : 'Ну что, Лупик и компания? Думали спокойно пройти мимо магаза с хрумками и газявой? У меня 5000 HP!',
            },
            {
              speaker: progress.lupikGilbertSkin
                ? { ...SPEAKERS.LUPIK, portrait: ASSETS.PORTRAIT_GILBERT, name: 'Лупик · Гилберт' }
                : SPEAKERS.LUPIK,
              text: 'Егор, Артём — выбираем, кто пойдёт раз на раз с Димой в 3D ПВП! Зададим ему жару!',
            },
          ],
        });
      }

      if (zoneId === 'WILD_CUCUMBER_PORTAL') {
        setActiveBossId('WILD_CUCUMBER');
        if (progress.wildCucumberDefeated) {
          startDialogue({
            id: 'WILD_CUCUMBER_AFTER',
            actionLabel: 'Понял',
            onCompleteAction: 'NONE',
            lines: [
              {
                speaker: { name: 'Wild Огурец', role: 'Фиолетовая трещина', accentColor: '#A855F7' },
                text: 'Трещина закрыта. Wild Огурец повержен, аномалия в Борбарисово 001 исчерпана.',
              },
            ],
          });
          return;
        }

        startDialogue({
          id: 'WILD_CUCUMBER_CONFRONT',
          actionLabel: 'Войти в портал (Wild Огурец 10000 HP)',
          onCompleteAction: 'START_BOSS_SELECT',
          lines: [
            {
              speaker: { name: 'Wild Огурец', role: 'Фиолетовая трещина', accentColor: '#A855F7' },
              text: 'Из фиолетовой трещины повеяло ледяным космосом и запахом солёных огурцов. Перед вами возвышается Wild Огурец (10000 HP) в ярости!',
            },
            {
              speaker: SPEAKERS.LUPIK,
              text: 'Ничего себе аномалия! Пацаны, проверяем оружие — это серьёзный замес на 10 000 HP!',
            },
          ],
        });
      }
    },
    [progress, startDialogue]
  );

  const handleAdvanceDialogue = useCallback(() => {
    if (!dialogue) return;
    if (dialogueLine < dialogue.lines.length - 1) {
      soundFX.playDialogueBlip();
      setDialogueLine((prev) => prev + 1);
      return;
    }

    const action = dialogue.onCompleteAction;
    setDialogue(null);
    setDialogueLine(0);

    if (action === 'RECRUIT_EGOR') {
      soundFX.playFriendJoin();
      setProgress((prev) => ({ ...prev, egorJoined: true }));
    } else if (action === 'RECRUIT_ARTEM') {
      soundFX.playFriendJoin();
      setProgress((prev) => ({ ...prev, artemJoined: true }));
    } else if (action === 'START_QTE') {
      setScreen('QTE');
    } else if (action === 'START_BOSS_SELECT') {
      setScreen('FIGHTER_SELECT');
    }
  }, [dialogue, dialogueLine]);

  const handleQteSuccess = (accuracy: number, attempts = 1) => {
    setProgress((prev) => ({
      ...prev,
      neforDefeated: true,
      money: prev.money + PRICES.NEFOR_REWARD,
      qteAttempts: prev.qteAttempts + attempts,
      qteBestAccuracy: Math.max(prev.qteBestAccuracy, accuracy),
    }));
    showMoneyDelta(PRICES.NEFOR_REWARD);
    setScreen('PLAYING');
    startDialogue({
      id: 'AFTER_QTE_WIN',
      actionLabel: 'Идём в магаз направо',
      onCompleteAction: 'NONE',
      lines: [
        {
          speaker: SPEAKERS.ARTEM,
          text: 'Красава, Лупик! 300 копеек в кармане — бар денег полон! Погнали направо в магаз за хрумками и газявой!',
        },
      ],
    });
  };

  const handleBuyKhrumki = () => {
    if (progress.hasKhrumki || progress.money < PRICES.KHRUMKI) return;
    soundFX.playPurchase();
    setProgress((prev) => ({
      ...prev,
      hasKhrumki: true,
      money: prev.money - PRICES.KHRUMKI,
    }));
    showMoneyDelta(-PRICES.KHRUMKI);
  };

  const handleBuyGazyava = () => {
    if (progress.hasGazyava || progress.money < PRICES.GAZYAVA) return;
    soundFX.playPurchase();
    setProgress((prev) => ({
      ...prev,
      hasGazyava: true,
      money: prev.money - PRICES.GAZYAVA,
    }));
    showMoneyDelta(-PRICES.GAZYAVA);
  };

  const handleBuyBoth = () => {
    const total = PRICES.KHRUMKI + PRICES.GAZYAVA;
    if (progress.hasKhrumki || progress.hasGazyava || progress.money < total) return;
    soundFX.playPurchase();
    setProgress((prev) => ({
      ...prev,
      hasKhrumki: true,
      hasGazyava: true,
      boughtBundle: true,
      money: prev.money - total,
    }));
    showMoneyDelta(-total);
  };

  const handleCloseShop = () => {
    soundFX.playDoorTransition();
    setScreen('PLAYING');
    if (progress.hasKhrumki && progress.hasGazyava && !progress.dimaDefeated) {
      startDialogue({
        id: 'GO_BEHIND_SHOP',
        actionLabel: 'Идём за магаз направо!',
        onCompleteAction: 'NONE',
        lines: [
          {
            speaker: SPEAKERS.EGOR,
            text: `Хрумки за 67 коп. взяли, газяву за 52 коп. тоже! Но глянь направо за магаз — там Главный Злодей Дима (${
              progress.hardcore ? '9000 HP · ХАРДКОР' : '5000 HP'
            }) перегородил путь! Идём к нему!`,
          },
        ],
      });
    }
  };

  const handleBossVictory = (stats?: BossVictoryStats) => {
    setProgress((prev) => ({
      ...prev,
      ...(activeBossId === 'WILD_CUCUMBER'
        ? { wildCucumberDefeated: true }
        : { dimaDefeated: true }),
      bestCombo: Math.max(prev.bestCombo, stats?.maxCombo ?? 0),
      bestDodgeEvades: Math.max(prev.bestDodgeEvades, stats?.dodgeEvades ?? 0),
      noDamageBossWin: prev.noDamageBossWin || Boolean(stats && stats.damageTaken === 0),
      clutchBossWin:
        prev.clutchBossWin || Boolean(stats && stats.remainingHp > 0 && stats.remainingHp <= 20),
      lastBossStats: stats ?? prev.lastBossStats,
    }));
    if (bossRushMode || trainingConfig) {
      soundFX.playVictory();
      setScreen('VICTORY');
      return;
    }
    setScreen('PLAYING');
    startDialogue({
      id: 'BOSS_DEFEATED_DIALOGUE',
      actionLabel: 'Погнали домой!',
      onCompleteAction: 'NONE',
      lines: [
        {
          speaker: SPEAKERS.ARTEM,
          text:
            activeBossId === 'WILD_CUCUMBER'
              ? 'Wild Огурец раскатан в ноль! Трещина закрылась. Возвращаемся в Кв. 5!'
              : 'Жёстко мы Диму раскатали в 3D! Теперь всё чисто — возвращаемся все вместе в наш подъезд на 2 этаж, в Кв. 5!',
        },
      ],
    });
  };

  const handleWatchCutscene = () => {
    setActiveBossId('WILD_CUCUMBER');
    setBossRushMode(false);
    setTrainingConfig({ hardcore: true, startTarget: 'CUTSCENE' });
    setScreen('BOSS_3D');
  };

  if (screen === 'TITLE_MENU') {
    return (
      <TitleScreen
        onStart={handleStartFromTitle}
        onStartBossRush={handleStartBossRush}
        onStartTraining={() => setScreen('TRAINING_SETUP')}
        onWatchCutscene={handleWatchCutscene}
        mpClient={mpClient}
        onOpenLobby={() => setScreen('MULTIPLAYER_LOBBY')}
      />
    );
  }

  if (screen === 'MULTIPLAYER_LOBBY') {
    return (
      <div className="min-h-screen w-full bg-[#0B1320] text-[#EDF2F8] flex flex-col justify-between relative overflow-x-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={ASSETS.TITLE_BACKDROP}
            alt="Зимний двор Борбарисово 001"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1320] via-[#0B1320]/85 to-[#0B1320]/65" />
        </div>
        <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex-1 flex items-center">
          <MultiplayerPanel
            client={mpClient}
            onBackToMenu={() => setScreen('TITLE_MENU')}
          />
        </main>
      </div>
    );
  }

  if (screen === 'TRAINING_SETUP') {
    return (
      <TrainingModal
        initialHardcore={progress.hardcore}
        onConfirm={handleConfirmTraining}
        onClose={() => setScreen('TITLE_MENU')}
      />
    );
  }

  if (screen === 'VICTORY') {
    const isTraining = trainingConfig !== null;
    const isCoopConnected = mpClient.status === 'CONNECTED';
    return (
      <VictoryScreen
        progress={progress}
        isBossRush={bossRushMode}
        isTraining={isTraining}
        trainingTarget={trainingConfig?.startTarget ?? null}
        bossId={activeBossId}
        onPlayAgain={() => {
          if (isCoopConnected) {
            if (mpClient.localPlayer?.isHost) {
              mpClient.returnToLobby();
            }
            setBossRushMode(false);
            setTrainingConfig(null);
            setScreen('MULTIPLAYER_LOBBY');
          } else if (bossRushMode || isTraining) {
            setBossRushMode(false);
            setTrainingConfig(null);
            setScreen('TITLE_MENU');
          } else {
            resetGame();
          }
        }}
        onBossRushAgain={() => {
          setProgress((prev) => ({
            ...prev,
            dimaDefeated: false,
            wildCucumberDefeated: false,
            bestCombo: 0,
            bestDodgeEvades: 0,
            noDamageBossWin: false,
            clutchBossWin: false,
            lastBossStats: null,
          }));
          setScreen(isTraining ? 'TRAINING_SETUP' : 'FIGHTER_SELECT');
        }}
        onBackToMenu={() => {
          setBossRushMode(false);
          setTrainingConfig(null);
          if (isCoopConnected) {
            if (mpClient.localPlayer?.isHost) {
              mpClient.returnToLobby();
            }
            setScreen('MULTIPLAYER_LOBBY');
          } else {
            setScreen('TITLE_MENU');
          }
        }}
      />
    );
  }

  const isModalOpen = screen !== 'PLAYING' || dialogue !== null;
  const isQuickArenaMode = bossRushMode || trainingConfig !== null;

  return (
    <div className="min-h-screen w-full bg-[#0B1320] text-[#EDF2F8] flex flex-col">
      {!isQuickArenaMode && (
        <>
          <GameHUD
            scene={scene}
            progress={progress}
            questStage={questStage}
            moneyDelta={moneyDelta}
            muted={muted}
            onToggleMute={handleToggleMute}
            onRestart={() => resetGame()}
            onBackToMenu={() => setScreen('TITLE_MENU')}
          />

          <main className="flex-1 flex flex-col justify-center py-2">
            <WorldCanvas
              scene={scene}
              playerX={playerX}
              setPlayerX={setPlayerX}
              progress={progress}
              questStage={questStage}
              isModalOpen={isModalOpen}
              onInteract={handleInteract}
              coopLocalPlayerId={mpClient.status === 'CONNECTED' ? mpClient.localPlayerId : null}
              coopFighter={selectedFighter}
              coopMinion={selectedMinion}
              coopRemoteStatesRef={mpClient.status === 'CONNECTED' ? mpClient.remoteStatesRef : undefined}
              onCoopSyncState={mpClient.status === 'CONNECTED' ? mpClient.sendPlayerState : undefined}
            />
          </main>
        </>
      )}

      {dialogue && screen === 'PLAYING' && (
        <DialogueBox
          dialogue={dialogue}
          lineIndex={dialogueLine}
          onAdvance={handleAdvanceDialogue}
        />
      )}

      {screen === 'QTE' && (
        <NeforQTEModal
          hardcore={progress.hardcore}
          onSuccess={handleQteSuccess}
          onCancel={() => {
            setProgress((prev) => ({ ...prev, qteAttempts: prev.qteAttempts + 1 }));
            setScreen('PLAYING');
          }}
          onBackToMenu={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'SHOP' && (
        <ShopModal
          progress={progress}
          onBuyKhrumki={handleBuyKhrumki}
          onBuyGazyava={handleBuyGazyava}
          onBuyBoth={handleBuyBoth}
          onClose={handleCloseShop}
        />
      )}

      {screen === 'FIGHTER_SELECT' && (
        <FighterSelectModal
          progress={progress}
          isBossRush={bossRushMode}
          isTraining={trainingConfig !== null}
          bossId={activeBossId}
          onSelectFighter={(fighter) => {
            setSelectedFighter(fighter);
            setScreen('MINION_SELECT');
          }}
          onClose={() => {
            if (trainingConfig !== null) {
              setScreen('TRAINING_SETUP');
            } else if (bossRushMode) {
              setBossRushMode(false);
              setScreen('TITLE_MENU');
            } else {
              setScreen('PLAYING');
            }
          }}
        />
      )}

      {screen === 'MINION_SELECT' && (
        <MinionSelectModal
          fighter={selectedFighter}
          progress={progress}
          onSelectMinion={(minion) => {
            setSelectedMinion(minion);
            setScreen('BOSS_3D');
          }}
          onBack={() => setScreen('FIGHTER_SELECT')}
          onClose={() => {
            if (trainingConfig !== null) {
              setTrainingConfig(null);
              setScreen('TITLE_MENU');
            } else if (bossRushMode) {
              setBossRushMode(false);
              setScreen('TITLE_MENU');
            } else {
              setScreen('PLAYING');
            }
          }}
        />
      )}

      {screen === 'BOSS_3D' && (
        <BossFight3D
          fighter={selectedFighter}
          minion={selectedMinion}
          progress={progress}
          isBossRush={bossRushMode}
          trainingTarget={trainingConfig?.startTarget ?? null}
          bossId={activeBossId}
          coopPlayersCount={mpClient.status === 'CONNECTED' ? mpClient.players.length : 1}
          coopLocalPlayerId={mpClient.status === 'CONNECTED' ? mpClient.localPlayerId : null}
          coopIsHost={mpClient.status === 'CONNECTED' ? Boolean(mpClient.localPlayer?.isHost) : true}
          coopPlayers={mpClient.status === 'CONNECTED' ? mpClient.players : undefined}
          coopRemoteStatesRef={mpClient.status === 'CONNECTED' ? mpClient.remoteStatesRef : undefined}
          coopBossStateRef={mpClient.status === 'CONNECTED' ? mpClient.bossStateRef : undefined}
          coopRemoteHit={mpClient.status === 'CONNECTED' ? remoteBossHit : null}
          onCoopDamageDealt={mpClient.status === 'CONNECTED' ? mpClient.sendBossDamage : undefined}
          onCoopSyncState={mpClient.status === 'CONNECTED' ? mpClient.sendPlayerState : undefined}
          onCoopAttack={mpClient.status === 'CONNECTED' ? mpClient.sendPlayerAttack : undefined}
          subscribeCoopAttack={mpClient.status === 'CONNECTED' ? mpClient.subscribeRemoteAttack : undefined}
          onCoopSyncBossState={mpClient.status === 'CONNECTED' ? mpClient.sendBossState : undefined}
          onCoopBossEvent={mpClient.status === 'CONNECTED' ? mpClient.sendBossEvent : undefined}
          onCoopBossStomp={mpClient.status === 'CONNECTED' ? mpClient.sendBossStomp : undefined}
          subscribeCoopBossEvent={mpClient.status === 'CONNECTED' ? mpClient.subscribeBossEvent : undefined}
          subscribeCoopRemoteHit={mpClient.status === 'CONNECTED' ? mpClient.subscribeRemoteBossHit : undefined}
          onVictory={handleBossVictory}
          onChangeFighter={() => setScreen('FIGHTER_SELECT')}
          onChangeTrainingPhase={(target: TrainingStartTarget) => {
            setTrainingConfig((prev) =>
              prev ? { ...prev, startTarget: target } : { hardcore: progress.hardcore, startTarget: target }
            );
          }}
          onBackToMenu={() => {
            setBossRushMode(false);
            setTrainingConfig(null);
            if (mpClient.status === 'CONNECTED') {
              if (mpClient.localPlayer?.isHost) {
                mpClient.returnToLobby();
              }
              setScreen('MULTIPLAYER_LOBBY');
            } else {
              setScreen('TITLE_MENU');
            }
          }}
        />
      )}

      {easterEggNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-6 z-50 bg-[#131F33] border border-amber-500/60 text-amber-300 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg shadow-xl pointer-events-none"
        >
          {easterEggNotice}
        </div>
      )}
    </div>
  );
}

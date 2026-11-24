import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';
import { soundFX } from '../audio/soundFx';
import { ASSETS, PRICES } from '../types/game';

interface QteStep {
  id: number;
  keyLabel: string;
  validKeys: string[];
  promptText: string;
}

const NORMAL_SEQUENCE: QteStep[] = [
  { id: 1, keyLabel: 'W', validKeys: ['w', 'ц', 'arrowup'], promptText: 'Держи стойку — жми W!' },
  { id: 2, keyLabel: 'A', validKeys: ['a', 'ф', 'arrowleft'], promptText: 'Резкий манёвр влево — жми A!' },
  { id: 3, keyLabel: 'D', validKeys: ['d', 'в', 'arrowright'], promptText: 'Заход с фланга — жми D!' },
  { id: 4, keyLabel: 'S', validKeys: ['s', 'ы', 'arrowdown'], promptText: 'Уклон от шарфа Нефора — жми S!' },
  { id: 5, keyLabel: 'E', validKeys: ['e', 'у'], promptText: 'Хватай барсетку — жми E!' },
  { id: 6, keyLabel: 'SPACE', validKeys: [' '], promptText: 'Финальный отжим — жми ПРОБЕЛ!' },
];

const HARDCORE_SEQUENCE: QteStep[] = [
  { id: 1, keyLabel: 'W', validKeys: ['w', 'ц', 'arrowup'], promptText: 'Держи стойку — жми W!' },
  { id: 7, keyLabel: 'V', validKeys: ['v', 'м'], promptText: 'ХАРДКОР! Контр-захват — жми V!' },
  { id: 2, keyLabel: 'A', validKeys: ['a', 'ф', 'arrowleft'], promptText: 'Резкий манёвр влево — жми A!' },
  { id: 8, keyLabel: 'B', validKeys: ['b', 'и'], promptText: 'ХАРДКОР! Блок локтем — жми B!' },
  { id: 3, keyLabel: 'D', validKeys: ['d', 'в', 'arrowright'], promptText: 'Заход с фланга — жми D!' },
  { id: 9, keyLabel: 'C', validKeys: ['c', 'с'], promptText: 'ХАРДКОР! Подсечка — жми C!' },
  { id: 4, keyLabel: 'S', validKeys: ['s', 'ы', 'arrowdown'], promptText: 'Уклон от шарфа Нефора — жми S!' },
  { id: 10, keyLabel: 'H', validKeys: ['h', 'р'], promptText: 'ХАРДКОР! Выбивай барсетку — жми H!' },
  { id: 5, keyLabel: 'E', validKeys: ['e', 'у'], promptText: 'Хватай барсетку — жми E!' },
  { id: 11, keyLabel: 'J', validKeys: ['j', 'о'], promptText: 'ХАРДКОР! Резкий рывок — жми J!' },
  { id: 6, keyLabel: 'SPACE', validKeys: [' '], promptText: 'Финальный отжим — жми ПРОБЕЛ!' },
  { id: 12, keyLabel: 'G', validKeys: ['g', 'п'], promptText: 'ХАРДКОР! Жёсткий финиш — жми G!' },
];

const MAX_MISSES = 3;

interface NeforQTEModalProps {
  hardcore: boolean;
  onSuccess: (accuracy: number, attempts: number) => void;
  onCancel: () => void;
  onBackToMenu?: () => void;
}

export function NeforQTEModal({ hardcore, onSuccess, onCancel, onBackToMenu }: NeforQTEModalProps) {
  const sequence = hardcore ? HARDCORE_SEQUENCE : NORMAL_SEQUENCE;
  const roundDurationMs = hardcore ? 2250 : 2600;
  const targetWins = hardcore ? 10 : 5;

  const [stepIndex, setStepIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [timeLeftMs, setTimeLeftMs] = useState(roundDurationMs);
  const [feedback, setFeedback] = useState<{ type: 'hit' | 'miss'; text: string } | null>(null);
  const [status, setStatus] = useState<'ACTIVE' | 'WON' | 'LOST'>('ACTIVE');
  const [shake, setShake] = useState(false);

  const lastTickRef = useRef<number>(performance.now());
  const stepHandledRef = useRef<boolean>(false);

  const currentStep = sequence[stepIndex % sequence.length];

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 180);
  }, []);

  const advanceRound = useCallback(
    (nextHits: number, nextMisses: number) => {
      if (nextHits >= targetWins) {
        setStatus('WON');
        soundFX.playMoneyGain();
        return;
      }
      if (nextMisses >= MAX_MISSES) {
        setStatus('LOST');
        soundFX.playQteMiss();
        return;
      }
      setStepIndex((prev) => (prev + 1) % sequence.length);
      setTimeLeftMs(roundDurationMs);
      lastTickRef.current = performance.now();
      stepHandledRef.current = false;
      soundFX.playQtePrompt();
    },
    [roundDurationMs, sequence.length, targetWins]
  );

  const handleActionInput = useCallback(
    (matched: boolean) => {
      if (status !== 'ACTIVE' || stepHandledRef.current) return;
      stepHandledRef.current = true;

      if (matched) {
        const nextHits = hits + 1;
        setHits(nextHits);
        setFeedback({ type: 'hit', text: 'Чётко! Пацаны давят!' });
        soundFX.playQteHit();
        triggerShake();
        window.setTimeout(() => {
          advanceRound(nextHits, misses);
        }, 220);
      } else {
        const nextMisses = misses + 1;
        setMisses(nextMisses);
        setFeedback({ type: 'miss', text: 'Мимо! Нефор увернулся!' });
        soundFX.playQteMiss();
        triggerShake();
        window.setTimeout(() => {
          advanceRound(hits, nextMisses);
        }, 260);
      }
    },
    [advanceRound, hits, misses, status, triggerShake]
  );

  // Timer loop
  useEffect(() => {
    if (status !== 'ACTIVE') return;
    lastTickRef.current = performance.now();
    soundFX.playQtePrompt();

    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;

      setTimeLeftMs((prev) => {
        const next = prev - dt;
        if (next <= 0) {
          if (!stepHandledRef.current) {
            stepHandledRef.current = true;
            const nextMisses = misses + 1;
            setMisses(nextMisses);
            setFeedback({ type: 'miss', text: 'Не успел! Время вышло!' });
            soundFX.playQteMiss();
            triggerShake();
            window.setTimeout(() => {
              advanceRound(hits, nextMisses);
            }, 260);
          }
          return 0;
        }
        return next;
      });
    }, 30);

    return () => window.clearInterval(interval);
  }, [advanceRound, hits, misses, status, triggerShake]);

  // Keyboard listener
  useEffect(() => {
    if (status !== 'ACTIVE') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }
      const isValid = currentStep.validKeys.includes(key);
      // Ignore Shift/Control/Alt/Meta
      if (['shift', 'control', 'alt', 'meta', 'tab'].includes(key)) return;
      handleActionInput(isValid);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStep, handleActionInput, status]);

  const handleRetry = () => {
    setStepIndex(0);
    setHits(0);
    setMisses(0);
    setAttempts((prev) => prev + 1);
    setTimeLeftMs(roundDurationMs);
    setFeedback(null);
    setStatus('ACTIVE');
    stepHandledRef.current = false;
  };

  const totalAttempts = hits + misses;
  const accuracy = totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) : 100;
  const timerPercent = Math.max(0, Math.min(100, (timeLeftMs / roundDurationMs) * 100));
  const controlButtons = hardcore
    ? [
        { label: 'W', keys: ['w'] },
        { label: 'A', keys: ['a'] },
        { label: 'S', keys: ['s'] },
        { label: 'D', keys: ['d'] },
        { label: 'E', keys: ['e'] },
        { label: 'SPACE', keys: [' '] },
        { label: 'V', keys: ['v'] },
        { label: 'B', keys: ['b'] },
        { label: 'C', keys: ['c'] },
        { label: 'H', keys: ['h'] },
        { label: 'J', keys: ['j'] },
        { label: 'G', keys: ['g'] },
      ]
    : [
        { label: 'W', keys: ['w'] },
        { label: 'A', keys: ['a'] },
        { label: 'S', keys: ['s'] },
        { label: 'D', keys: ['d'] },
        { label: 'E', keys: ['e'] },
        { label: 'SPACE', keys: [' '] },
      ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080E1A]/90 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="QTE: Отбири лавеху"
    >
      <div
        className={`w-full max-w-2xl bg-[#131F33] border ${
          hardcore ? 'border-rose-500/70' : 'border-slate-600/80'
        } rounded-xl p-6 shadow-2xl transition-transform duration-100 ${
          shake ? 'translate-x-1 -translate-y-0.5' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-700/70">
          <div className="flex items-center gap-3 min-w-0">
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
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${hardcore ? 'text-rose-400' : 'text-amber-400'}`}>
                Разборка за гаражами · Борбарисово 001 {hardcore ? '· ХАРДКОР (12 букв: V B C H J G)' : ''}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-slate-50 mt-0.5 truncate">
                QTE: Отбири лавеху {hardcore ? '(ХАРДКОР x2)' : ''}
              </h2>
            </div>
          </div>
          <div className="text-right font-mono-nums text-xs text-slate-300 shrink-0">
            <div>Успехи: <strong className="text-emerald-400 text-sm">{hits}/{targetWins}</strong></div>
            <div className="mt-0.5">Ошибки: <strong className="text-rose-400 text-sm">{misses}/{MAX_MISSES}</strong></div>
          </div>
        </div>

        {/* Face-off Portraits */}
        <div className="grid grid-cols-2 gap-4 my-5">
          <div className="flex items-center gap-3 bg-[#0B1320] border border-slate-700/60 rounded-lg p-3">
            <img
              src={ASSETS.PORTRAIT_LUPIK}
              alt="Лупик"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-sky-300 truncate">Лупик и братва</div>
              <div className="text-xs text-slate-400">Егор и Артём прикрывают</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 bg-[#0B1320] border border-slate-700/60 rounded-lg p-3 text-right">
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-rose-400 truncate">Главный Нефор</div>
              <div className="text-xs text-slate-400 font-mono-nums">В кармане: {PRICES.NEFOR_REWARD} коп.</div>
            </div>
            <img
              src={ASSETS.PORTRAIT_NEFOR}
              alt="Главный Нефор"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          </div>
        </div>

        {/* Active QTE Arena */}
        {status === 'ACTIVE' && (
          <div>
            {/* Progress / Struggle Bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Натиск братвы</span>
                <span className="font-mono-nums">{Math.round((hits / targetWins) * 100)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-200"
                  style={{ width: `${(hits / targetWins) * 100}%` }}
                />
              </div>
            </div>

            {/* Target Prompt Box */}
            <div className="bg-[#0B1320] border border-amber-500/40 rounded-xl p-6 text-center">
              <p className="text-base font-semibold text-slate-100 mb-4">
                {currentStep.promptText}
              </p>

              <button
                type="button"
                onClick={() => handleActionInput(true)}
                className="inline-flex items-center justify-center min-w-[96px] h-20 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-display text-3xl font-extrabold shadow-lg shadow-amber-500/20 transition-transform focus-visible:outline-2 focus-visible:outline-white"
              >
                {currentStep.keyLabel === 'SPACE' ? 'ПРОБЕЛ' : currentStep.keyLabel}
              </button>

              {/* Round Timer Bar */}
              <div className="mt-5 max-w-md mx-auto">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-none ${
                      timerPercent < 35 ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
                <div className="mt-2 h-5 text-xs font-semibold">
                  {feedback ? (
                    <span className={feedback.type === 'hit' ? 'text-emerald-400' : 'text-rose-400'}>
                      {feedback.text}
                    </span>
                  ) : (
                    <span className="text-slate-400">Нажми нужную клавишу на клавиатуре или кликни по кнопке</span>
                  )}
                </div>
              </div>
            </div>

            {/* Clickable Key Pad (for mouse/touch accessibility) */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {controlButtons.map((btn) => {
                const isTarget = btn.label === currentStep.keyLabel;
                return (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => handleActionInput(isTarget)}
                    className={`px-4 py-2.5 rounded-lg font-mono-nums text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      isTarget
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#1A283F] border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {btn.label === 'SPACE' ? 'ПРОБЕЛ' : btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Won State */}
        {status === 'WON' && (
          <div className="bg-[#0B1320] border border-emerald-500/50 rounded-xl p-6 text-center">
            <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="font-display text-2xl font-extrabold text-emerald-400">
              Лавеха отобрана! +{PRICES.NEFOR_REWARD} коп.
            </h3>
            <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
              Главный Нефор понял, что с ровными пацанами из Борбарисово 001 шутки плохи,
              и честно отсыпал тебе 300 копеек. Теперь — в магаз!
            </p>
            <button
              type="button"
              onClick={() => onSuccess(accuracy, attempts)}
              className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Забрать 300 коп. и идти в магаз
            </button>
          </div>
        )}

        {/* Lost State */}
        {status === 'LOST' && (
          <div className="bg-[#0B1320] border border-rose-500/50 rounded-xl p-6 text-center">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="font-display text-2xl font-extrabold text-rose-400">
              Нефор выкрутился!
            </h3>
            <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
              Слишком много промахов — Нефор чуть не сбежал за гаражи. Соберитесь с Егором и Артёмом и попробуйте снова!
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Отступить
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Повторить QTE</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

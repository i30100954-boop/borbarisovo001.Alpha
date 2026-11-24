import { ASSETS } from '../types/game';

class SoundFX {
  private ctx: AudioContext | null = null;
  private comboHitBuffer: AudioBuffer | null = null;
  private comboMissBuffer: AudioBuffer | null = null;
  private glassShatterBuffer: AudioBuffer | null = null;
  private comboBuffersLoading = false;
  public muted = false;
  public comboVolume = 0.65;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
    slideTo?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playFootstep(isSnow: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!isSnow) {
      this.playTone(135 + Math.random() * 25, 0.055, 'triangle', 0.05, 0, 85);
      return;
    }

    // Filtered noise burst for winter snow crunch
    const bufferSize = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400 + Math.random() * 400;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playKnock() {
    this.playTone(160, 0.07, 'triangle', 0.16, 0, 90);
    this.playTone(150, 0.07, 'triangle', 0.16, 0.13, 85);
    this.playTone(165, 0.08, 'triangle', 0.17, 0.26, 88);
  }

  playFriendJoin() {
    this.playTone(440, 0.12, 'triangle', 0.12, 0);
    this.playTone(554.37, 0.12, 'triangle', 0.12, 0.09);
    this.playTone(659.25, 0.22, 'triangle', 0.14, 0.18);
  }

  playDoorTransition() {
    this.playTone(220, 0.14, 'sine', 0.09, 0, 140);
    this.playTone(330, 0.16, 'sine', 0.08, 0.08, 440);
  }

  playDialogueBlip() {
    this.playTone(480 + Math.random() * 60, 0.045, 'square', 0.035);
  }

  playQtePrompt() {
    this.playTone(620, 0.07, 'sine', 0.08);
  }

  playQteHit() {
    this.playTone(260, 0.09, 'sawtooth', 0.12, 0, 520);
    this.playTone(780, 0.12, 'triangle', 0.1, 0.04);
  }

  playQteMiss() {
    this.playTone(180, 0.18, 'sawtooth', 0.11, 0, 95);
  }

  playMoneyGain() {
    this.playTone(587.33, 0.1, 'triangle', 0.14, 0);
    this.playTone(739.99, 0.1, 'triangle', 0.14, 0.08);
    this.playTone(880, 0.12, 'triangle', 0.14, 0.16);
    this.playTone(1174.66, 0.28, 'triangle', 0.15, 0.24);
  }

  playPurchase() {
    this.playTone(720, 0.08, 'sine', 0.12, 0);
    this.playTone(1046.5, 0.16, 'triangle', 0.13, 0.07);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.26, 'triangle', 0.12, idx * 0.11);
    });
  }

  playTankToggle(enabled: boolean) {
    if (enabled) {
      // Heavy metallic breech clank + low diesel engine growl
      this.playTone(95, 0.22, 'sawtooth', 0.14, 0, 62);
      this.playTone(180, 0.08, 'square', 0.11, 0.06, 110);
      this.playTone(320, 0.14, 'triangle', 0.1, 0.14, 440);
    } else {
      this.playTone(300, 0.1, 'triangle', 0.1, 0, 180);
    }
  }

  playShotgun() {
    this.playTone(140, 0.16, 'sawtooth', 0.16, 0, 48);
    this.playTone(420, 0.08, 'square', 0.09, 0, 120);
  }

  playCannon() {
    this.playTone(90, 0.34, 'sawtooth', 0.18, 0, 35);
    this.playTone(220, 0.14, 'square', 0.12, 0.02, 70);
  }

  playDogBark() {
    this.playTone(340, 0.08, 'triangle', 0.13, 0, 480);
    this.playTone(380, 0.09, 'triangle', 0.13, 0.12, 260);
  }

  playRadarPing() {
    this.playTone(980, 0.22, 'sine', 0.1, 0, 1120);
    this.playTone(1240, 0.18, 'sine', 0.08, 0.16);
  }

  playExplosion() {
    this.playTone(75, 0.42, 'sawtooth', 0.2, 0, 28);
    this.playTone(130, 0.25, 'square', 0.14, 0.03, 40);
  }

  playRage() {
    this.playTone(220, 0.18, 'sawtooth', 0.12, 0, 440);
    this.playTone(330, 0.24, 'sawtooth', 0.12, 0.09, 660);
  }

  playBossHit() {
    this.playTone(115, 0.14, 'square', 0.13, 0, 65);
  }

  playBellySlam() {
    this.playTone(110, 0.35, 'triangle', 0.22, 0, 42);
    this.playTone(180, 0.18, 'sine', 0.18, 0.04, 85);
  }

  playFruitEat() {
    this.playTone(520, 0.07, 'triangle', 0.12, 0, 680);
    this.playTone(660, 0.08, 'triangle', 0.12, 0.09, 880);
    this.playTone(880, 0.16, 'sine', 0.12, 0.18, 1046);
  }

  playSonicWave() {
    this.playTone(620, 0.38, 'sawtooth', 0.16, 0, 140);
    this.playTone(440, 0.42, 'square', 0.12, 0.05, 95);
    this.playTone(880, 0.22, 'triangle', 0.11, 0, 320);
  }

  playWireShot() {
    this.playTone(540, 0.09, 'sawtooth', 0.11, 0, 210);
    this.playTone(820, 0.06, 'square', 0.08, 0.03, 390);
  }

  playBossJump() {
    this.playTone(130, 0.28, 'triangle', 0.16, 0, 290);
    this.playTone(90, 0.35, 'sawtooth', 0.18, 0.28, 35);
  }

  playSkyLaser() {
    this.playTone(1240, 0.22, 'sawtooth', 0.14, 0, 190);
    this.playTone(620, 0.18, 'square', 0.09, 0.02, 110);
  }

  playBossDash() {
    this.playTone(110, 0.35, 'sawtooth', 0.15, 0, 340);
    this.playTone(220, 0.25, 'triangle', 0.12, 0.12, 520);
  }

  playGarageBounce() {
    this.playTone(150, 0.14, 'square', 0.16, 0, 72);
    this.playTone(320, 0.1, 'triangle', 0.12, 0.02, 140);
  }

  playArmorBreak() {
    this.playTone(680, 0.12, 'square', 0.16, 0, 210);
    this.playTone(460, 0.16, 'sawtooth', 0.15, 0.06, 130);
    this.playTone(920, 0.1, 'triangle', 0.12, 0.11, 340);
  }

  playKnifeSlash() {
    this.playTone(980, 0.12, 'sawtooth', 0.15, 0, 260);
    this.playTone(480, 0.16, 'triangle', 0.14, 0.04, 140);
  }

  playTurkeyPeck() {
    this.playTone(760, 0.08, 'triangle', 0.16, 0, 320);
    this.playTone(540, 0.1, 'sawtooth', 0.13, 0.03, 190);
  }

  playTurkeyGobble() {
    this.playTone(390, 0.07, 'sawtooth', 0.11, 0, 520);
    this.playTone(480, 0.07, 'sawtooth', 0.11, 0.07, 360);
    this.playTone(510, 0.08, 'sawtooth', 0.11, 0.14, 340);
    this.playTone(620, 0.18, 'triangle', 0.12, 0.21, 780);
  }

  playJump() {
    this.playTone(220, 0.11, 'sine', 0.1, 0, 420);
  }

  playDodgeDash() {
    const ctx = this.ensureContext();
    if (ctx) {
      const bufferSize = Math.floor(ctx.sampleRate * 0.14);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.12);
      filter.Q.value = 1.6;

      const gain = ctx.createGain();
      gain.gain.value = 0.14;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    }
    this.playTone(290, 0.12, 'triangle', 0.11, 0, 620);
    this.playTone(540, 0.09, 'sine', 0.08, 0.02, 880);
  }

  playDodgeEvade() {
    this.playTone(880, 0.08, 'sine', 0.13, 0, 1320);
    this.playTone(1318.5, 0.14, 'triangle', 0.11, 0.03, 1760);
  }

  async preloadComboAudio() {
    if (this.comboBuffersLoading || (this.comboHitBuffer && this.comboMissBuffer && this.glassShatterBuffer)) return;
    if (typeof window === 'undefined') return;
    this.comboBuffersLoading = true;
    try {
      const ctx = this.ensureContext();
      if (!ctx) {
        this.comboBuffersLoading = false;
        return;
      }
      const loadBuf = async (url: string): Promise<AudioBuffer | null> => {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        return await ctx.decodeAudioData(arr);
      };
      const [hitBuf, missBuf, shatterBuf] = await Promise.all([
        loadBuf(ASSETS.SFX_COMBO_HIT),
        loadBuf(ASSETS.SFX_COMBO_MISS),
        loadBuf(ASSETS.SFX_GLASS_SHATTER),
      ]);
      if (hitBuf) this.comboHitBuffer = hitBuf;
      if (missBuf) this.comboMissBuffer = missBuf;
      if (shatterBuf) this.glassShatterBuffer = shatterBuf;
    } catch {
      // Fallback uses HTMLAudioElement if fetch/decode fails
    } finally {
      this.comboBuffersLoading = false;
    }
  }

  playGlassShatter(heavy = false) {
    if (this.muted) return;
    const vol = heavy ? 0.92 : 0.72;
    const ctx = this.ensureContext();

    if (ctx && this.glassShatterBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.glassShatterBuffer;
      src.playbackRate.value = heavy ? 0.92 : 0.98 + Math.random() * 0.08;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } else if (typeof Audio !== 'undefined') {
      const el = new Audio(ASSETS.SFX_GLASS_SHATTER);
      el.volume = vol;
      el.play().catch(() => {});
      if (!this.glassShatterBuffer) {
        void this.preloadComboAudio();
      }
    }
  }

  playComboHit(comboCount: number) {
    if (this.muted || this.comboVolume <= 0.005) return;
    const vol = Math.max(0, Math.min(1, this.comboVolume));
    const profileTier = comboCount >= 20 ? 2 : comboCount >= 10 ? 1 : 0;

    // Distinct pitch profile per tier: sharp energetic lift at x10 and x20
    const rate =
      profileTier === 2
        ? Math.min(2.28, 1.92 + Math.max(0, comboCount - 20) * 0.03)
        : profileTier === 1
        ? Math.min(1.83, 1.42 + Math.max(0, comboCount - 10) * 0.045)
        : Math.min(1.31, 0.95 + Math.max(0, comboCount - 1) * 0.045);

    const ctx = this.ensureContext();

    if (ctx && this.comboHitBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.comboHitBuffer;
      src.playbackRate.value = rate;

      const gain = ctx.createGain();
      gain.gain.value = profileTier === 2 ? Math.min(1, vol * 1.1) : profileTier === 1 ? Math.min(1, vol * 1.05) : vol;

      if (profileTier >= 1) {
        const eq = ctx.createBiquadFilter();
        eq.type = 'highshelf';
        eq.frequency.value = profileTier === 2 ? 2600 : 2100;
        eq.gain.value = profileTier === 2 ? 9 : 5.5;
        src.connect(eq);
        eq.connect(gain);
      } else {
        src.connect(gain);
      }

      gain.connect(ctx.destination);
      src.start();
    } else if (typeof Audio !== 'undefined') {
      const el = new Audio(ASSETS.SFX_COMBO_HIT) as HTMLAudioElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      el.volume = vol;
      el.preservesPitch = false;
      el.mozPreservesPitch = false;
      el.webkitPreservesPitch = false;
      el.playbackRate = rate;
      el.play().catch(() => {});
      if (!this.comboHitBuffer) {
        void this.preloadComboAudio();
      }
    }

    // Tier-specific energetic synth profile layered over the hit sound
    if (profileTier === 2) {
      const baseFreq = Math.min(1760, 880 * Math.pow(1.045, Math.min(comboCount - 20, 12)));
      this.playTone(baseFreq, 0.095, 'sawtooth', 0.075 * vol, 0, baseFreq * 1.35);
      this.playTone(baseFreq * 1.5, 0.11, 'triangle', 0.095 * vol, 0.02, baseFreq * 2.0);
    } else if (profileTier === 1) {
      const baseFreq = Math.min(1320, 620 * Math.pow(1.05, Math.min(comboCount - 10, 9)));
      this.playTone(baseFreq, 0.095, 'sawtooth', 0.06 * vol, 0, baseFreq * 1.25);
      this.playTone(baseFreq * 1.25, 0.1, 'triangle', 0.08 * vol, 0.015, baseFreq * 1.5);
    } else {
      const chimeFreq = Math.min(920, 440 * Math.pow(1.059463, Math.min(comboCount - 1, 9)));
      this.playTone(chimeFreq, 0.085, 'triangle', 0.085 * vol, 0.01, chimeFreq * 1.15);
    }

    // Milestone sound profile shift fanfares at exact x10 and x20 thresholds
    if (comboCount === 10) {
      this.playTone(659.25, 0.11, 'triangle', 0.11 * vol, 0.02);
      this.playTone(880, 0.12, 'triangle', 0.11 * vol, 0.07);
      this.playTone(1318.5, 0.18, 'sawtooth', 0.085 * vol, 0.12, 1480);
    } else if (comboCount === 20) {
      this.playTone(880, 0.1, 'triangle', 0.12 * vol, 0.01);
      this.playTone(1174.66, 0.1, 'triangle', 0.12 * vol, 0.055);
      this.playTone(1567.98, 0.12, 'sawtooth', 0.09 * vol, 0.1);
      this.playTone(2093, 0.22, 'triangle', 0.12 * vol, 0.145, 2349);
    }
  }

  playComboBreak() {
    if (this.muted || this.comboVolume <= 0.005) return;
    const vol = Math.max(0, Math.min(1, this.comboVolume * 1.1));
    const ctx = this.ensureContext();

    if (ctx && this.comboMissBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.comboMissBuffer;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } else if (typeof Audio !== 'undefined') {
      const el = new Audio(ASSETS.SFX_COMBO_MISS);
      el.volume = vol;
      el.play().catch(() => {});
      if (!this.comboMissBuffer) {
        void this.preloadComboAudio();
      }
    }
  }
}

export const soundFX = new SoundFX();

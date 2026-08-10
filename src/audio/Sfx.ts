type Waveform = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  private tone(freq: number, durationMs: number, type: Waveform, volume: number, freqEnd?: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const durationSec = durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + durationSec);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private noiseBurst(durationMs: number, volume: number, filterFreq: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const durationSec = durationMs / 1000;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + durationSec);
  }

  playShoot(): void {
    this.tone(880, 60, "square", 0.22, 440);
  }

  playMeleeSwing(): void {
    this.noiseBurst(70, 0.15, 2500);
  }

  playHit(): void {
    this.tone(220, 50, "square", 0.18, 90);
  }

  playPlayerHit(): void {
    this.tone(140, 140, "sawtooth", 0.28, 60);
  }

  playEnemyDeath(): void {
    this.noiseBurst(120, 0.22, 900);
  }

  playBossAttack(): void {
    this.tone(160, 120, "sawtooth", 0.3, 90);
  }

  playBossDeath(): void {
    this.noiseBurst(320, 0.3, 400);
    this.tone(110, 420, "sawtooth", 0.3, 35);
  }

  playBossPhase(): void {
    this.tone(600, 320, "sawtooth", 0.32, 150);
  }

  playChestOpen(): void {
    this.tone(500, 150, "triangle", 0.22, 900);
  }

  playPickup(): void {
    this.tone(700, 90, "sine", 0.2, 1200);
  }

  playSkill(): void {
    this.tone(400, 220, "sine", 0.3, 900);
  }
}

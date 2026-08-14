/**
 * Fully procedural match audio (no assets): a two-layer filtered-noise crowd bed
 * whose gain/band follow an excitement envelope, bat-crack transients shaped by
 * contact quality, leather-on-pitch thuds, stump clatter and appeal swells.
 */
export class AudioDirector {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private excitement = 0.12;
  private excitementTarget = 0.12;
  private started = false;

  /** Must be called from a user gesture. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // Crowd bed: looped brown-ish noise through a bandpass.
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 500;
    this.crowdFilter.Q.value = 0.55;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.16;
    src.connect(this.crowdFilter);
    this.crowdFilter.connect(this.crowdGain);
    this.crowdGain.connect(this.master);
    src.start();
  }

  setExcitement(level: number): void {
    this.excitementTarget = Math.max(0, Math.min(1, level));
  }

  update(dt: number): void {
    if (!this.ctx || !this.crowdGain || !this.crowdFilter) return;
    this.excitement += (this.excitementTarget - this.excitement) * Math.min(1, dt * 2.2);
    const e = this.excitement;
    this.crowdGain.gain.setTargetAtTime(0.1 + e * 0.5, this.ctx.currentTime, 0.1);
    this.crowdFilter.frequency.setTargetAtTime(420 + e * 900, this.ctx.currentTime, 0.15);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  /** The crack of willow: sharper and louder the better the contact. */
  batHit(quality: number): void {
    const q = Math.max(0.15, quality);
    this.burst(0.09, 2400 + q * 1800, 1.2, 0.5 + q * 0.8);
    this.tone(190 + q * 60, 0.12, 0.25 * q, 'triangle');
  }

  ballBounce(): void {
    this.burst(0.05, 300, 0.8, 0.12, 'lowpass');
  }

  padThud(): void {
    this.burst(0.07, 220, 1, 0.3, 'lowpass');
  }

  stumpsHit(): void {
    for (let i = 0; i < 3; i++) {
      window.setTimeout(() => this.tone(1150 + i * 350, 0.16, 0.22, 'square'), i * 28);
    }
    this.burst(0.06, 900, 2, 0.35);
  }

  appeal(): void {
    // Crowd roars up in anticipation.
    this.excitement = Math.min(1, this.excitement + 0.45);
  }

  boundary(): void {
    this.excitement = Math.min(1, this.excitement + 0.5);
    this.burst(0.5, 800, 0.4, 0.4);
  }

  wicket(): void {
    this.excitement = 1;
    this.burst(0.7, 700, 0.4, 0.5);
  }

  catchTaken(): void {
    this.excitement = 1;
    this.burst(0.6, 900, 0.5, 0.5);
  }

  uiClick(): void {
    this.tone(880, 0.06, 0.12, 'sine');
  }
}

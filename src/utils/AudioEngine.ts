// Procedural audio engine using Web Audio API

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Engine sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineVolume: GainNode | null = null;

  // Wheel screech noise nodes
  private screechNoise: AudioWorkletNode | ScriptProcessorNode | null = null;
  private screechVolume: GainNode | null = null;

  // Idle check
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.ctx = new AudioCtxClass();
      this.setupEngineSound();
      this.setupScreechSound();
      this.isInitialized = true;
    } catch (e) {
      console.error("AudioEngine initialization failed:", e);
    }
  }

  private setupEngineSound() {
    if (!this.ctx) return;

    // Create a chain for the engine sound
    this.engineVolume = this.ctx.createGain();
    this.engineVolume.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    // Two oscillators for a fat engine rumble
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(40, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(40.5, this.ctx.currentTime);

    // Dynamic wave shaper or gain
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(subGain);
    subGain.connect(this.engineFilter);

    this.engineFilter.connect(this.engineVolume);
    this.engineVolume.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupScreechSound() {
    if (!this.ctx) return;

    this.screechVolume = this.ctx.createGain();
    this.screechVolume.gain.setValueAtTime(0.0, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // Generate procedural white noise for screeching tires
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    whiteNoise.connect(filter);
    filter.connect(this.screechVolume);
    this.screechVolume.connect(this.ctx.destination);

    whiteNoise.start();
  }

  updateEngine(rpmRatio: number, power: number) {
    if (this.isMuted || !this.isInitialized || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      return; // Awaiting user action to resume
    }

    const targetFreq1 = 30 + rpmRatio * 160;
    const targetFreq2 = 30.5 + rpmRatio * 161;
    const targetFilter = 100 + rpmRatio * 600 + power * 200;
    const targetVolume = (0.2 + power * 0.25) * (this.isMuted ? 0 : 0.8);

    const ct = this.ctx.currentTime;
    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineVolume) {
      this.engineOsc1.frequency.setTargetAtTime(targetFreq1, ct, 0.1);
      this.engineOsc2.frequency.setTargetAtTime(targetFreq2, ct, 0.1);
      this.engineFilter.frequency.setTargetAtTime(targetFilter, ct, 0.05);
      this.engineVolume.gain.setTargetAtTime(targetVolume, ct, 0.15);
    }
  }

  updateScreech(intensity: number) {
    if (this.isMuted || !this.isInitialized || !this.ctx || !this.screechVolume) return;

    const targetVolume = Math.min(1.0, Math.max(0.0, intensity)) * 0.15;
    this.screechVolume.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.05);
  }

  playCollision(intensity: number) {
    if (this.isMuted || !this.isInitialized || !this.ctx) return;

    const strength = Math.min(1.0, Math.max(0.0, intensity));
    if (strength < 0.1) return;

    const osc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    const ct = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ct);
    osc.frequency.exponentialRampToValueAtTime(10, ct + 0.3);

    noiseGain.gain.setValueAtTime(strength * 0.4, ct);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ct + 0.3);

    osc.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(ct + 0.45);
  }

  playCheckpoint() {
    if (this.isMuted || !this.isInitialized || !this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const ct = this.ctx.currentTime;

    osc1.frequency.setValueAtTime(330, ct);
    osc1.frequency.setValueAtTime(440, ct + 0.12);
    osc1.frequency.setValueAtTime(660, ct + 0.24);

    osc2.frequency.setValueAtTime(165, ct);
    osc2.frequency.setValueAtTime(220, ct + 0.12);
    osc2.frequency.setValueAtTime(330, ct + 0.24);

    gain.gain.setValueAtTime(0.2, ct);
    gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();

    osc1.stop(ct + 0.5);
    osc2.stop(ct + 0.5);
  }

  playLockSound() {
    if (this.isMuted || !this.isInitialized || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const ct = this.ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ct);
    osc.frequency.setValueAtTime(1100, ct + 0.06);
    gain.gain.setValueAtTime(0.1, ct);
    gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(ct + 0.25);
  }

  playUnlockSound() {
    if (this.isMuted || !this.isInitialized || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const ct = this.ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, ct);
    osc.frequency.setValueAtTime(880, ct + 0.06);
    gain.gain.setValueAtTime(0.1, ct);
    gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(ct + 0.25);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.engineVolume) this.engineVolume.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.screechVolume) this.screechVolume.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new AudioEngine();

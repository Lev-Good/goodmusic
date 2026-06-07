import type { EQSettings } from '../types/player';
import { PitchShifter } from './pitchShifter';

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  public ctx: AudioContext | null = null;
  
  // Dual playback elements
  public elementA: HTMLAudioElement;
  public elementB: HTMLAudioElement;
  private activeElementIndex: 'A' | 'B' = 'A';

  // Dedicated radio element to bypass AudioContext CORS restriction
  private radioElement: HTMLAudioElement | null = null;
  private isRadioActive = false;

  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  
  // Gain nodes for crossfading
  private fadeGainA: GainNode | null = null;
  private fadeGainB: GainNode | null = null;

  private preampGain: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  public analyser: AnalyserNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private soundCheckEnabled = false;
  private mainGain: GainNode | null = null;
  private pitchShifter: PitchShifter | null = null;

  private isInitialized = false;
  private activeUrlA: string | null = null;
  private activeUrlB: string | null = null;
  
  private currentVolume = 0.8;
  private userMute = false;
  
  private currentEQSettings: EQSettings = {
    enabled: true,
    bands: new Array(10).fill(0),
    bassBoost: 0,
    trebleBoost: 0,
    preamp: 0,
  };

  private constructor() {
    this.elementA = new Audio();
    this.elementA.crossOrigin = 'anonymous';
    this.elementB = new Audio();
    this.elementB.crossOrigin = 'anonymous';
    this.radioElement = new Audio();
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public get element(): HTMLAudioElement {
    if (this.isRadioActive && this.radioElement) {
      return this.radioElement;
    }
    return this.activeElementIndex === 'A' ? this.elementA : this.elementB;
  }

  // Lazy initialize AudioContext on user interaction
  public initContext() {
    if (this.isInitialized) return;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.sourceNodeA = this.ctx.createMediaElementSource(this.elementA);
      this.sourceNodeB = this.ctx.createMediaElementSource(this.elementB);

      // Create individual fade gains for crossfading
      this.fadeGainA = this.ctx.createGain();
      this.fadeGainB = this.ctx.createGain();
      
      // Default: A is active (gain 1), B is silent (gain 0)
      this.fadeGainA.gain.setValueAtTime(1, this.ctx.currentTime);
      this.fadeGainB.gain.setValueAtTime(0, this.ctx.currentTime);

      // Connect sources to their fade gains
      this.sourceNodeA.connect(this.fadeGainA);
      this.sourceNodeB.connect(this.fadeGainB);

      // Merge both fade gains into the preamp
      this.preampGain = this.ctx.createGain();
      this.preampGain.gain.setValueAtTime(1, this.ctx.currentTime);
      
      this.fadeGainA.connect(this.preampGain);
      this.fadeGainB.connect(this.preampGain);

      // Setup Pitch Shifter
      this.pitchShifter = new PitchShifter(this.ctx);
      this.preampGain.connect(this.pitchShifter.node);

      // 10 EQ peaking filters
      let lastNode: AudioNode = this.pitchShifter.node;
      for (let i = 0; i < EQ_FREQUENCIES.length; i++) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.setValueAtTime(EQ_FREQUENCIES[i], this.ctx.currentTime);
        filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
        filter.gain.setValueAtTime(0, this.ctx.currentTime);
        
        lastNode.connect(filter);
        this.eqFilters.push(filter);
        lastNode = filter;
      }

      // Bass Boost
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(150, this.ctx.currentTime);
      this.bassFilter.gain.setValueAtTime(0, this.ctx.currentTime);
      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      // Treble Boost
      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.setValueAtTime(6000, this.ctx.currentTime);
      this.trebleFilter.gain.setValueAtTime(0, this.ctx.currentTime);
      lastNode.connect(this.trebleFilter);
      lastNode = this.trebleFilter;

      // Analyser
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      lastNode.connect(this.analyser);
      lastNode = this.analyser;

      // Compressor Node (Sound Check / Normalization)
      this.compressorNode = this.ctx.createDynamicsCompressor();
      this.applySoundCheckSettings();
      lastNode.connect(this.compressorNode);
      lastNode = this.compressorNode;

      // Main Volume Gain Node
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
      lastNode.connect(this.mainGain);

      this.mainGain.connect(this.ctx.destination);

      this.isInitialized = true;
      this.applyAllEQSettings();
    } catch (err) {
      console.error('Failed to initialize Web Audio API Context', err);
    }
  }

  // Play a file on the active element (standard load)
  public async playFile(fileOrUrl: File | string): Promise<void> {
    if (this.isRadioActive) {
      this.isRadioActive = false;
      if (this.radioElement) {
        this.radioElement.pause();
        this.radioElement.src = '';
      }
    }

    this.initContext();

    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const activeIndex = this.activeElementIndex;
    const activeElement = activeIndex === 'A' ? this.elementA : this.elementB;
    const activeFadeGain = activeIndex === 'A' ? this.fadeGainA : this.fadeGainB;
    const inactiveFadeGain = activeIndex === 'A' ? this.fadeGainB : this.fadeGainA;

    // Release old URL
    if (activeIndex === 'A' && this.activeUrlA && this.activeUrlA.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlA);
    } else if (activeIndex === 'B' && this.activeUrlB && this.activeUrlB.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlB);
    }

    const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    if (activeIndex === 'A') this.activeUrlA = url;
    else this.activeUrlB = url;

    activeElement.crossOrigin = 'anonymous';
    activeElement.src = url;
    
    if ('preservesPitch' in activeElement) {
      activeElement.preservesPitch = true;
    }

    // Reset volume mapping to guarantee it's not faded
    if (this.ctx) {
      activeFadeGain?.gain.setValueAtTime(1, this.ctx.currentTime);
      inactiveFadeGain?.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    await activeElement.play();
  }

  // Play an online stream URL (like live radio)
  public async playStream(url: string): Promise<void> {
    // Stop any active file playing
    this.elementA.pause();
    this.elementA.src = '';
    this.elementB.pause();
    this.elementB.src = '';

    if (this.activeUrlA && this.activeUrlA.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlA);
    }
    if (this.activeUrlB && this.activeUrlB.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlB);
    }
    this.activeUrlA = null;
    this.activeUrlB = null;

    this.isRadioActive = true;
    if (this.radioElement) {
      if (typeof document !== 'undefined' && !document.getElementById('native-radio-element')) {
        this.radioElement.id = 'native-radio-element';
        this.radioElement.style.display = 'none';
        document.body.appendChild(this.radioElement);
      }
      this.radioElement.src = url;
      this.radioElement.volume = this.currentVolume;
      this.radioElement.muted = this.userMute;
      await this.radioElement.play();
    }
  }

  // Play a file with a smooth crossfade from the currently playing track
  public async playFileWithCrossfade(fileOrUrl: File | string, durationSeconds: number): Promise<void> {
    if (this.isRadioActive) {
      this.isRadioActive = false;
      if (this.radioElement) {
        this.radioElement.pause();
        this.radioElement.src = '';
      }
    }

    this.initContext();

    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (!this.ctx || !this.fadeGainA || !this.fadeGainB || durationSeconds <= 0) {
      // Fallback to standard play if Web Audio is not initialized or crossfade is 0
      await this.playFile(fileOrUrl);
      return;
    }

    const currentActiveIndex = this.activeElementIndex;
    const currentActiveElement = currentActiveIndex === 'A' ? this.elementA : this.elementB;
    const currentActiveGain = currentActiveIndex === 'A' ? this.fadeGainA : this.fadeGainB;
    
    const nextActiveIndex = currentActiveIndex === 'A' ? 'B' : 'A';
    const nextActiveElement = nextActiveIndex === 'A' ? this.elementA : this.elementB;
    const nextActiveGain = nextActiveIndex === 'A' ? this.fadeGainA : this.fadeGainB;

    // Release old URL for the inactive channel
    if (nextActiveIndex === 'A' && this.activeUrlA && this.activeUrlA.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlA);
      this.activeUrlA = null;
    } else if (nextActiveIndex === 'B' && this.activeUrlB && this.activeUrlB.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeUrlB);
      this.activeUrlB = null;
    }

    const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    if (nextActiveIndex === 'A') this.activeUrlA = url;
    else this.activeUrlB = url;

    nextActiveElement.crossOrigin = 'anonymous';
    nextActiveElement.src = url;
    if ('preservesPitch' in nextActiveElement) {
      nextActiveElement.preservesPitch = true;
    }

    // Set playback speed for the incoming element
    nextActiveElement.playbackRate = currentActiveElement.playbackRate;

    // Trigger play on incoming element (starts muted)
    nextActiveGain.gain.setValueAtTime(0, this.ctx.currentTime);
    await nextActiveElement.play();

    // Ramping gain values
    const now = this.ctx.currentTime;
    currentActiveGain.gain.setValueAtTime(currentActiveGain.gain.value, now);
    currentActiveGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

    nextActiveGain.gain.setValueAtTime(0, now);
    nextActiveGain.gain.linearRampToValueAtTime(1, now + durationSeconds);

    // Swap active reference immediately so UI binds to new element timeupdates
    this.activeElementIndex = nextActiveIndex;

    // After transition duration, pause old element
    setTimeout(() => {
      currentActiveElement.pause();
      currentActiveElement.src = '';
    }, durationSeconds * 1000 + 100);
  }

  public play() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.element.play();
  }

  public pause() {
    this.element.pause();
  }

  public seek(seconds: number) {
    this.element.currentTime = seconds;
  }

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.mainGain && this.ctx && !this.userMute) {
      this.mainGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
    }
    this.elementA.volume = this.currentVolume;
    this.elementB.volume = this.currentVolume;
    if (this.radioElement) {
      this.radioElement.volume = this.currentVolume;
    }
  }

  public setMute(muted: boolean) {
    this.userMute = muted;
    if (this.mainGain && this.ctx) {
      const targetVolume = muted ? 0 : this.currentVolume;
      this.mainGain.gain.setValueAtTime(targetVolume, this.ctx.currentTime);
    }
    this.elementA.muted = muted;
    this.elementB.muted = muted;
    if (this.radioElement) {
      this.radioElement.muted = muted;
    }
  }

  public setSpeed(rate: number) {
    this.elementA.playbackRate = rate;
    this.elementB.playbackRate = rate;
  }

  public setPitch(semitones: number) {
    this.initContext();
    if (this.pitchShifter) {
      this.pitchShifter.setPitch(semitones);
    }
  }

  public setEQBand(index: number, dbValue: number) {
    this.currentEQSettings.bands[index] = dbValue;
    if (this.isInitialized && this.currentEQSettings.enabled) {
      const filter = this.eqFilters[index];
      if (filter && this.ctx) {
        filter.gain.setValueAtTime(dbValue, this.ctx.currentTime);
      }
    }
  }

  public setPreamp(dbValue: number) {
    this.currentEQSettings.preamp = dbValue;
    if (this.isInitialized && this.preampGain && this.ctx) {
      const gainMultiplier = Math.pow(10, dbValue / 20);
      this.preampGain.gain.setValueAtTime(gainMultiplier, this.ctx.currentTime);
    }
  }

  public setBassBoost(value: number) {
    this.currentEQSettings.bassBoost = value;
    if (this.isInitialized && this.bassFilter && this.ctx) {
      const dbBoost = (value / 100) * 12;
      this.bassFilter.gain.setValueAtTime(dbBoost, this.ctx.currentTime);
    }
  }

  public setTrebleBoost(value: number) {
    this.currentEQSettings.trebleBoost = value;
    if (this.isInitialized && this.trebleFilter && this.ctx) {
      const dbBoost = (value / 100) * 12;
      this.trebleFilter.gain.setValueAtTime(dbBoost, this.ctx.currentTime);
    }
  }

  public setEQEnabled(enabled: boolean) {
    this.currentEQSettings.enabled = enabled;
    this.applyAllEQSettings();
  }

  private applyAllEQSettings() {
    if (!this.isInitialized || !this.ctx) return;

    for (let i = 0; i < this.eqFilters.length; i++) {
      const dbValue = this.currentEQSettings.enabled ? this.currentEQSettings.bands[i] : 0;
      this.eqFilters[i].gain.setValueAtTime(dbValue, this.ctx.currentTime);
    }

    const preampDb = this.currentEQSettings.enabled ? this.currentEQSettings.preamp : 0;
    const preampMultiplier = Math.pow(10, preampDb / 20);
    this.preampGain?.gain.setValueAtTime(preampMultiplier, this.ctx.currentTime);

    const bassDb = this.currentEQSettings.enabled ? (this.currentEQSettings.bassBoost / 100) * 12 : 0;
    this.bassFilter?.gain.setValueAtTime(bassDb, this.ctx.currentTime);

    const trebleDb = this.currentEQSettings.enabled ? (this.currentEQSettings.trebleBoost / 100) * 12 : 0;
    this.trebleFilter?.gain.setValueAtTime(trebleDb, this.ctx.currentTime);
  }

  public getAnalyserData(): Uint8Array | null {
    if (!this.isInitialized || !this.analyser) return null;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public fadeAndPause(onComplete: () => void) {
    if (this.isRadioActive) {
      this.pause();
      onComplete();
      return;
    }

    if (!this.isInitialized || !this.mainGain || !this.ctx) {
      this.pause();
      onComplete();
      return;
    }

    const fadeDuration = 10;
    const steps = 40;
    const intervalTime = (fadeDuration * 1000) / steps;
    const startVolume = this.userMute ? 0 : this.currentVolume;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const fraction = 1 - currentStep / steps;
      const stepVolume = startVolume * fraction;
      
      if (this.mainGain && this.ctx) {
        this.mainGain.gain.setValueAtTime(stepVolume, this.ctx.currentTime);
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        this.pause();
        if (this.mainGain && this.ctx) {
          this.mainGain.gain.setValueAtTime(this.userMute ? 0 : this.currentVolume, this.ctx.currentTime);
        }
        onComplete();
      }
    }, intervalTime);
  }

  private applySoundCheckSettings() {
    if (!this.compressorNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.soundCheckEnabled) {
      this.compressorNode.threshold.setValueAtTime(-24, now);
      this.compressorNode.knee.setValueAtTime(30, now);
      this.compressorNode.ratio.setValueAtTime(3, now);
      this.compressorNode.attack.setValueAtTime(0.1, now);
      this.compressorNode.release.setValueAtTime(0.25, now);
    } else {
      this.compressorNode.threshold.setValueAtTime(0, now);
      this.compressorNode.knee.setValueAtTime(0, now);
      this.compressorNode.ratio.setValueAtTime(1, now);
      this.compressorNode.attack.setValueAtTime(0.003, now);
      this.compressorNode.release.setValueAtTime(0.25, now);
    }
  }

  public setSoundCheck(enabled: boolean) {
    this.soundCheckEnabled = enabled;
    this.applySoundCheckSettings();
  }

  public isSoundCheckEnabled(): boolean {
    return this.soundCheckEnabled;
  }
}

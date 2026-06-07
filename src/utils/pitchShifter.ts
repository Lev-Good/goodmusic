export class PitchShifter {
  private ctx: AudioContext;
  public node: ScriptProcessorNode;
  private pitch: number = 0; // pitch shift in semitones (-6 to +6)
  
  // DSP parameters
  private delayTime: number = 0.04; // 40ms max delay is perfect to prevent echo/flange
  private bufferSize: number = 2048; // Smaller buffer size reduces latency
  
  // State for delay modulation
  private writePointer: number = 0;
  private delayBufferL: Float32Array;
  private delayBufferR: Float32Array;
  private bufferLength: number;
  
  private phase1: number = 0;
  
  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.node = ctx.createScriptProcessor(this.bufferSize, 2, 2);
    
    // Allocate 2 seconds buffer
    this.bufferLength = Math.floor(ctx.sampleRate * 2.0);
    this.delayBufferL = new Float32Array(this.bufferLength);
    this.delayBufferR = new Float32Array(this.bufferLength);
    
    this.node.onaudioprocess = (e) => {
      this.process(e);
    };
  }
  
  public setPitch(semitones: number) {
    this.pitch = Math.max(-6, Math.min(6, semitones));
  }
  
  private process(e: AudioProcessingEvent) {
    const inputL = e.inputBuffer.getChannelData(0);
    const inputR = e.inputBuffer.getChannelData(1);
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);
    
    // If pitch is 0, bypass processing
    if (this.pitch === 0) {
      outputL.set(inputL);
      outputR.set(inputR);
      return;
    }
    
    // Pitch factor: factor = 2^(semitones / 12)
    const factor = Math.pow(2, this.pitch / 12);
    
    // Speed rate of delay modulation: rate = 1 - factor
    const rate = 1.0 - factor;
    
    const maxDelaySamples = Math.floor(this.delayTime * this.ctx.sampleRate);
    
    for (let i = 0; i < inputL.length; i++) {
      // Write to delay buffer
      this.delayBufferL[this.writePointer] = inputL[i];
      this.delayBufferR[this.writePointer] = inputR[i];
      
      // Calculate delay times for the two modulated delay lines
      // Modulated by sawtooth wave from 0 to maxDelaySamples
      const d1 = this.phase1 * maxDelaySamples;
      const d2 = ((this.phase1 + 0.5) % 1.0) * maxDelaySamples;
      
      // Read pointers
      let r1 = this.writePointer - Math.floor(d1);
      if (r1 < 0) r1 += this.bufferLength;
      
      let r2 = this.writePointer - Math.floor(d2);
      if (r2 < 0) r2 += this.bufferLength;
      
      // Linear crossfade window based on phase (crossfade at boundary)
      const x = this.phase1;
      const gain1 = 0.5 * (1.0 + Math.cos(2.0 * Math.PI * x));
      const gain2 = 1.0 - gain1;
      
      // Output mix
      outputL[i] = (this.delayBufferL[r1] * Math.sqrt(gain1)) + (this.delayBufferL[r2] * Math.sqrt(gain2));
      outputR[i] = (this.delayBufferR[r1] * Math.sqrt(gain1)) + (this.delayBufferR[r2] * Math.sqrt(gain2));
      
      // Update write pointer
      this.writePointer = (this.writePointer + 1) % this.bufferLength;
      
      // Update phase
      this.phase1 += rate / maxDelaySamples;
      if (this.phase1 < 0) {
        this.phase1 += 1.0;
      } else if (this.phase1 >= 1.0) {
        this.phase1 -= 1.0;
      }
    }
  }
}

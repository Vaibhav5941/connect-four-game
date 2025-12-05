// Sound effects utility
class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.5;
    this.initSounds();
  }

  initSounds() {
    // Create audio contexts for different sounds
    // Using Web Audio API for programmatic sound generation
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported, sounds disabled');
      this.enabled = false;
    }
  }

  playTone(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playMove() {
    // Drop sound - descending tone
    this.playTone(400, 0.1, 'sine');
    setTimeout(() => this.playTone(300, 0.1, 'sine'), 50);
  }

  playWin() {
    // Victory fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine'), i * 150);
    });
  }

  playError() {
    // Error buzz
    this.playTone(200, 0.2, 'sawtooth');
  }

  playJoin() {
    // Join notification
    this.playTone(600, 0.15, 'sine');
    setTimeout(() => this.playTone(800, 0.15, 'sine'), 100);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }
}

export default new SoundManager();


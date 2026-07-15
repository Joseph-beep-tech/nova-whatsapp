let ctx: AudioContext | null = null;

/** Two-tone chime synthesized via Web Audio — no binary asset to source/license. */
export function playAlertSound() {
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // Autoplay blocked or AudioContext unsupported — toast still shows silently.
  }
}

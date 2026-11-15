/** WebAudio alert tone. Sound is OFF by default and always opt-in. */
let context: AudioContext | null = null;

export function playAlertTone(kind: 'confirmed' | 'suspected' = 'confirmed') {
  if (typeof window === 'undefined') return;
  try {
    context = context ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const tones = kind === 'confirmed' ? [880, 660] : [620];
    tones.forEach((freq, index) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      osc.connect(gain).connect(context!.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {
    // Audio is a non-critical enhancement; ignore autoplay/browser failures.
  }
}

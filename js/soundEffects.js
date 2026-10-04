/**
 * Transcribble - Sound Effects Engine
 * Synthesizes procedural Web Audio API sound effects (no external mp3 assets required)
 */

(function() {
  let audioCtx = null;
  let isSoundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Resume AudioContext on first user interaction to satisfy browser autoplay policies
  const unlockAudio = () => {
    initAudio();
  };
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });

  function playSound(type) {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      if (type === 'buzzer') {
        // Taboo Violation Buzzer
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(140, now);
        osc2.frequency.setValueAtTime(146, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
      } else if (type === 'win') {
        // 4-tone victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.2, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.4);
        });
      } else if (type === 'tick') {
        // Countdown clock tick
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'round_start') {
        // Notification chime
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Bind to sound toggle button
  document.addEventListener('DOMContentLoaded', () => {
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggleBtn.textContent = isSoundEnabled ? '🔊' : '🔇';
        soundToggleBtn.title = isSoundEnabled ? 'Mute Sound Effects' : 'Unmute Sound Effects';
        if (isSoundEnabled) playSound('round_start');
      });
    }
  });

  // Export to global scope
  window.initAudio = initAudio;
  window.playSound = playSound;
  window.isSoundEnabled = () => isSoundEnabled;
  window.setSoundEnabled = (val) => { isSoundEnabled = Boolean(val); };
})();

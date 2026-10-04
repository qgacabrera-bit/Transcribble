/**
 * Transcribble - Landing Scratchpad & Guide Carousel
 * Interactive client-side desk doodling canvas & swipeable information guide
 */

(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. Client-Side Interactive Background Doodle Canvas (Zero Server Cost)
    // =========================================================================
    const bgCanvas = document.getElementById('bgDoodleCanvas');
    const btnClearBgDoodle = document.getElementById('btnClearBgDoodle');
    const landingOverlay = document.getElementById('landingOverlay');

    if (bgCanvas) {
      const bgCtx = bgCanvas.getContext('2d');
      let isBgDrawing = false;
      let bgLastX = 0;
      let bgLastY = 0;

      function resizeBgCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = bgCanvas.getBoundingClientRect();
        const newWidth = Math.floor(rect.width * dpr);
        const newHeight = Math.floor(rect.height * dpr);

        if (bgCanvas.width === newWidth && bgCanvas.height === newHeight) return;

        let temp = null;
        if (bgCanvas.width > 0 && bgCanvas.height > 0) {
          temp = document.createElement('canvas');
          temp.width = bgCanvas.width;
          temp.height = bgCanvas.height;
          temp.getContext('2d').drawImage(bgCanvas, 0, 0);
        }

        bgCanvas.width = newWidth;
        bgCanvas.height = newHeight;

        bgCtx.scale(dpr, dpr);
        if (temp) {
          bgCtx.drawImage(temp, 0, 0, temp.width / dpr, temp.height / dpr);
        }
      }

      window.addEventListener('resize', resizeBgCanvas);
      setTimeout(resizeBgCanvas, 60);

      function getBgPointerPos(e) {
        const rect = bgCanvas.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }

      function drawBgSegment(x1, y1, x2, y2) {
        bgCtx.save();
        bgCtx.beginPath();
        bgCtx.moveTo(x1, y1);
        bgCtx.lineTo(x2, y2);
        bgCtx.strokeStyle = 'rgba(75, 75, 75, 0.72)';
        bgCtx.lineWidth = 2.8;
        bgCtx.lineCap = 'round';
        bgCtx.lineJoin = 'round';
        bgCtx.stroke();
        bgCtx.restore();
      }

      function drawBgDot(x, y) {
        bgCtx.save();
        bgCtx.beginPath();
        bgCtx.arc(x, y, 1.4, 0, Math.PI * 2);
        bgCtx.fillStyle = 'rgba(75, 75, 75, 0.72)';
        bgCtx.fill();
        bgCtx.restore();
      }

      bgCanvas.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        isBgDrawing = true;
        const pos = getBgPointerPos(e);
        bgLastX = pos.x;
        bgLastY = pos.y;
        drawBgDot(pos.x, pos.y);
        try { bgCanvas.setPointerCapture?.(e.pointerId); } catch (err) {}
      });

      bgCanvas.addEventListener('pointermove', (e) => {
        if (!isBgDrawing) return;
        const pos = getBgPointerPos(e);
        drawBgSegment(bgLastX, bgLastY, pos.x, pos.y);
        bgLastX = pos.x;
        bgLastY = pos.y;
      });

      const stopBgDrawing = (e) => {
        if (isBgDrawing) {
          isBgDrawing = false;
          try {
            if (e && e.pointerId) bgCanvas.releasePointerCapture?.(e.pointerId);
          } catch (err) {}
        }
      };

      bgCanvas.addEventListener('pointerup', stopBgDrawing);
      bgCanvas.addEventListener('pointercancel', stopBgDrawing);
      bgCanvas.addEventListener('pointerleave', stopBgDrawing);

      let isPeeling = false;

      function playPaperPeelSound() {
        if (typeof window.isSoundEnabled === 'function' && !window.isSoundEnabled()) return;
        try {
          const audioCtx = (typeof window.initAudio === 'function') ? window.initAudio() : null;
          if (!audioCtx) return;
          if (audioCtx.state === 'suspended') audioCtx.resume();

          const now = audioCtx.currentTime;
          const bufferSize = Math.floor(audioCtx.sampleRate * 0.32);
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.35;
          }

          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(600, now);
          filter.frequency.exponentialRampToValueAtTime(2800, now + 0.14);
          filter.frequency.exponentialRampToValueAtTime(350, now + 0.3);
          filter.Q.setValueAtTime(1.6, now);

          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);

          noise.start(now);
          noise.stop(now + 0.32);
        } catch (err) {}
      }

      function triggerPaperPeel() {
        if (isPeeling) return;
        isPeeling = true;

        try {
          playPaperPeelSound();
          const snapshot = bgCanvas.toDataURL();
          const peelSheet = document.createElement('div');
          peelSheet.className = 'paper-peel-sheet';

          const img = document.createElement('img');
          img.src = snapshot;
          img.alt = 'Peeling Page';
          peelSheet.appendChild(img);

          if (landingOverlay) {
            const directChild = landingOverlay.querySelector('.landing-main-layout') ||
                                landingOverlay.querySelector('.landing-content-wrap') ||
                                landingOverlay.firstElementChild;
            if (directChild && directChild.parentNode === landingOverlay) {
              landingOverlay.insertBefore(peelSheet, directChild);
            } else {
              landingOverlay.appendChild(peelSheet);
            }
          }

          const cleanupPeel = () => {
            if (peelSheet && peelSheet.parentNode) {
              peelSheet.parentNode.removeChild(peelSheet);
            }
            isPeeling = false;
          };

          peelSheet.addEventListener('animationend', cleanupPeel, { once: true });
          setTimeout(cleanupPeel, 750);
        } catch (err) {
          console.warn('Paper peel animation error:', err);
          isPeeling = false;
        } finally {
          bgCtx.save();
          bgCtx.setTransform(1, 0, 0, 1, 0, 0);
          bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
          bgCtx.restore();
        }

        if (typeof window.showToast === 'function') {
          window.showToast('Fresh paper sheet ready! 📄', 'info', '✨', 2200);
        }
      }

      if (btnClearBgDoodle) {
        btnClearBgDoodle.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerPaperPeel();
        });
      }
    }

    // =========================================================================
    // 2. Information Container Carousel & Dot Navigation
    // =========================================================================
    const infoCarouselTrack = document.getElementById('infoCarouselTrack');
    const carouselDots = document.querySelectorAll('.carousel-dot');
    const carouselPrevBtn = document.getElementById('carouselPrevBtn');
    const carouselNextBtn = document.getElementById('carouselNextBtn');
    const infoSlideIndicator = document.getElementById('infoSlideIndicator');
    let currentInfoSlide = 0;
    const totalInfoSlides = 3;

    function updateInfoSlide(index) {
      if (index < 0) index = totalInfoSlides - 1;
      if (index >= totalInfoSlides) index = 0;
      currentInfoSlide = index;

      if (infoCarouselTrack) {
        infoCarouselTrack.style.transform = `translateX(-${currentInfoSlide * 100}%)`;
      }

      if (infoSlideIndicator) {
        infoSlideIndicator.textContent = `Slide ${currentInfoSlide + 1} of ${totalInfoSlides}`;
      }

      carouselDots.forEach((dot, idx) => {
        const isActive = idx === currentInfoSlide;
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    carouselDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const targetIndex = parseInt(dot.getAttribute('data-slide-index'), 10);
        if (!isNaN(targetIndex)) {
          updateInfoSlide(targetIndex);
        }
      });
    });

    if (carouselPrevBtn) {
      carouselPrevBtn.addEventListener('click', () => {
        updateInfoSlide(currentInfoSlide - 1);
      });
    }

    if (carouselNextBtn) {
      carouselNextBtn.addEventListener('click', () => {
        updateInfoSlide(currentInfoSlide + 1);
      });
    }

    // Touch swipe support for the carousel
    if (infoCarouselTrack) {
      let touchStartX = 0;
      let touchEndX = 0;
      infoCarouselTrack.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      infoCarouselTrack.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) {
            updateInfoSlide(currentInfoSlide + 1);
          } else {
            updateInfoSlide(currentInfoSlide - 1);
          }
        }
      }, { passive: true });
    }

    // Game Mode Card Interactions (Landing Page)
    const lockedModeBtns = document.querySelectorAll('.mode-btn-locked');
    lockedModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof window.showToast === 'function') {
          window.showToast('This game mode is coming in an upcoming update! 🔒✨', 'info', '⏳', 2800);
        }
      });
    });

    const modeBtnClassic = document.getElementById('modeBtnClassic');
    if (modeBtnClassic) {
      modeBtnClassic.addEventListener('click', () => {
        if (typeof window.showToast === 'function') {
          window.showToast('Classic Mode selected: 1 Blind Drawer + Clue Describers 🎨', 'info', '✅', 2200);
        }
      });
    }
  });
})();

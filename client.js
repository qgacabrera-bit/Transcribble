/**
 * Transcribble - Reverse Drawing & Voice Party Game Engine
 * Role Reversal: Drawer is Blind Guesser; Describers have Forbidden Trap Words!
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. Socket.IO Connection & Core State
  // =========================================================================
  const socket = io();

  let currentUser = {
    id: null,
    username: 'Player',
    color: '#6366F1',
    score: 0,
    role: 'LOBBY'
  };

  let connectedUsers = [];
  let isSoundEnabled = true;

  // Drawing Canvas State
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;

  let currentTool = 'brush'; // 'brush' or 'eraser'
  let currentColor = '#1E1E1E';
  let currentSize = 10;
  let isDrawing = false;
  let hasMoved = false;
  let lastX = 0;
  let lastY = 0;
  let canDraw = true; // Determined by user role

  // Game Loop State
  let gameMode = 'LOBBY';
  let myRole = 'LOBBY'; // 'DRAWER' or 'DESCRIBER' or 'LOBBY'
  let currentRound = 1;
  let totalRounds = 3;
  let timeLeft = 0;
  let totalTime = 80;

  // =========================================================================
  // 2. DOM Elements
  // =========================================================================
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const canvasContainer = document.getElementById('canvasContainer');
  const canvasCursor = document.getElementById('canvasCursor');
  const wipeOverlay = document.getElementById('wipeOverlay');
  const tabooFlashOverlay = document.getElementById('tabooFlashOverlay');

  // Game Header & Navigation
  const roundPill = document.getElementById('roundPill');
  const gameTimerPill = document.getElementById('gameTimerPill');
  const timerDigits = document.getElementById('timerDigits');
  const timerProgress = document.getElementById('timerProgress');
  const wordLabel = document.getElementById('wordLabel');
  const currentWordEl = document.getElementById('currentWord');
  const startGameBtn = document.getElementById('startGameBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');

  // Role Guidance Boards
  const tabooGuideCard = document.getElementById('tabooGuideCard');
  const tabooTargetWord = document.getElementById('tabooTargetWord');
  const tabooCategoryBadge = document.getElementById('tabooCategoryBadge');
  const tabooBannedChips = document.getElementById('tabooBannedChips');
  
  const drawerGuideCard = document.getElementById('drawerGuideCard');
  const drawerMysteryText = document.getElementById('drawerMysteryText');
  const drawerStatusChip = document.getElementById('drawerStatusChip');
  const guesserLockOverlay = document.getElementById('guesserLockOverlay');
  const lockTitle = document.getElementById('lockTitle');

  // Modals & Overlays
  const roundEndOverlay = document.getElementById('roundEndOverlay');
  const roundEndBadge = document.getElementById('roundEndBadge');
  const roundEndWord = document.getElementById('roundEndWord');
  const roundEndSubtext = document.getElementById('roundEndSubtext');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const podiumContainer = document.getElementById('podiumContainer');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // Toolbar Elements
  const artToolbar = document.getElementById('artToolbar');
  const brushToolBtn = document.getElementById('brushToolBtn');
  const eraserToolBtn = document.getElementById('eraserToolBtn');
  const sizeButtons = document.querySelectorAll('.size-btn');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorInput = document.getElementById('customColorInput');
  const clearCanvasBtn = document.getElementById('clearCanvasBtn');
  const downloadCanvasBtn = document.getElementById('downloadCanvasBtn');

  // Preview elements
  const toolPreviewDot = document.getElementById('toolPreviewDot');
  const toolPreviewText = document.getElementById('toolPreviewText');

  // Chat, Mic & Lobby Elements
  const toastContainer = document.getElementById('toastContainer');
  const micToggleBtn = document.getElementById('micToggleBtn');
  const micLabel = document.getElementById('micLabel');
  const describerBurstBtn = document.getElementById('describerBurstBtn');
  const burstCountdownPill = document.getElementById('burstCountdownPill');
  const speakingIndicator = document.getElementById('speakingIndicator');
  const speakingText = document.getElementById('speakingText');
  const pttBtn = document.getElementById('pttBtn');
  const pttCountdownBadge = document.getElementById('pttCountdownBadge');
  const currentUserNameEl = document.getElementById('currentUserName');
  const userAvatarDotEl = document.getElementById('userAvatarDot');
  const editNameBtn = document.getElementById('editNameBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  const playerCountBadge = document.getElementById('playerCountBadge');
  const playersList = document.getElementById('playersList');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const roleHelpText = document.getElementById('roleHelpText');

  // Phase and Layout Elements
  const canvasSection = document.getElementById('canvasSection');
  const canvasTopBar = document.querySelector('.canvas-top-bar');

  // Landing Page & Multi-Room Elements
  const appContainer = document.getElementById('appContainer');
  const landingOverlay = document.getElementById('landingOverlay');
  const landingAlert = document.getElementById('landingAlert');
  const landingUsername = document.getElementById('landingUsername');
  const btnJoinRandom = document.getElementById('btnJoinRandom');
  const btnCreateCustom = document.getElementById('btnCreateCustom');
  const landingRoomCode = document.getElementById('landingRoomCode');
  const btnJoinCustom = document.getElementById('btnJoinCustom');
  const currentRoomCode = document.getElementById('currentRoomCode');
  const btnCopyRoomCode = document.getElementById('btnCopyRoomCode');
  const copyBtnLabel = document.getElementById('copyBtnLabel');
  const btnHomeNav = document.getElementById('btnHomeNav');
  const brandLogo = document.getElementById('brandLogo');
  let currentRoomId = null;
  let isRoomHost = false;
  let roomHostId = null;

  // Session Token for persistent reconnection & grace periods across tab refresh or network drops
  let sessionToken = null;
  try {
    sessionToken = sessionStorage.getItem('transcribble_session_token');
    if (!sessionToken) {
      sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('transcribble_session_token', sessionToken);
    }
  } catch (e) {
    sessionToken = 'sess_' + Date.now();
  }

  // Strict Role & Phase State Tracking
  let currentPhase = 'LOBBY'; // 'LOBBY' or 'PLAYING'
  let currentMicMode = 'OPEN_MIC'; // 'OPEN_MIC' or 'BURST_2S'

  /**
   * Floating Disappearing Toast Notification System
   * Keeps the chat window 100% exclusive for player chatting, clues, and guesses.
   */
  function showToast(text, type = 'info', icon = '🔔', duration = 3500) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${escapeHTML(text)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 320);
    }, duration);
  }

  // Server-triggered disappearing notification toasts
  socket.on('notification', (data) => {
    showToast(data.text, data.type || 'info', data.icon || '🔔', data.duration || 3500);
  });

  // =========================================================================
  // 2.1 Home Screen & Room Management (sessionStorage & Matchmaking UI)
  // =========================================================================

  // 0. Ensure Room Page has 0% visibility while Home Screen is active
  if (appContainer && landingOverlay && !landingOverlay.classList.contains('hidden')) {
    appContainer.style.visibility = 'hidden';
    appContainer.style.opacity = '0';
    appContainer.style.pointerEvents = 'none';
  }

  // 1. Prefill Username from sessionStorage
  try {
    const savedUsername = sessionStorage.getItem('transcribble_username');
    if (savedUsername && landingUsername) {
      landingUsername.value = savedUsername;
    }
  } catch (e) {}

  // 2. Prefill Room Code from URL query parameter (e.g. ?room=ABC12)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomQuery = urlParams.get('room');
    if (roomQuery && landingRoomCode) {
      landingRoomCode.value = roomQuery.trim().toUpperCase();
    }
  } catch (e) {}

  function showLandingError(msg) {
    if (!landingAlert) return;
    landingAlert.textContent = msg;
    landingAlert.style.display = 'block';
  }

  function hideLandingError() {
    if (!landingAlert) return;
    landingAlert.textContent = '';
    landingAlert.style.display = 'none';
  }

  function setLandingLoading(isLoading, actionText = '') {
    if (btnJoinRandom) btnJoinRandom.disabled = isLoading;
    if (btnCreateCustom) btnCreateCustom.disabled = isLoading;
    if (btnJoinCustom) btnJoinCustom.disabled = isLoading;
    if (landingUsername) landingUsername.disabled = isLoading;
    if (landingRoomCode) landingRoomCode.disabled = isLoading;

    if (isLoading && actionText) {
      showToast(actionText, 'info', '⏳', 2000);
    }
  }

  function getValidatedUsername() {
    if (!landingUsername) return 'Player';
    const name = landingUsername.value.trim();
    if (!name) {
      showLandingError('Please enter an Artist Nickname to play!');
      landingUsername.focus();
      return null;
    }
    hideLandingError();
    try {
      sessionStorage.setItem('transcribble_username', name);
    } catch (e) {}
    return name;
  }

  // Button: Join Random Match
  if (btnJoinRandom) {
    btnJoinRandom.addEventListener('click', () => {
      const username = getValidatedUsername();
      if (!username) return;
      setLandingLoading(true, 'Finding match...');
      socket.emit('join-random-match', { username, sessionToken });
    });
  }

  // Button: Create Custom Game
  if (btnCreateCustom) {
    btnCreateCustom.addEventListener('click', () => {
      const username = getValidatedUsername();
      if (!username) return;
      setLandingLoading(true, 'Creating custom room...');
      socket.emit('create-custom-game', { username, sessionToken });
    });
  }

  // Button: Join Custom Game via Room ID
  if (btnJoinCustom) {
    btnJoinCustom.addEventListener('click', () => {
      const username = getValidatedUsername();
      if (!username) return;
      const code = landingRoomCode ? landingRoomCode.value.trim().toUpperCase() : '';
      if (!code || code.length !== 5) {
        showLandingError('Please enter a valid 5-letter Room Code (e.g. ABC12)!');
        if (landingRoomCode) landingRoomCode.focus();
        return;
      }
      setLandingLoading(true, `Joining room ${code}...`);
      socket.emit('join-custom-game', { username, roomId: code, sessionToken });
    });
  }

  if (landingRoomCode) {
    landingRoomCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnJoinCustom) btnJoinCustom.click();
      }
    });
    landingRoomCode.addEventListener('input', () => {
      landingRoomCode.value = landingRoomCode.value.toUpperCase();
    });
  }

  if (landingUsername) {
    landingUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = landingRoomCode ? landingRoomCode.value.trim() : '';
        if (code && code.length === 5) {
          if (btnJoinCustom) btnJoinCustom.click();
        } else {
          if (btnJoinRandom) btnJoinRandom.click();
        }
      }
    });
  }

  // Copy Room Code to clipboard
  if (btnCopyRoomCode) {
    btnCopyRoomCode.addEventListener('click', async () => {
      if (!currentRoomId) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
      let copied = false;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch (e) {}
      }

      if (!copied) {
        const temp = document.createElement('input');
        temp.value = shareUrl;
        document.body.appendChild(temp);
        temp.select();
        try {
          document.execCommand('copy');
          copied = true;
        } catch (e) {}
        document.body.removeChild(temp);
      }

      btnCopyRoomCode.classList.add('copied');
      if (copyBtnLabel) copyBtnLabel.textContent = 'Copied! 🎉';
      showToast(`Room Link copied: ${shareUrl}`, 'success', '📋', 3500);

      setTimeout(() => {
        btnCopyRoomCode.classList.remove('copied');
        if (copyBtnLabel) copyBtnLabel.textContent = 'Copy ID';
      }, 2000);
    });
  }

  // Return to Home Screen (Landing Page)
  function returnToHomeScreen() {
    if (currentPhase === 'PLAYING') {
      if (!confirm('Leave current game and return to the Home Screen?')) {
        return;
      }
    }

    if (isRecordingAudio) {
      stopAudioCapture();
    }

    // Tell server socket has departed the room
    socket.emit('leave-room');

    currentRoomId = null;
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch (e) {}

    // Reveal landing overlay and hide room page
    if (landingOverlay) {
      landingOverlay.classList.remove('hidden');
    }
    if (appContainer) {
      appContainer.style.visibility = 'hidden';
      appContainer.style.opacity = '0';
      appContainer.style.pointerEvents = 'none';
    }

    // Reset room header badge
    if (currentRoomCode) {
      currentRoomCode.textContent = '-----';
    }

    // Reset game state to lobby defaults
    applySanitizedState({
      phase: 'LOBBY',
      subPhase: 'LOBBY',
      role: 'LOBBY',
      micMode: 'OPEN_MIC',
      canDraw: false,
      currentRound: 1,
      totalRounds: 3,
      timeLeft: 0,
      totalTime: 80
    });

    fillCanvasWhite();
    connectedUsers = [];
    renderPlayersList();

    showToast('Returned to Home Screen 👋', 'info', '🏠', 2500);
  }

  if (btnHomeNav) {
    btnHomeNav.addEventListener('click', returnToHomeScreen);
  }
  if (brandLogo) {
    brandLogo.addEventListener('click', () => {
      // Only navigate home if not already on the landing screen
      if (landingOverlay && !landingOverlay.classList.contains('hidden')) return;
      returnToHomeScreen();
    });
  }

  // =========================================================================
  // 2.2 Client-Side Interactive Background Doodle Canvas (Zero Server Cost)
  // =========================================================================
  const bgCanvas = document.getElementById('bgDoodleCanvas');
  const btnClearBgDoodle = document.getElementById('btnClearBgDoodle');

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
      if (!isSoundEnabled) return;
      try {
        initAudio();
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
        // 1. Play tactile paper rip sound
        playPaperPeelSound();

        // 2. Snapshot current doodle canvas before clearing
        const snapshot = bgCanvas.toDataURL();

        // 3. Create peeling sheet clone
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

        // 4. Clean up peeling sheet on animation completion (with fallback timer)
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
        // 5. Always wipe underlying real canvas so clean paper is immediately ready
        bgCtx.save();
        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.restore();
      }

      showToast('Fresh paper sheet ready! 📄', 'info', '✨', 2200);
    }

    if (btnClearBgDoodle) {
      btnClearBgDoodle.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerPaperPeel();
      });
    }
  }

  // =========================================================================
  // 2.3 Information Container Carousel & Dot Navigation
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

  // Touch swipe support for the carousel on mobile/tablet
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
      showToast('This game mode is coming in an upcoming update! 🔒✨', 'info', '⏳', 2800);
      playPencilSound();
    });
  });

  const modeBtnClassic = document.getElementById('modeBtnClassic');
  if (modeBtnClassic) {
    modeBtnClassic.addEventListener('click', () => {
      showToast('Classic Mode selected: 1 Blind Drawer + Clue Describers 🎨', 'info', '✅', 2200);
    });
  }

  // =========================================================================
  // 2.4 Privacy & Audio Safety Modal Controller
  // =========================================================================
  const btnPrivacyModalToggle = document.getElementById('btnPrivacyModalToggle');
  const privacyModalOverlay = document.getElementById('privacyModalOverlay');
  const btnClosePrivacyModal = document.getElementById('btnClosePrivacyModal');
  const btnPrivacyDone = document.getElementById('btnPrivacyDone');

  function openPrivacyModal() {
    if (privacyModalOverlay) {
      privacyModalOverlay.style.display = 'flex';
    }
  }

  function closePrivacyModal() {
    if (privacyModalOverlay) {
      privacyModalOverlay.style.display = 'none';
    }
  }

  if (btnPrivacyModalToggle) {
    btnPrivacyModalToggle.addEventListener('click', openPrivacyModal);
  }
  if (btnClosePrivacyModal) {
    btnClosePrivacyModal.addEventListener('click', closePrivacyModal);
  }
  if (btnPrivacyDone) {
    btnPrivacyDone.addEventListener('click', closePrivacyModal);
  }
  if (privacyModalOverlay) {
    privacyModalOverlay.addEventListener('click', (e) => {
      if (e.target === privacyModalOverlay) {
        closePrivacyModal();
      }
    });
  }

  // Initialize Canvas
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  fillCanvasWhite();

  function fillCanvasWhite() {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  // =========================================================================
  // 3. Web Audio API Synthesizer (Taboo Buzzer, Chimes & Fanfare)
  // =========================================================================
  let audioCtx = null;

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
        // Harsh Taboo Penalty Buzzer!
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(140, now);
        osc2.frequency.setValueAtTime(146, now); // dissonance

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
        // Triumphant 4-tone victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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
        // Countdown click
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

  soundToggleBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    soundToggleBtn.textContent = isSoundEnabled ? '🔊' : '🔇';
    soundToggleBtn.title = isSoundEnabled ? 'Mute Sound Effects' : 'Unmute Sound Effects';
    if (isSoundEnabled) playSound('round_start');
  });

  // =========================================================================
  // 3.1. Real-Time Microphone Capture (MediaRecorder 250ms) & Playback Queue
  // =========================================================================
  let mediaStream = null;
  let mediaRecorder = null;
  let isRecordingAudio = false;
  let nextAudioScheduleTime = 0;
  let speakingTimeout = null;
  const senderHeaders = new Map();

  async function getMicrophoneStream() {
    if (mediaStream && mediaStream.active) return mediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      return mediaStream;
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      showToast('⚠️ Microphone access denied or not available.', 'warning', '🎙️', 4000);
      return null;
    }
  }

  function startAudioCapture() {
    // If in 2-second burst mode (Describer during PLAYING phase), redirect to burst recorder
    if (currentMicMode === 'BURST_2S') {
      startDescriberBurst();
      return;
    }

    if (isRecordingAudio) return;

    getMicrophoneStream().then((stream) => {
      if (!stream) return;

      try {
        let options = {};
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
          } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            options = { mimeType: 'audio/ogg;codecs=opus' };
          }
        }

        mediaRecorder = new MediaRecorder(stream, options);
        let chunkIndex = 0;

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) {
            const arrayBuffer = await e.data.arrayBuffer();
            // Emit raw audio chunks every 250 milliseconds to Socket.io server
            socket.emit('audio-chunk', {
              chunk: arrayBuffer,
              isFirst: (chunkIndex === 0),
              mimeType: mediaRecorder.mimeType
            });
            chunkIndex++;
          }
        };

        // Capture audio chunks every 250 milliseconds
        mediaRecorder.start(250);
        isRecordingAudio = true;
        setMicLiveState(true);
      } catch (err) {
        console.error('MediaRecorder start error:', err);
        showToast('⚠️ Could not start microphone recording.', 'danger', '🎙️', 3000);
      }
    });
  }

  function stopAudioCapture() {
    if (!isRecordingAudio || !mediaRecorder) return;
    try {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    } catch (err) {}
    isRecordingAudio = false;
    setMicLiveState(false);
  }

  function setMicLiveState(isLive) {
    if (micToggleBtn) {
      if (isLive) {
        micToggleBtn.classList.add('active');
        if (micLabel) micLabel.textContent = 'Mic: LIVE';
      } else {
        micToggleBtn.classList.remove('active');
        if (micLabel) micLabel.textContent = 'Mic: Off';
      }
    }
  }

  // =========================================================================
  // 3.2. Describer Strict 2-Second "Hold to Speak" Burst Mode ('stt-audio-burst')
  // =========================================================================
  let burstRecorder = null;
  let isBurstRecording = false;
  let burstTimeout = null;
  let burstInterval = null;
  let burstStartTime = 0;
  let burstChunks = [];
  const MAX_BURST_MS = 2000; // Strict 2-second maximum limit

  async function startDescriberBurst() {
    if (isBurstRecording) return;
    initAudio();

    const stream = await getMicrophoneStream();
    if (!stream) return;

    try {
      burstChunks = [];
      let options = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        }
      }

      burstRecorder = new MediaRecorder(stream, options);

      burstRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          burstChunks.push(e.data);
        }
      };

      burstRecorder.onstop = async () => {
        const actualDuration = Date.now() - burstStartTime;
        if (actualDuration < 300) {
          showToast('⚠️ Too quick! Hold the button while speaking your clue.', 'warning', '🎙️', 2500);
          resetBurstUi();
          return;
        }
        if (burstChunks.length > 0) {
          const mime = burstRecorder.mimeType || 'audio/webm';
          const blob = new Blob(burstChunks, { type: mime });
          const arrayBuffer = await blob.arrayBuffer();

          // Finalize and emit audio blob via specific 'stt-audio-burst' event
          socket.emit('stt-audio-burst', {
            audio: arrayBuffer,
            durationMs: Math.min(actualDuration, MAX_BURST_MS),
            mimeType: mime
          });

          showToast(`🎙️ Voice clue sent! (${(actualDuration / 1000).toFixed(1)}s)`, 'success', '🚀', 2200);
        }
        resetBurstUi();
      };

      burstRecorder.start();
      burstStartTime = Date.now();
      isBurstRecording = true;
      setBurstUiActive(true);

      // Strict 2-second maximum recording limit
      burstTimeout = setTimeout(() => {
        stopDescriberBurst();
      }, MAX_BURST_MS);

      // Smooth visual countdown (2.0s -> 0.0s)
      burstInterval = setInterval(() => {
        const elapsed = Date.now() - burstStartTime;
        const remaining = Math.max(0, (MAX_BURST_MS - elapsed) / 1000);
        updateBurstCountdown(remaining);
      }, 50);

    } catch (err) {
      console.error('Burst recorder start error:', err);
      resetBurstUi();
    }
  }

  function stopDescriberBurst() {
    if (!isBurstRecording) return;
    isBurstRecording = false;

    clearTimeout(burstTimeout);
    clearInterval(burstInterval);

    if (burstRecorder && burstRecorder.state !== 'inactive') {
      try {
        burstRecorder.stop();
      } catch (e) {}
    }
  }

  function setBurstUiActive(active) {
    if (describerBurstBtn) {
      if (active) describerBurstBtn.classList.add('recording');
      else describerBurstBtn.classList.remove('recording');
    }
    if (pttBtn) {
      if (active) pttBtn.classList.add('recording');
      else pttBtn.classList.remove('recording');
    }
  }

  function updateBurstCountdown(remainingSec) {
    const text = `${remainingSec.toFixed(1)}s`;
    if (burstCountdownPill) burstCountdownPill.textContent = text;
    if (pttCountdownBadge) pttCountdownBadge.textContent = text;
  }

  function resetBurstUi() {
    setBurstUiActive(false);
    if (burstCountdownPill) burstCountdownPill.textContent = '2.0s';
    if (pttCountdownBadge) pttCountdownBadge.textContent = '2.0s';
  }

  // Describer Burst Button Event Handlers
  if (describerBurstBtn) {
    describerBurstBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDescriberBurst();
    });
    describerBurstBtn.addEventListener('mouseup', () => stopDescriberBurst());
    describerBurstBtn.addEventListener('mouseleave', () => stopDescriberBurst());

    describerBurstBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDescriberBurst();
    }, { passive: false });
    describerBurstBtn.addEventListener('touchend', () => stopDescriberBurst());
  }

  // Push to Talk & Mic Toggle Event Handlers
  if (micToggleBtn) {
    micToggleBtn.addEventListener('click', () => {
      initAudio();
      if (isRecordingAudio) {
        stopAudioCapture();
      } else {
        startAudioCapture();
      }
    });
  }

  if (pttBtn) {
    pttBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      initAudio();
      if (currentMicMode === 'BURST_2S') {
        startDescriberBurst();
      } else {
        startAudioCapture();
      }
    });
    pttBtn.addEventListener('mouseup', () => {
      if (currentMicMode === 'BURST_2S') stopDescriberBurst();
      else stopAudioCapture();
    });
    pttBtn.addEventListener('mouseleave', () => {
      if (currentMicMode === 'BURST_2S') stopDescriberBurst();
      else stopAudioCapture();
    });

    pttBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      initAudio();
      if (currentMicMode === 'BURST_2S') {
        startDescriberBurst();
      } else {
        startAudioCapture();
      }
    }, { passive: false });
    pttBtn.addEventListener('touchend', () => {
      if (currentMicMode === 'BURST_2S') stopDescriberBurst();
      else stopAudioCapture();
    });
  }

  // Global Spacebar Push-To-Talk / Burst (when chat input is not focused)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && document.activeElement !== chatInput) {
      e.preventDefault();
      initAudio();
      if (currentMicMode === 'BURST_2S') {
        startDescriberBurst();
      } else if (currentMicMode === 'OPEN_MIC') {
        startAudioCapture();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && document.activeElement !== chatInput) {
      e.preventDefault();
      if (currentMicMode === 'BURST_2S') {
        stopDescriberBurst();
      } else if (currentMicMode === 'OPEN_MIC') {
        stopAudioCapture();
      }
    }
  });

  // Client-Side Continuous Audio Playback ('audio-chunk')
  socket.on('audio-chunk', async (data) => {
    if (!data || data.senderId === socket.id) return;
    showSpeakingIndicator(data.username || 'Player');
    await playIncomingAudioChunk(data);
  });

  // Client-Side 2-Second Clue Burst Playback ('stt-audio-burst')
  socket.on('stt-audio-burst', async (data) => {
    if (!data || data.senderId === socket.id) return;
    showSpeakingIndicator(`${data.senderName || 'Describer'} (2s Clue)`);
    await playAudioBurst(data.audio, data.mimeType);
  });

  let lastAudioBurstTime = 0;

  async function playAudioBurst(audioData, mimeType) {
    if (!audioData) return;
    const now = Date.now();
    if (now - lastAudioBurstTime < 600) return; // Prevent double-playing identical burst
    lastAudioBurstTime = now;

    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      let rawBuffer = (audioData instanceof ArrayBuffer)
        ? audioData.slice(0)
        : (audioData.buffer ? audioData.buffer.slice(0) : await new Blob([audioData]).arrayBuffer());

      audioCtx.decodeAudioData(rawBuffer.slice(0), (audioBuffer) => {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(audioCtx.currentTime);
      }, (err) => {
        // Fallback to HTML5 audio element
        try {
          const blob = new Blob([rawBuffer], { type: mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play().then(() => {
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          }).catch(() => {});
        } catch (e) {}
      });
    } catch (err) {
      console.warn('Audio burst playback error:', err);
    }
  }

  function showSpeakingIndicator(username) {
    if (!speakingIndicator) return;
    if (speakingText) speakingText.textContent = `${username} is speaking...`;
    speakingIndicator.style.display = 'inline-flex';

    clearTimeout(speakingTimeout);
    speakingTimeout = setTimeout(() => {
      speakingIndicator.style.display = 'none';
    }, 1200);
  }

  function combineArrayBuffers(bufA, bufB) {
    const tmp = new Uint8Array(bufA.byteLength + bufB.byteLength);
    tmp.set(new Uint8Array(bufA), 0);
    tmp.set(new Uint8Array(bufB), bufA.byteLength);
    return tmp.buffer;
  }

  async function playIncomingAudioChunk(data) {
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      let rawBuffer = (data.chunk instanceof ArrayBuffer)
        ? data.chunk.slice(0)
        : (data.chunk.buffer ? data.chunk.buffer.slice(0) : await new Blob([data.chunk]).arrayBuffer());

      if (data.isFirst) {
        senderHeaders.set(data.senderId, rawBuffer.slice(0));
      }

      const scheduleBuffer = (audioBuffer) => {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        const startTime = Math.max(now, nextAudioScheduleTime);
        source.start(startTime);
        nextAudioScheduleTime = startTime + audioBuffer.duration;
      };

      // Decode with Web Audio API
      audioCtx.decodeAudioData(rawBuffer.slice(0), (audioBuffer) => {
        scheduleBuffer(audioBuffer);
      }, (err) => {
        const header = senderHeaders.get(data.senderId);
        if (header) {
          const combined = combineArrayBuffers(header, rawBuffer);
          audioCtx.decodeAudioData(combined, (audioBuffer) => {
            scheduleBuffer(audioBuffer);
          }, () => {
            playViaAudioElement(rawBuffer, data.mimeType);
          });
        } else {
          playViaAudioElement(rawBuffer, data.mimeType);
        }
      });
    } catch (err) {
      console.warn('Audio decode queue error:', err);
    }
  }

  function playViaAudioElement(buffer, mimeType) {
    try {
      const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().then(() => {
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }).catch(() => {});
    } catch (e) {}
  }

  // =========================================================================
  // 4. Real-Time Drawing Mechanics
  // =========================================================================

  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const rawX = (event.clientX - rect.left) * scaleX;
    const rawY = (event.clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH, rawX)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, rawY))
    };
  }

  function drawLineSegment(prevX, prevY, currX, currY, color, size, isEraser) {
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;

    if (isEraser) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }

    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    ctx.restore();
  }

  function drawDot(x, y, color, size, isEraser) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);

    if (isEraser) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = color;
    }

    ctx.fill();
    ctx.restore();
  }

  // Pointer Events handling
  canvas.addEventListener('pointerdown', (e) => {
    if (!canDraw) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDrawing = true;
    hasMoved = false;

    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;

    const isEraser = (currentTool === 'eraser');
    drawDot(lastX, lastY, currentColor, currentSize, isEraser);

    socket.emit('draw-dot', {
      x: Math.round(lastX),
      y: Math.round(lastY),
      color: currentColor,
      size: currentSize,
      isEraser: isEraser
    });
  });

  canvas.addEventListener('pointermove', (e) => {
    updateCursorPreview(e);
    if (!isDrawing || !canDraw) return;

    const coords = getCanvasCoords(e);
    const currX = coords.x;
    const currY = coords.y;

    const dist = Math.hypot(currX - lastX, currY - lastY);
    if (dist < 1) return;

    hasMoved = true;
    const isEraser = (currentTool === 'eraser');

    // Local render with zero latency
    drawLineSegment(lastX, lastY, currX, currY, currentColor, currentSize, isEraser);

    // Broadcast stroke to server
    socket.emit('draw-stroke', {
      prevX: Math.round(lastX),
      prevY: Math.round(lastY),
      currX: Math.round(currX),
      currY: Math.round(currY),
      color: currentColor,
      size: currentSize,
      isEraser: isEraser
    });

    lastX = currX;
    lastY = currY;
  });

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    if (e && e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  }

  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);
  canvas.addEventListener('pointerleave', () => {
    canvasCursor.style.display = 'none';
  });
  canvas.addEventListener('pointerenter', () => {
    if (canDraw) canvasCursor.style.display = 'block';
  });

  function updateCursorPreview(e) {
    if (!canDraw) {
      canvasCursor.style.display = 'none';
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      canvasCursor.style.display = 'none';
      return;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    canvasCursor.style.display = 'block';
    canvasCursor.style.left = `${x}px`;
    canvasCursor.style.top = `${y}px`;

    const scale = (rect.width / CANVAS_WIDTH + rect.height / CANVAS_HEIGHT) / 2;
    const visualSize = Math.max(currentSize * scale, 6);
    canvasCursor.style.width = `${visualSize}px`;
    canvasCursor.style.height = `${visualSize}px`;

    if (currentTool === 'eraser') {
      canvasCursor.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
      canvasCursor.style.borderColor = '#000000';
    } else {
      canvasCursor.style.backgroundColor = currentColor;
      canvasCursor.style.borderColor = (currentColor.toUpperCase() === '#FFFFFF') ? '#000000' : 'rgba(0, 0, 0, 0.8)';
    }
  }

  // =========================================================================
  // 5. Coloring Materials & Toolbar Controls
  // =========================================================================
  brushToolBtn.addEventListener('click', () => setTool('brush'));
  eraserToolBtn.addEventListener('click', () => setTool('eraser'));

  function setTool(tool) {
    currentTool = tool;
    if (tool === 'brush') {
      brushToolBtn.classList.add('active');
      eraserToolBtn.classList.remove('active');
      updateToolPreview();
    } else {
      eraserToolBtn.classList.add('active');
      brushToolBtn.classList.remove('active');
      toolPreviewDot.style.background = '#FFFFFF';
      toolPreviewDot.style.borderColor = '#000000';
      if (toolPreviewText) toolPreviewText.textContent = 'Eraser';
    }
  }

  sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize = parseInt(btn.dataset.size, 10);
      updateToolPreview();
    });
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      currentColor = swatch.dataset.color;
      if (currentTool === 'eraser') {
        setTool('brush');
      } else {
        updateToolPreview();
      }
    });
  });

  customColorInput.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorSwatches.forEach(s => s.classList.remove('active'));
    customColorInput.parentElement.classList.add('active');

    if (currentTool === 'eraser') {
      setTool('brush');
    } else {
      updateToolPreview();
    }
  });

  function updateToolPreview() {
    if (currentTool === 'brush') {
      toolPreviewDot.style.background = currentColor;
      toolPreviewDot.style.borderColor = (currentColor.toUpperCase() === '#FFFFFF') ? '#000000' : 'rgba(0, 0, 0, 0.8)';
      if (toolPreviewText) toolPreviewText.textContent = 'Brush';
    } else {
      toolPreviewDot.style.background = '#FFFFFF';
      toolPreviewDot.style.borderColor = '#000000';
      if (toolPreviewText) toolPreviewText.textContent = 'Eraser';
    }
  }

  clearCanvasBtn.addEventListener('click', () => {
    if (!canDraw) return;
    if (confirm('Are you sure you want to clear the canvas for all players?')) {
      socket.emit('clear-canvas');
    }
  });

  downloadCanvasBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `transcribble-art-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  function triggerWipeAnimation() {
    wipeOverlay.classList.add('active');
    setTimeout(() => {
      wipeOverlay.classList.remove('active');
    }, 350);
  }

  function triggerTabooFlash() {
    tabooFlashOverlay.classList.add('active');
    setTimeout(() => {
      tabooFlashOverlay.classList.remove('active');
    }, 250);
  }

  // =========================================================================
  // 6. Reverse Pictionary & Taboo Role Transitions & Sanitized State Sync
  // =========================================================================

  /**
   * Role-Based UI Rendering & Sanitized State Application:
   * - Phase == LOBBY: Shows lobby chat, connected players, open mic toggle; hides canvas.
   * - Phase == PLAYING & Role == DRAWER: Renders canvas with full drawing tools enabled,
   *   target/banned words completely hidden, open mic toggle active.
   * - Phase == PLAYING & Role == DESCRIBER: Disables canvas (read-only), displays target
   *   and banned words prominently, replaces open mic with 2-second "Hold to Speak" button.
   */
  function applySanitizedState(state) {
    if (!state) return;

    currentPhase = state.phase || 'LOBBY';
    gameMode = state.subPhase || state.phase;
    myRole = state.role || 'LOBBY';
    currentMicMode = state.micMode || 'OPEN_MIC';
    canDraw = Boolean(state.canDraw);
    currentRound = state.currentRound || 1;
    totalRounds = state.totalRounds || 3;
    timeLeft = (typeof state.timeLeft === 'number') ? state.timeLeft : 0;
    totalTime = (typeof state.totalTime === 'number') ? state.totalTime : 80;

    if (typeof state.isHost === 'boolean') isRoomHost = state.isHost;
    if (state.hostId) roomHostId = state.hostId;

    // --- 1. PHASE == LOBBY (FREE DRAWING BEFORE GAME STARTS) ---
    if (state.phase === 'LOBBY') {
      if (canvasContainer) canvasContainer.style.display = 'block';
      if (canvasTopBar) canvasTopBar.style.display = 'flex';
      if (artToolbar) {
        artToolbar.style.display = 'flex';
        artToolbar.classList.remove('disabled');
      }
      if (tabooGuideCard) tabooGuideCard.style.display = 'none';
      if (drawerGuideCard) drawerGuideCard.style.display = 'none';
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active');

      canDraw = true; // Free drawing enabled for all players before game starts!

      roundPill.textContent = 'LOBBY';
      roundPill.style.display = 'inline-flex';
      gameTimerPill.style.display = 'none';
      wordLabel.textContent = 'Prompt:';
      currentWordEl.textContent = '🎨 Free Draw Mode';

      if (drawerStatusChip) {
        drawerStatusChip.style.display = 'none';
      }

      if (isRoomHost) {
        startGameBtn.textContent = '▶ Start Game';
        startGameBtn.className = 'btn-primary-action';
        startGameBtn.style.display = 'inline-flex';
        startGameBtn.disabled = false;
        startGameBtn.title = 'Start Game (min 2 players)';
      } else {
        startGameBtn.textContent = '👑 Waiting for Host...';
        startGameBtn.className = 'btn-primary-action waiting-host';
        startGameBtn.style.display = 'inline-flex';
        startGameBtn.disabled = true;
        startGameBtn.title = 'Only the room host can start the game';
      }

      // Open mic toggle active for all players in Lobby
      if (micToggleBtn) micToggleBtn.style.display = 'inline-flex';
      if (describerBurstBtn) describerBurstBtn.style.display = 'none';

      chatInput.placeholder = 'Chat with players in lobby...';
      roleHelpText.textContent = '🎨 Free Draw Mode: Doodle together & chat freely before starting the game!';
      return;
    }

    // --- 2. PHASE == PLAYING ---
    if (canvasContainer) canvasContainer.style.display = 'block';
    if (canvasTopBar) canvasTopBar.style.display = 'flex';

    roundPill.style.display = 'inline-flex';
    roundPill.textContent = `ROUND ${currentRound}/${totalRounds}`;
    gameTimerPill.style.display = 'flex';
    timerDigits.textContent = `${timeLeft}s`;

    if (isRoomHost) {
      startGameBtn.textContent = '⏹ End Game';
      startGameBtn.className = 'btn-primary-action danger';
      startGameBtn.style.display = 'inline-flex';
      startGameBtn.disabled = false;
      startGameBtn.title = 'End match and return room to lobby';
    } else {
      startGameBtn.style.display = 'none';
    }

    // A. Role == DRAWER (Blind Drawer & Guesser)
    if (state.role === 'DRAWER') {
      canDraw = true;
      if (artToolbar) {
        artToolbar.style.display = 'flex';
        artToolbar.classList.remove('disabled');
      }
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active');

      // STRICT PRIVACY: Taboo card is completely hidden (target and banned words are null)
      if (tabooGuideCard) tabooGuideCard.style.display = 'none';

      // Show Drawer Guide Card with word hint blanks
      if (drawerGuideCard) {
        drawerGuideCard.style.display = 'flex';
        drawerMysteryText.textContent = `Mystery Word: ${state.wordHint || '_____'} (${state.letterCount || 0} letters) • Category: ${state.category || 'Secret'}`;
      }

      drawerStatusChip.textContent = `🎨 YOU ARE THE BLIND DRAWER! Draw & Guess!`;
      drawerStatusChip.className = 'drawer-status-chip is-drawing';

      wordLabel.textContent = 'Category:';
      currentWordEl.textContent = `${state.category || 'Secret'} (${state.letterCount || 0} letters)`;

      // Mic Mode: Drawer keeps open continuous mic to think out loud!
      if (micToggleBtn) micToggleBtn.style.display = 'inline-flex';
      if (describerBurstBtn) describerBurstBtn.style.display = 'none';

      chatInput.placeholder = 'Type your guess here (e.g. Is it an Apple?)...';
      roleHelpText.textContent = '🎯 YOU ARE THE DRAWER: Sketch what clues describe, and type your guesses!';
    }
    // B. Role == DESCRIBER (With Taboo Forbidden Words)
    else if (state.role === 'DESCRIBER') {
      canDraw = false;
      if (artToolbar) {
        artToolbar.style.display = 'none'; // Drawing tools disabled
        artToolbar.classList.add('disabled');
      }
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active'); // allow clear view of canvas

      // Hide Drawer Guide
      if (drawerGuideCard) drawerGuideCard.style.display = 'none';

      // Display Target Word and Banned Words Prominently
      if (tabooGuideCard) {
        tabooGuideCard.style.display = 'flex';
        tabooTargetWord.textContent = (state.targetWord || '***').toUpperCase();
        tabooCategoryBadge.textContent = state.category || 'General';

        tabooBannedChips.innerHTML = '';
        if (Array.isArray(state.bannedWords)) {
          state.bannedWords.forEach(banned => {
            const chip = document.createElement('span');
            chip.className = 'taboo-banned-chip';
            chip.innerHTML = `🚫 ${escapeHTML(banned)}`;
            tabooBannedChips.appendChild(chip);
          });
        }
      }

      drawerStatusChip.textContent = `👀 ${state.drawerUsername || 'Drawer'} is sketching. Give 2s voice clues!`;
      drawerStatusChip.className = 'drawer-status-chip';

      wordLabel.textContent = 'Secret Target:';
      currentWordEl.textContent = (state.targetWord || '***').toUpperCase();

      // Describers lose open mic access! Replaced by 2-second "Hold to Speak" button
      if (isRecordingAudio) {
        stopAudioCapture();
      }
      if (micToggleBtn) micToggleBtn.style.display = 'none';
      if (describerBurstBtn) describerBurstBtn.style.display = 'inline-flex';

      chatInput.placeholder = 'Type a creative clue (Do NOT use banned words!)...';
      roleHelpText.textContent = `💡 DESCRIBER: Hold to speak a 2s clue or type without saying forbidden words!`;
    }
  }

  // Socket listener for backend sanitized state sync
  socket.on('game-state-sync', (state) => {
    applySanitizedState(state);
  });

  startGameBtn.addEventListener('click', () => {
    if (!isRoomHost) {
      showToast('Only the Room Host can start or end the game 👑', 'warning', '🔒', 2500);
      return;
    }

    if (gameMode === 'LOBBY' || gameMode === 'GAME_OVER') {
      const activeCount = connectedUsers.filter(u => !u.disconnected).length;
      if (activeCount < 2) {
        showToast(`Need at least 2 players to start! Invite friends using Room Code: ${currentRoomId} 👥`, 'warning', '⚠️', 3500);
        return;
      }
      socket.emit('start-game');
    } else {
      if (confirm('Return to Lobby? Current round will end.')) {
        socket.emit('leave-to-lobby');
      }
    }
  });

  playAgainBtn.addEventListener('click', () => {
    if (!isRoomHost) {
      showToast('Waiting for the Room Host to start the next match 👑', 'info', '⏳', 2500);
      return;
    }
    socket.emit('start-game');
    gameOverOverlay.classList.remove('active');
  });

  // --- A. ROUND START: BLIND DRAWER / GUESSER ---
  socket.on('round-start-drawer', (data) => {
    applySanitizedState({
      phase: 'PLAYING',
      subPhase: 'ROUND_ACTIVE',
      role: 'DRAWER',
      micMode: 'OPEN_MIC',
      canDraw: true,
      currentRound: data.currentRound,
      totalRounds: data.totalRounds,
      timeLeft: data.timeLeft,
      totalTime: data.totalTime,
      wordHint: data.wordHint,
      category: data.category,
      letterCount: data.letterCount,
      targetWord: null, // Strictly hidden
      bannedWords: []
    });

    roundEndOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
    playSound('round_start');
  });

  // --- B. ROUND START: DESCRIBER (WITH TABOO BANNED WORDS) ---
  socket.on('round-start-describer', (data) => {
    applySanitizedState({
      phase: 'PLAYING',
      subPhase: 'ROUND_ACTIVE',
      role: 'DESCRIBER',
      micMode: 'BURST_2S',
      canDraw: false,
      currentRound: data.currentRound,
      totalRounds: data.totalRounds,
      timeLeft: data.timeLeft,
      totalTime: data.totalTime,
      targetWord: data.targetWord,
      category: data.category,
      bannedWords: data.bannedWords,
      drawerUsername: data.drawerUsername
    });

    roundEndOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
    playSound('round_start');
  });

  // --- C. TIMER TICK ---
  socket.on('timer-tick', (data) => {
    timeLeft = data.timeLeft;
    totalTime = data.totalTime;

    timerDigits.textContent = `${timeLeft}s`;
    const percent = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
    timerProgress.setAttribute('stroke-dasharray', `${percent}, 100`);

    if (timeLeft <= 10) {
      gameTimerPill.classList.add('urgent');
      if (timeLeft <= 5) playSound('tick');
    } else {
      gameTimerPill.classList.remove('urgent');
    }
  });

  // --- D. TABOO VIOLATION PENALTY EVENT ---
  socket.on('taboo-violation', (data) => {
    triggerTabooFlash();
    playSound('buzzer');
  });

  // --- E. ROUND END / WON ---
  socket.on('round-end', (data) => {
    gameMode = 'ROUND_END';
    canDraw = false;
    artToolbar.classList.add('disabled');
    guesserLockOverlay.classList.remove('active');

    roundEndBadge.textContent = data.won ? '🏆 ROUND WON!' : '⏰ TIME EXPIRED';
    roundEndWord.textContent = (data.secretWord || '').toUpperCase();
    roundEndSubtext.textContent = `${data.reason} Next round starting soon...`;
    roundEndOverlay.classList.add('active');

    if (data.won) {
      playSound('win');
    }
  });

  // --- F. GAME OVER ---
  socket.on('game-over', (data) => {
    gameMode = 'GAME_OVER';
    canDraw = false;
    artToolbar.classList.add('disabled');
    roundEndOverlay.classList.remove('active');
    guesserLockOverlay.classList.remove('active');

    renderPodium(data.podium);
    gameOverOverlay.classList.add('active');
    playSound('win');
  });

  function renderPodium(podium) {
    podiumContainer.innerHTML = '';
    if (!podium) return;

    podium.forEach((user, idx) => {
      const rank = idx + 1;
      const slot = document.createElement('div');
      slot.className = `podium-slot`;
      slot.innerHTML = `
        <span class="podium-user-name">${escapeHTML(user.username)}</span>
        <span class="podium-score">${user.score || 0} pts</span>
        <div class="podium-bar podium-${rank}">#${rank}</div>
      `;
      podiumContainer.appendChild(slot);
    });
  }

  // --- G. RETURN TO LOBBY ---
  socket.on('return-to-lobby', () => {
    applySanitizedState({
      phase: 'LOBBY',
      subPhase: 'LOBBY',
      role: 'LOBBY',
      micMode: 'OPEN_MIC',
      canDraw: false,
      currentRound: 1,
      totalRounds: 3,
      timeLeft: 0,
      totalTime: 80
    });

    guesserLockOverlay.classList.remove('active');
    roundEndOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
  });

  // =========================================================================
  // 7. General Socket.IO Incoming Events
  // =========================================================================

  function handleRoomJoined(data) {
    setLandingLoading(false);
    currentRoomId = data.roomId || 'MAIN';

    if (currentRoomCode) {
      currentRoomCode.textContent = currentRoomId;
    }

    if (landingOverlay) {
      landingOverlay.classList.add('hidden');
    }
    if (appContainer) {
      appContainer.style.visibility = 'visible';
      appContainer.style.opacity = '1';
      appContainer.style.pointerEvents = 'auto';
    }

    if (data.roomId) {
      try {
        window.history.replaceState(null, '', `?room=${data.roomId}`);
      } catch (e) {}
    }

    currentUser = data.currentUser;
    connectedUsers = data.users || [];
    if (typeof data.isHost === 'boolean') isRoomHost = data.isHost;
    if (data.hostId) roomHostId = data.hostId;

    if (currentUserNameEl) currentUserNameEl.textContent = currentUser.username;
    if (userAvatarDotEl) {
      userAvatarDotEl.style.backgroundColor = currentUser.color;
      userAvatarDotEl.style.boxShadow = `0 0 8px ${currentUser.color}`;
    }

    renderPlayersList();

    fillCanvasWhite();
    if (data.drawingHistory && data.drawingHistory.length > 0) {
      data.drawingHistory.forEach(item => {
        if (item.type === 'stroke') {
          const s = item.data;
          drawLineSegment(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, s.isEraser);
        } else if (item.type === 'dot') {
          const d = item.data;
          drawDot(d.x, d.y, d.color, d.size, d.isEraser);
        }
      });
    }
  }

  socket.on('room-joined', handleRoomJoined);
  socket.on('init-game', handleRoomJoined);

  socket.on('join-error', (data) => {
    setLandingLoading(false);
    const msg = data?.message || 'Error joining room.';
    showLandingError(msg);
    showToast(msg, 'danger', '⚠️', 4000);
  });

  socket.on('user-joined', (data) => {
    connectedUsers = data.users;
    renderPlayersList();
  });

  socket.on('user-reconnected', (data) => {
    connectedUsers = data.users;
    renderPlayersList();
  });

  socket.on('user-left', (data) => {
    connectedUsers = data.users;
    renderPlayersList();
  });

  socket.on('players-update', (users) => {
    connectedUsers = users;
    const me = users.find(u => u.id === socket.id);
    if (me) {
      currentUser = me;
    }
    renderPlayersList();
  });

  socket.on('draw-stroke', (data) => {
    drawLineSegment(data.prevX, data.prevY, data.currX, data.currY, data.color, data.size, data.isEraser);
  });

  socket.on('draw-dot', (data) => {
    drawDot(data.x, data.y, data.color, data.size, data.isEraser);
  });

  socket.on('clear-canvas', () => {
    fillCanvasWhite();
    triggerWipeAnimation();
  });

  socket.on('play-sound', (data) => {
    if (data && data.sound) {
      playSound(data.sound);
    }
  });

  socket.on('connect', () => {
    if (connectionStatus) {
      connectionStatus.className = 'connection-indicator connected';
      const label = connectionStatus.querySelector('.status-label');
      if (label) label.textContent = 'Online';
    }
  });

  socket.on('disconnect', () => {
    if (connectionStatus) {
      connectionStatus.className = 'connection-indicator disconnected';
      const label = connectionStatus.querySelector('.status-label');
      if (label) label.textContent = 'Offline';
    }
  });

  // =========================================================================
  // 8. Chat & Role-Based Clue / Guess Submission
  // =========================================================================

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    socket.emit('chat-message', { text });
    chatInput.value = '';
    chatInput.focus();
  });

  socket.on('chat-message', (msg) => {
    appendChatMessage(msg);
  });

  function appendChatMessage(msg) {
    if (msg.isSystem) {
      // Disappearing toast notification instead of cluttering chat
      showToast(msg.text, 'info', '⚡', 3200);
      return;
    }

    const isMe = (msg.sender === currentUser.username || msg.sender.startsWith(currentUser.username));
    const bubble = document.createElement('div');

    let bubbleClass = 'chat-bubble';
    let roleTag = '';
    let voiceTag = '';

    if (msg.isClue) {
      bubbleClass += ' is-clue';
      roleTag = '<span class="bubble-role-tag tag-clue">💡 CLUE</span>';
    } else if (msg.isGuess) {
      bubbleClass += ' is-guess';
      roleTag = '<span class="bubble-role-tag tag-guess">🎯 GUESS</span>';
    }

    if (msg.isVoice) {
      bubbleClass += ' is-voice';
      const confTitle = typeof msg.confidence === 'number' && msg.confidence > 0
        ? `Deepgram STT (${Math.round(msg.confidence * 100)}% confidence)`
        : 'Deepgram Voice Transcription';
      voiceTag = `
        <span class="bubble-role-tag tag-voice" title="${confTitle}">
          🎙️ VOICE
          <span class="voice-audio-indicator" aria-hidden="true">
            <span class="voice-wave-bar"></span>
            <span class="voice-wave-bar"></span>
            <span class="voice-wave-bar"></span>
          </span>
        </span>
      `;
    }

    let audioPlayerHTML = '';
    let currentBlobUrl = null;

    if (msg.isVoice && msg.audio) {
      try {
        const audioBlob = new Blob([msg.audio], { type: msg.mimeType || 'audio/webm' });
        currentBlobUrl = URL.createObjectURL(audioBlob);
        const durationSec = msg.durationMs ? (msg.durationMs / 1000).toFixed(1) + 's' : '2.0s';
        audioPlayerHTML = `
          <div class="voice-bubble-player">
            <button class="btn-voice-play" type="button" title="Listen to voice clue">
              <span class="voice-icon">▶</span>
              <span class="voice-label">Play</span>
            </button>
            <div class="voice-bars">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <span class="voice-time">${durationSec}</span>
          </div>
        `;
      } catch (e) {
        console.warn('Error creating audio blob:', e);
      }
    }

    if (isMe) bubbleClass += ' is-me';

    bubble.className = bubbleClass;
    bubble.innerHTML = `
      <div class="chat-bubble-header">
        <span class="sender-tag" style="--sender-color: ${msg.color || '#A5B4FC'};">
          ${escapeHTML(msg.sender)} ${roleTag} ${voiceTag}
        </span>
        <span class="msg-time">${escapeHTML(msg.time)}</span>
      </div>
      <div class="msg-body">
        <div class="msg-text">${escapeHTML(msg.text)}</div>
        ${audioPlayerHTML}
      </div>
    `;

    if (currentBlobUrl) {
      const playBtn = bubble.querySelector('.btn-voice-play');
      const playerWrapper = bubble.querySelector('.voice-bubble-player');
      if (playBtn && playerWrapper) {
        const audioElement = new Audio(currentBlobUrl);
        let isAudioPlaying = false;

        playBtn.addEventListener('click', () => {
          if (isAudioPlaying) {
            audioElement.pause();
            audioElement.currentTime = 0;
            isAudioPlaying = false;
            playBtn.querySelector('.voice-icon').textContent = '▶';
            playBtn.querySelector('.voice-label').textContent = 'Play';
            playerWrapper.classList.remove('is-playing');
          } else {
            audioElement.play().then(() => {
              isAudioPlaying = true;
              playBtn.querySelector('.voice-icon').textContent = '⏹';
              playBtn.querySelector('.voice-label').textContent = 'Stop';
              playerWrapper.classList.add('is-playing');
            }).catch(err => {
              console.warn('Audio playback error:', err);
            });
          }
        });

        audioElement.addEventListener('ended', () => {
          isAudioPlaying = false;
          playBtn.querySelector('.voice-icon').textContent = '▶';
          playBtn.querySelector('.voice-label').textContent = 'Play';
          playerWrapper.classList.remove('is-playing');
        });
      }

      // Auto-play the verified voice clue for the listener (e.g. Blind Drawer)
      if (!isMe) {
        showSpeakingIndicator(`${msg.sender || 'Describer'} (Voice Clue)`);
        playAudioBurst(msg.audio, msg.mimeType);
      }
    }

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (editNameBtn) {
    editNameBtn.addEventListener('click', () => {
      const newName = prompt('Enter your nickname (max 18 chars):', currentUser.username);
      if (newName && newName.trim()) {
        const cleanName = newName.trim().slice(0, 18);
        try {
          sessionStorage.setItem('transcribble_username', cleanName);
        } catch (e) {}
        socket.emit('update-username', cleanName);
      }
    });
  }

  // Render Connected Players & Scoreboard
  function renderPlayersList() {
    const activeUsers = connectedUsers.filter(u => !u.disconnected);
    playerCountBadge.textContent = `${activeUsers.length}/10 Players`;
    playersList.innerHTML = '';

    const sorted = [...connectedUsers].sort((a, b) => {
      if (a.disconnected !== b.disconnected) return a.disconnected ? 1 : -1;
      return (b.score || 0) - (a.score || 0);
    });

    sorted.forEach((user, index) => {
      const isMe = (user.id === socket.id || user.username === currentUser.username);
      const isDrawer = (user.role === 'DRAWER');
      const isHost = Boolean(user.isHost || (roomHostId && user.id === roomHostId));
      const isDisconnected = Boolean(user.disconnected);

      const item = document.createElement('div');
      item.className = `player-score-item ${isMe ? 'is-me' : ''} ${isDrawer ? 'is-drawer' : ''} ${isDisconnected ? 'is-disconnected' : ''}`;

      let badge = '💬 Describer';
      if (isDrawer) badge = '🎨 Blind Drawer';
      else if (user.role === 'LOBBY') badge = isHost ? '👑 Host' : '🎮 Player';

      if (isDisconnected) {
        badge = '📶 Reconnecting...';
      }

      item.innerHTML = `
        <div class="player-score-left">
          <span class="player-rank">#${index + 1}</span>
          <span class="player-dot" style="background: ${user.color};"></span>
          <span class="player-name-text">${escapeHTML(user.username)} ${isMe ? '(You)' : ''} ${isHost ? '👑' : ''}</span>
        </div>
        <div class="player-score-right">
          <span class="player-points">${user.score || 0} pts</span>
          <span class="player-status-badge ${isDisconnected ? 'disconnected-badge' : ''}">${badge}</span>
        </div>
      `;
      playersList.appendChild(item);
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  updateToolPreview();
});

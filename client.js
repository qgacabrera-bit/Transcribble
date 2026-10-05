/**
 * Transcribble - Reverse Drawing & Voice Party Game Engine
 * Role Reversal: Drawer is Blind Guesser; Describers have Forbidden Trap Words!
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. Socket.IO Connection & Core State
  // =========================================================================
  const socket = io();
  window.appSocket = socket;
  window.selectedGameMode = 'classic';

  if (typeof window.ImpostorClientManager === 'function') {
    window.impostorManager = new window.ImpostorClientManager();
    window.impostorManager.init(socket, {
      onCanvasLockChange: (allowed) => {
        canDraw = allowed;
      }
    });
  }

  if (typeof window.ZenModeManager === 'function') {
    window.zenModeManager = new window.ZenModeManager();
    window.zenModeManager.init();
  }

  if (typeof window.AcademyModeManager === 'function') {
    window.academyModeManager = new window.AcademyModeManager();
    window.academyModeManager.init();
  }

  if (typeof window.InkslaughtGame === 'function') {
    window.inkslaughtManager = new window.InkslaughtGame();
    window.inkslaughtManager.init();
  }

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

  // Dedicated Guessing Space Elements (Separated from Chat - Top of Chat)
  const guessingCard = document.getElementById('guessingCard');
  const guessingCountBadge = document.getElementById('guessingCountBadge');
  const guessingWordBlanks = document.getElementById('guessingWordBlanks');
  const recentGuessesList = document.getElementById('recentGuessesList');
  const sidebarGuessForm = document.getElementById('sidebarGuessForm');
  const sidebarGuessInput = document.getElementById('sidebarGuessInput');

  // Stroke Tracking for Undo
  let currentStrokeId = null;
  let myStrokeIds = [];

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
  const undoCanvasBtn = document.getElementById('undoCanvasBtn');
  const clearCanvasBtn = document.getElementById('clearCanvasBtn');
  const downloadCanvasBtn = document.getElementById('downloadCanvasBtn');

  // Preview elements & Mobile Toolbar
  const toolPreviewPill = document.getElementById('toolPreviewPill');
  const toolPreviewDot = document.getElementById('toolPreviewDot');
  const toolPreviewText = document.getElementById('toolPreviewText');
  const btnCloseMobileTools = document.getElementById('btnCloseMobileTools');

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

  // Mobile Responsive View Controller (Canvas vs Chat vs Scores vs Split)
  const mobileViewNav = document.getElementById('mobileViewNav');
  const mobileTabCanvas = document.getElementById('mobileTabCanvas');
  const mobileTabChat = document.getElementById('mobileTabChat');
  const mobileTabScores = document.getElementById('mobileTabScores');
  const mobileTabSplit = document.getElementById('mobileTabSplit');
  const chatUnreadBadge = document.getElementById('chatUnreadBadge');
  const mainContentEl = document.getElementById('mainContent');

  let currentMobileView = 'canvas';
  let unreadChatCount = 0;

  function setMobileView(viewName) {
    if (typeof closeMobileTools === 'function') closeMobileTools();
    currentMobileView = viewName;
    if (mainContentEl) {
      mainContentEl.dataset.activeView = viewName;
    }
    const tabs = [mobileTabCanvas, mobileTabChat, mobileTabScores, mobileTabSplit];
    tabs.forEach(tab => {
      if (!tab) return;
      if (tab.dataset.view === viewName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    if (viewName === 'chat' || viewName === 'split') {
      unreadChatCount = 0;
      if (chatUnreadBadge) {
        chatUnreadBadge.textContent = '0';
        chatUnreadBadge.style.display = 'none';
      }
      if (chatMessages) {
        setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
      }
    }
  }
  window.setMobileView = setMobileView;

  if (mobileViewNav) {
    mobileViewNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.mobile-nav-btn');
      if (btn && btn.dataset.view) {
        setMobileView(btn.dataset.view);
      }
    });
  }

  function autoSwitchToCanvasOnMyTurn() {
    if (window.innerWidth <= 768) {
      if (currentMobileView !== 'canvas' && currentMobileView !== 'split') {
        setMobileView('canvas');
        if (typeof showToast === 'function') {
          showToast('Your turn to draw! Switched to Canvas 🎨', 'info', '✏️', 2500);
        }
      }
    }
  }
  window.autoSwitchToCanvasOnMyTurn = autoSwitchToCanvasOnMyTurn;

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
  window.currentPhase = currentPhase;

  // Global helper to check if a match is actively in progress
  window.isGameInProgress = function() {
    const isImpostorActive = Boolean(window.impostorManager && window.impostorManager.isImpostorGameActive);
    const isClassicActive = (currentPhase === 'PLAYING');
    return isImpostorActive || isClassicActive;
  };
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
  window.showToast = showToast;

  /**
   * Comic Black & White Modal Confirmation Dialog
   * Replaces ugly browser native confirm() with an authentic themed container.
   */
  window.showGameConfirmModal = function({
    icon = '⚠️',
    badge = 'ACTIVE MATCH IN PROGRESS',
    title = 'Change Game Mode?',
    message = 'Changing the game mode will cancel the current game in progress and return everyone to the lobby.',
    targetName = 'Classic Mode',
    subnote = 'Active turns and drawings will be cleared.',
    confirmText = 'Cancel Game & Switch',
    cancelText = 'Keep Playing',
    showInput = false,
    inputValue = '',
    inputPlaceholder = 'Enter text...',
    inputMaxLength = 18
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('gameConfirmModal');
      if (!modal) {
        if (showInput) {
          resolve(prompt(message || title, inputValue));
        } else {
          resolve(confirm(`${title}\n\n${message} ${targetName || ''}`));
        }
        return;
      }

      const iconEl = document.getElementById('gameConfirmIcon');
      const badgeEl = document.getElementById('gameConfirmBadge');
      const titleEl = document.getElementById('gameConfirmTitle');
      const descEl = document.getElementById('gameConfirmDesc');
      const targetBadgeEl = document.getElementById('gameConfirmTargetBadge');
      const targetWrap = document.getElementById('gameConfirmTargetWrap');
      const inputWrap = document.getElementById('gameConfirmInputWrap');
      const inputEl = document.getElementById('gameConfirmInput');
      const subnoteEl = document.getElementById('gameConfirmSubnote');
      const btnCancel = document.getElementById('btnGameConfirmCancel');
      const btnOk = document.getElementById('btnGameConfirmOk');

      if (iconEl) iconEl.textContent = icon;
      if (badgeEl) badgeEl.textContent = badge;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = message;

      if (showInput && inputWrap && inputEl) {
        inputWrap.style.display = 'block';
        inputEl.value = inputValue || '';
        inputEl.placeholder = inputPlaceholder || '';
        inputEl.maxLength = inputMaxLength || 18;
        if (targetWrap) targetWrap.style.display = 'none';
        setTimeout(() => {
          inputEl.focus();
          inputEl.select();
        }, 50);
      } else {
        if (inputWrap) inputWrap.style.display = 'none';
        if (targetBadgeEl && targetWrap) {
          if (targetName) {
            targetBadgeEl.textContent = targetName;
            targetWrap.style.display = 'block';
          } else {
            targetWrap.style.display = 'none';
          }
        }
      }

      if (subnoteEl) {
        subnoteEl.textContent = subnote || '';
        subnoteEl.style.display = subnote ? 'block' : 'none';
      }

      if (btnCancel) btnCancel.textContent = cancelText;
      if (btnOk) btnOk.textContent = confirmText;

      modal.style.display = 'flex';

      function cleanUp() {
        modal.style.display = 'none';
        btnCancel?.removeEventListener('click', handleCancel);
        btnOk?.removeEventListener('click', handleConfirm);
        modal.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeyDown);
      }

      function handleConfirm() {
        if (showInput && inputEl) {
          const val = inputEl.value.trim();
          cleanUp();
          resolve(val || null);
        } else {
          cleanUp();
          resolve(true);
        }
      }

      function handleCancel() {
        cleanUp();
        resolve(showInput ? null : false);
      }

      function handleOverlayClick(e) {
        if (e.target === modal) {
          handleCancel();
        }
      }

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
      }

      btnCancel?.addEventListener('click', handleCancel);
      btnOk?.addEventListener('click', handleConfirm);
      modal.addEventListener('click', handleOverlayClick);
      document.addEventListener('keydown', handleKeyDown);
    });
  };

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
  async function returnToHomeScreen() {
    const isGameActive = (typeof window.isGameInProgress === 'function')
      ? window.isGameInProgress()
      : (currentPhase === 'PLAYING' || Boolean(window.impostorManager && window.impostorManager.isImpostorGameActive));

    if (isGameActive) {
      const confirmed = await window.showGameConfirmModal({
        icon: '🚪',
        badge: 'LEAVING MATCH',
        title: 'Return to Home Screen?',
        message: 'Leave current game and return to the Home Screen? Your progress in this room will be lost.',
        targetName: 'Home Screen',
        subnote: 'You can rejoin using the room code if the match is still active.',
        confirmText: 'Leave Game',
        cancelText: 'Stay in Match'
      });
      if (!confirmed) {
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
    if (window.zenModeManager) {
      window.zenModeManager.close();
    }
    document.body.classList.remove('zen-mode-active');
    if (landingOverlay) {
      landingOverlay.classList.remove('hidden');
    }
    if (appContainer) {
      appContainer.classList.remove('hidden');
      appContainer.style.display = '';
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
  // 3.1. Real-Time Open-Mic Voice Chat (16kHz Raw PCM over WebSocket)
  // =========================================================================
  let mediaStream = null;
  let isRecordingAudio = false;
  let pcmAudioCtx = null;
  let pcmSourceNode = null;
  let pcmProcessorNode = null;
  const senderPcmTimes = new Map(); // senderId -> nextScheduledPlayTime
  const playedAudioBurstIds = new Set(); // Prevent double-playback of voice clue bursts
  let speakingTimeout = null;

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

  async function startAudioCapture() {
    // If in 2-second burst mode (Describer during PLAYING phase), redirect to burst recorder
    if (currentMicMode === 'BURST_2S') {
      startDescriberBurst();
      return;
    }

    if (isRecordingAudio) return;

    try {
      const stream = await getMicrophoneStream();
      if (!stream) return;

      initAudio();
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!pcmAudioCtx) {
        pcmAudioCtx = new AudioCtxClass();
      }
      if (pcmAudioCtx.state === 'suspended') {
        await pcmAudioCtx.resume();
      }

      pcmSourceNode = pcmAudioCtx.createMediaStreamSource(stream);

      // Buffer size 2048 samples (~45-128ms packets depending on device sample rate)
      pcmProcessorNode = pcmAudioCtx.createScriptProcessor(2048, 1, 1);

      const targetSampleRate = 16000;
      const inputSampleRate = pcmAudioCtx.sampleRate;

      pcmProcessorNode.onaudioprocess = (e) => {
        if (!isRecordingAudio) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Simple noise gate / silence filter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const avg = sum / inputData.length;
        if (avg < 0.005) {
          // Silence: skip sending packets to avoid microphone room hiss
          return;
        }

        // Downsample to 16000 Hz if needed
        let resampled;
        if (inputSampleRate === targetSampleRate) {
          resampled = inputData;
        } else {
          const ratio = inputSampleRate / targetSampleRate;
          const newLength = Math.round(inputData.length / ratio);
          resampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            resampled[i] = inputData[Math.min(inputData.length - 1, Math.round(i * ratio))];
          }
        }

        // Convert Float32 (-1.0 to 1.0) to 16-bit PCM Int16Array
        const pcm16 = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        socket.emit('voice-pcm', {
          pcm: pcm16.buffer,
          sampleRate: targetSampleRate
        });
      };

      pcmSourceNode.connect(pcmProcessorNode);
      pcmProcessorNode.connect(pcmAudioCtx.destination);

      isRecordingAudio = true;
      setMicLiveState(true);
    } catch (err) {
      console.error('Open mic capture error:', err);
      showToast('⚠️ Could not start open microphone.', 'danger', '🎙️', 3000);
      stopAudioCapture();
    }
  }

  function stopAudioCapture() {
    if (!isRecordingAudio) return;
    isRecordingAudio = false;

    if (pcmProcessorNode) {
      try {
        pcmProcessorNode.disconnect();
        pcmProcessorNode.onaudioprocess = null;
      } catch (e) {}
      pcmProcessorNode = null;
    }
    if (pcmSourceNode) {
      try {
        pcmSourceNode.disconnect();
      } catch (e) {}
      pcmSourceNode = null;
    }

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
  // 3.2. Describer "Hold to Speak" Burst Mode ('stt-audio-burst')
  // =========================================================================
  let burstRecorder = null;
  let isBurstRecording = false;
  let burstTimeout = null;
  let burstInterval = null;
  let burstStartTime = 0;
  let burstChunks = [];
  const MAX_BURST_MS = 3500; // 3.5-second limit for clear clue formulation

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
        if (actualDuration < 400) {
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
        } else {
          showToast('⚠️ No audio captured. Check your microphone permissions.', 'warning', '🎙️', 3000);
        }
        resetBurstUi();
      };

      burstRecorder.start(200); // Continuous 200ms timeslices ensure buffer integrity
      burstStartTime = Date.now();
      isBurstRecording = true;
      setBurstUiActive(true);

      // Maximum recording limit
      burstTimeout = setTimeout(() => {
        stopDescriberBurst();
      }, MAX_BURST_MS);

      // Smooth visual countdown (3.5s -> 0.0s)
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
        if (typeof burstRecorder.requestData === 'function') {
          burstRecorder.requestData();
        }
      } catch (e) {}
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
    if (burstCountdownPill) burstCountdownPill.textContent = '3.5s';
    if (pttCountdownBadge) pttCountdownBadge.textContent = '3.5s';
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

  // Client-Side Real-Time Open-Mic PCM Playback ('voice-pcm')
  socket.on('voice-pcm', (data) => {
    if (!data || data.senderId === socket.id || !data.pcm) return;
    showSpeakingIndicator(data.username || 'Player');
    playIncomingPcm(data);
  });

  // Client-Side Voice Clue Burst Playback ('stt-audio-burst')
  socket.on('stt-audio-burst', async (data) => {
    if (!data || data.senderId === socket.id) return;
    showSpeakingIndicator(`${data.senderName || 'Describer'} (Voice Clue)`);
    await playAudioBurst(data.audio, data.mimeType, data.burstId);
  });

  function playIncomingPcm(data) {
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const int16 = new Int16Array(data.pcm);
      if (int16.length === 0) return;

      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const sampleRate = data.sampleRate || 16000;
      const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      let scheduledTime = senderPcmTimes.get(data.senderId) || now;

      // Anti-jitter: If silence gap > 350ms or scheduled in the past, reset smoothly with 25ms buffer
      if (scheduledTime < now || (scheduledTime - now) > 0.35) {
        scheduledTime = now + 0.025;
      }

      source.start(scheduledTime);
      senderPcmTimes.set(data.senderId, scheduledTime + audioBuffer.duration);
    } catch (err) {
      console.warn('PCM playback error:', err);
    }
  }

  let lastAudioBurstTime = 0;

  async function playAudioBurst(audioData, mimeType, burstId = null) {
    if (!audioData) return;
    if (burstId && playedAudioBurstIds.has(burstId)) return;
    if (burstId) {
      playedAudioBurstIds.add(burstId);
      if (playedAudioBurstIds.size > 100) {
        const first = playedAudioBurstIds.values().next().value;
        playedAudioBurstIds.delete(first);
      }
    }

    const now = Date.now();
    if (now - lastAudioBurstTime < 500) return;
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

  // =========================================================================
  // 4. Real-Time Drawing Mechanics
  // =========================================================================

  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    let clientX = event.clientX;
    let clientY = event.clientY;

    if (typeof clientX !== 'number' || isNaN(clientX)) {
      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.changedTouches && event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      }
    }

    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;

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

  // Pointer Events handling (Mouse, Stylus, and Touch)
  canvas.addEventListener('pointerdown', (e) => {
    if (!canDraw) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.cancelable) e.preventDefault();

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDrawing = true;
    hasMoved = false;

    // Generate unique strokeId for this drawing gesture
    currentStrokeId = 'str_' + (socket.id || 'me') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    myStrokeIds.push(currentStrokeId);

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
      isEraser: isEraser,
      strokeId: currentStrokeId
    });
  });

  canvas.addEventListener('pointermove', (e) => {
    updateCursorPreview(e);
    if (!isDrawing || !canDraw) return;
    if (e.cancelable) e.preventDefault();

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
      isEraser: isEraser,
      strokeId: currentStrokeId
    });

    lastX = currX;
    lastY = currY;
  });

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    currentStrokeId = null;
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

  // Dedicated touch listeners to guarantee no iOS/Android gesture interference (pinch zoom, pull-to-refresh) while sketching
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(eventType => {
    canvas.addEventListener(eventType, (e) => {
      if (canDraw && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });
  });

  function updateCursorPreview(e) {
    // Hide artificial cursor preview on touch screens to not obstruct the user's finger
    if (!canDraw || e.pointerType === 'touch') {
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

  // =========================================================================
  // Mobile Collapsible Options Window (Top-Left of Canvas)
  // =========================================================================
  function positionMobileTools() {
    if (!artToolbar || !toolPreviewPill || !canvasSection) return;
    if (window.innerWidth > 768) {
      artToolbar.style.top = '';
      artToolbar.style.left = '';
      return;
    }
    const pillRect = toolPreviewPill.getBoundingClientRect();
    const sectionRect = canvasSection.getBoundingClientRect();

    // Position directly under the tool preview pill
    const topOffset = Math.max(8, Math.round(pillRect.bottom - sectionRect.top + 6));
    const leftOffset = Math.max(8, Math.round(pillRect.left - sectionRect.left));
    artToolbar.style.top = `${topOffset}px`;
    artToolbar.style.left = `${leftOffset}px`;
  }

  function toggleMobileTools(forceState) {
    if (!artToolbar) return;
    const shouldOpen = (typeof forceState === 'boolean')
      ? forceState
      : !artToolbar.classList.contains('mobile-tools-open');

    if (shouldOpen) {
      positionMobileTools();
      artToolbar.classList.add('mobile-tools-open');
      if (toolPreviewPill) toolPreviewPill.classList.add('active');
    } else {
      artToolbar.classList.remove('mobile-tools-open');
      if (toolPreviewPill) toolPreviewPill.classList.remove('active');
    }
  }

  function closeMobileTools() {
    if (artToolbar && artToolbar.classList.contains('mobile-tools-open')) {
      artToolbar.classList.remove('mobile-tools-open');
      if (toolPreviewPill) toolPreviewPill.classList.remove('active');
    }
  }
  window.closeMobileTools = closeMobileTools;

  if (toolPreviewPill) {
    toolPreviewPill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        toggleMobileTools();
      }
    });
  }

  if (btnCloseMobileTools) {
    btnCloseMobileTools.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMobileTools();
    });
  }

  // Prevent taps inside the popover from bubbling up to document
  if (artToolbar) {
    artToolbar.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Close options window when user touches or clicks the canvas to draw
  if (canvas) {
    canvas.addEventListener('pointerdown', () => {
      if (window.innerWidth <= 768) closeMobileTools();
    });
    canvas.addEventListener('touchstart', () => {
      if (window.innerWidth <= 768) closeMobileTools();
    }, { passive: true });
  }

  // Close when tapping anywhere outside the popover window or pill
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && artToolbar && artToolbar.classList.contains('mobile-tools-open')) {
      if (!artToolbar.contains(e.target) && (!toolPreviewPill || !toolPreviewPill.contains(e.target))) {
        closeMobileTools();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileTools();
      if (artToolbar) {
        artToolbar.style.top = '';
        artToolbar.style.left = '';
      }
    } else if (artToolbar && artToolbar.classList.contains('mobile-tools-open')) {
      positionMobileTools();
    }
  });

  function triggerUndo() {
    if (!canDraw) return;
    if (myStrokeIds.length === 0) {
      showToast('No strokes to undo', 'info', '↩️', 1800);
      return;
    }
    const strokeId = myStrokeIds.pop();
    socket.emit('undo-canvas', { strokeId });
    playSound('pop');
  }

  if (undoCanvasBtn) {
    undoCanvasBtn.addEventListener('click', () => {
      triggerUndo();
    });
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (!isInput && canDraw) {
        e.preventDefault();
        triggerUndo();
      }
    }
  });

  clearCanvasBtn.addEventListener('click', async () => {
    if (!canDraw) return;
    const confirmed = await window.showGameConfirmModal({
      icon: '🗑️',
      badge: 'CLEAR CANVAS',
      title: 'Clear Entire Board?',
      message: 'Are you sure you want to clear the canvas for all players?',
      targetName: 'Erase Everything',
      subnote: 'All current drawings on the canvas will be wiped.',
      confirmText: 'Clear Board',
      cancelText: 'Keep Drawing'
    });
    if (confirmed) {
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
    window.currentPhase = currentPhase;
    gameMode = state.subPhase || state.phase;
    myRole = state.role || 'LOBBY';
    currentMicMode = state.micMode || 'OPEN_MIC';
    canDraw = Boolean(state.canDraw);
    currentRound = state.currentRound || 1;
    totalRounds = state.totalRounds || 3;
    timeLeft = (typeof state.timeLeft === 'number') ? state.timeLeft : 0;
    totalTime = (typeof state.totalTime === 'number') ? state.totalTime : 80;

    if (typeof state.isHost === 'boolean') {
      isRoomHost = state.isHost;
      window.isRoomHost = isRoomHost;
    }
    if (state.hostId) roomHostId = state.hostId;

    if (state.selectedMode) {
      window.selectedGameMode = state.selectedMode;
      if (window.impostorManager) {
        window.impostorManager.updateModePill(state.selectedMode);
      }
    }

    // --- 1. PHASE == LOBBY (FREE DRAWING BEFORE GAME STARTS) ---
    if (state.phase === 'LOBBY') {
      if (window.impostorManager) {
        window.impostorManager.isImpostorGameActive = false;
        if (window.impostorManager.turnStrip) window.impostorManager.turnStrip.style.display = 'none';
        if (window.impostorManager.votingOverlay) window.impostorManager.votingOverlay.style.display = 'none';
        if (window.impostorManager.gameOverOverlay) window.impostorManager.gameOverOverlay.style.display = 'none';
      }
      if (canvasContainer) canvasContainer.style.display = 'block';
      if (canvasTopBar) canvasTopBar.style.display = 'flex';
      if (artToolbar) {
        artToolbar.style.display = 'flex';
        artToolbar.classList.remove('disabled');
      }
      if (tabooGuideCard) tabooGuideCard.style.display = 'none';
      if (drawerGuideCard) drawerGuideCard.style.display = 'none';
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active');
      if (guessingCard) guessingCard.style.display = 'none';
      if (sidebarGuessForm) sidebarGuessForm.style.display = 'none';

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
    if (state.selectedMode === 'impostor') {
      if (canvasContainer) canvasContainer.style.display = 'block';
      if (canvasTopBar) canvasTopBar.style.display = 'flex';
      if (tabooGuideCard) tabooGuideCard.style.display = 'none';
      if (drawerGuideCard) drawerGuideCard.style.display = 'none';
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active');
      if (drawerStatusChip) drawerStatusChip.style.display = 'none';
      if (describerBurstBtn) describerBurstBtn.style.display = 'none';
      if (micToggleBtn) micToggleBtn.style.display = 'inline-flex';
      if (guessingCard) guessingCard.style.display = 'none';
      if (sidebarGuessForm) sidebarGuessForm.style.display = 'none';

      // Stop Game button is ONLY visible for the Host at the top header
      if (startGameBtn) {
        if (isRoomHost) {
          startGameBtn.textContent = '⏹ Stop Game';
          startGameBtn.className = 'btn-primary-action danger';
          startGameBtn.style.display = 'inline-flex';
          startGameBtn.disabled = false;
          startGameBtn.title = 'Stop Impostor Mode and return to lobby';
        } else {
          startGameBtn.style.display = 'none';
        }
      }
      return;
    }

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

    const charCount = state.letterCount || 0;
    const charLabel = `${charCount} ${charCount === 1 ? 'character' : 'characters'}`;

    if (guessingCard) {
      guessingCard.style.display = 'flex';
      if (guessingWordBlanks) {
        guessingWordBlanks.textContent = state.wordHint || '_____';
      }
      if (guessingCountBadge) {
        guessingCountBadge.textContent = charLabel;
      }
    }

    // A. Role == DRAWER (Blind Drawer & Guesser)
    if (state.role === 'DRAWER') {
      canDraw = true;
      autoSwitchToCanvasOnMyTurn();
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
        drawerMysteryText.textContent = `Mystery Word: ${state.wordHint || '_____'} (${charLabel}) • Category: ${state.category || 'Secret'}`;
      }

      if (sidebarGuessForm) sidebarGuessForm.style.display = 'flex';

      drawerStatusChip.textContent = `🎨 YOU ARE THE BLIND DRAWER! Draw & Guess!`;
      drawerStatusChip.className = 'drawer-status-chip is-drawing';

      wordLabel.textContent = 'Category:';
      currentWordEl.textContent = `${state.category || 'Secret'} (${state.letterCount || 0} letters)`;

      // Mic Mode: Drawer keeps open continuous mic to think out loud!
      if (micToggleBtn) micToggleBtn.style.display = 'inline-flex';
      if (describerBurstBtn) describerBurstBtn.style.display = 'none';

      chatInput.placeholder = 'Chat with other players...';
      roleHelpText.textContent = '🎯 YOU ARE THE DRAWER: Sketch what clues describe, and type your guesses in the Guessing space!';
    }
    // B. Role == DESCRIBER (With Taboo Forbidden Words)
    else if (state.role === 'DESCRIBER') {
      canDraw = false;
      if (artToolbar) {
        artToolbar.style.display = 'none'; // Drawing tools disabled
        artToolbar.classList.add('disabled');
      }
      if (guesserLockOverlay) guesserLockOverlay.classList.remove('active'); // allow clear view of canvas

      // Hide Drawer Guide & Guess forms
      if (drawerGuideCard) drawerGuideCard.style.display = 'none';
      if (sidebarGuessForm) sidebarGuessForm.style.display = 'none';

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

      drawerStatusChip.textContent = `👀 ${state.drawerUsername || 'Drawer'} is sketching. Give voice clues!`;
      drawerStatusChip.className = 'drawer-status-chip';

      wordLabel.textContent = 'Secret Target:';
      currentWordEl.textContent = (state.targetWord || '***').toUpperCase();

      // Describers lose open mic access! Replaced by "Hold to Speak" voice clue button
      if (isRecordingAudio) {
        stopAudioCapture();
      }
      if (micToggleBtn) micToggleBtn.style.display = 'none';
      if (describerBurstBtn) describerBurstBtn.style.display = 'inline-flex';

      chatInput.placeholder = 'Type a creative clue (Do NOT use banned words!)...';
      roleHelpText.textContent = `💡 DESCRIBER: Hold to speak a clue or type without saying forbidden words!`;
    }
  }

  // Socket listener for backend sanitized state sync
  socket.on('game-state-sync', (state) => {
    applySanitizedState(state);
  });

  startGameBtn.addEventListener('click', async () => {
    if (!isRoomHost) {
      showToast('Only the Room Host can start or stop the game 👑', 'warning', '🔒', 2500);
      return;
    }

    const isImpostorActive = window.impostorManager && window.impostorManager.isImpostorGameActive;

    // 1. If Impostor mode is active -> STOP GAME IMMEDIATELY
    if (isImpostorActive) {
      const confirmed = await window.showGameConfirmModal({
        icon: '⏹️',
        badge: 'HOST ACTION',
        title: 'Stop Impostor Game?',
        message: 'Stop the active Impostor match and return everyone to the lobby?',
        targetName: 'Lobby',
        subnote: 'Active turns and secret word will end.',
        confirmText: 'Stop Game',
        cancelText: 'Keep Playing'
      });
      if (confirmed) {
        socket.emit('stop-game');
      }
      return;
    }

    // 2. If Classic mode is playing -> END MATCH
    if (currentPhase === 'PLAYING') {
      const confirmed = await window.showGameConfirmModal({
        icon: '⏹️',
        badge: 'HOST ACTION',
        title: 'End Classic Match?',
        message: 'Stop the active round and return all players to the lobby?',
        targetName: 'Lobby',
        subnote: 'Current round scores will be finalized.',
        confirmText: 'End Match',
        cancelText: 'Keep Playing'
      });
      if (confirmed) {
        socket.emit('leave-to-lobby');
      }
      return;
    }

    // 3. Lobby Mode: Only Host can start game
    if (!isRoomHost) {
      showToast('Waiting for the Room Host to start the game 👑', 'warning', '🔒', 2500);
      return;
    }

    const activeCount = connectedUsers.filter(u => !u.disconnected).length;
    if (activeCount < 2) {
      showToast(`Need at least 2 players to start! Invite friends using Room Code: ${currentRoomId} 👥`, 'warning', '⚠️', 3500);
      return;
    }
    const mode = window.selectedGameMode || 'classic';
    socket.emit('start-game', { mode });
  });

  playAgainBtn.addEventListener('click', () => {
    if (!isRoomHost) {
      showToast('Waiting for the Room Host to start the next match 👑', 'info', '⏳', 2500);
      return;
    }
    const mode = window.selectedGameMode || 'classic';
    socket.emit('start-game', { mode });
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

    myStrokeIds = [];
    if (recentGuessesList) {
      recentGuessesList.innerHTML = '<div class="no-guesses-placeholder">Waiting for drawer\'s first guess...</div>';
    }

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

    myStrokeIds = [];
    if (recentGuessesList) {
      recentGuessesList.innerHTML = '<div class="no-guesses-placeholder">Waiting for drawer\'s first guess...</div>';
    }

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

    if (window.zenModeManager) {
      window.zenModeManager.close();
    }
    document.body.classList.remove('zen-mode-active');
    if (landingOverlay) {
      landingOverlay.classList.add('hidden');
    }
    if (appContainer) {
      appContainer.classList.remove('hidden');
      appContainer.style.display = '';
      appContainer.style.visibility = 'visible';
      appContainer.style.opacity = '1';
      appContainer.style.pointerEvents = 'auto';
    }

    if (canvas) {
      if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
      }
      fillCanvasWhite();
    }
    if (canvasContainer) {
      canvasContainer.style.display = 'block';
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
    myStrokeIds = [];
  });

  socket.on('drawing-history-sync', (data) => {
    fillCanvasWhite();
    if (data && data.drawingHistory && data.drawingHistory.length > 0) {
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
  // 8. Chat & Dedicated Drawer Guess Submission (Separated Guess Space)
  // =========================================================================

  function submitDrawerGuess(raw) {
    const text = String(raw || '').trim();
    if (!text) return;

    socket.emit('submit-drawer-guess', { guess: text });
    if (sidebarGuessInput) {
      sidebarGuessInput.value = '';
      sidebarGuessInput.focus();
    }
  }

  if (sidebarGuessForm) {
    sidebarGuessForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitDrawerGuess(sidebarGuessInput ? sidebarGuessInput.value : '');
    });
  }

  socket.on('drawer-guess-result', (data) => {
    appendDrawerGuess(data);
  });

  function appendDrawerGuess(data) {
    if (!recentGuessesList) return;
    const placeholder = recentGuessesList.querySelector('.no-guesses-placeholder');
    if (placeholder) placeholder.remove();

    const pill = document.createElement('div');
    pill.className = `guess-entry-pill ${data.status || 'incorrect'}`;

    let statusBadge = '<span class="guess-status-tag tag-wrong">❌</span>';
    if (data.status === 'correct') {
      statusBadge = '<span class="guess-status-tag tag-correct">🎉 CORRECT!</span>';
    } else if (data.status === 'close') {
      statusBadge = '<span class="guess-status-tag tag-close">🔥 SO CLOSE!</span>';
    }

    pill.innerHTML = `
      <div class="guess-entry-main">
        <span class="guess-entry-word">"${escapeHTML(data.guess)}"</span>
        ${statusBadge}
      </div>
      <span class="guess-entry-time">${data.time || ''}</span>
    `;

    recentGuessesList.prepend(pill);
    while (recentGuessesList.children.length > 15) {
      recentGuessesList.removeChild(recentGuessesList.lastChild);
    }
  }

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
        const durationSec = msg.durationMs ? (msg.durationMs / 1000).toFixed(1) + 's' : '3.5s';
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
      if (!isMe && msg.isVoice && msg.audio) {
        if (!playedAudioBurstIds.has(msg.id)) {
          showSpeakingIndicator(`${msg.sender || 'Describer'} (Voice Clue)`);
          playAudioBurst(msg.audio, msg.mimeType, msg.id);
        }
      }
    }

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Track unread messages on mobile when Chat view is not visible
    if (window.innerWidth <= 768 && currentMobileView !== 'chat' && currentMobileView !== 'split') {
      if (!isMe) {
        unreadChatCount++;
        if (chatUnreadBadge) {
          chatUnreadBadge.textContent = unreadChatCount > 99 ? '99+' : unreadChatCount;
          chatUnreadBadge.style.display = 'inline-block';
        }
      }
    }
  }

  if (editNameBtn) {
    editNameBtn.addEventListener('click', async () => {
      const newName = await window.showGameConfirmModal({
        icon: '✏️',
        badge: 'PLAYER PROFILE',
        title: 'Change Your Nickname',
        message: 'Enter your new display nickname below:',
        showInput: true,
        inputValue: currentUser.username || '',
        inputPlaceholder: 'Enter nickname (max 18 chars)...',
        inputMaxLength: 18,
        confirmText: 'Save Nickname',
        cancelText: 'Cancel'
      });
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

// =============================================================================
// Inkslaught Arcade Mode - Gesture Recognizer, Enemy Entities & Physics Loop
// Modular JavaScript code for standalone execution and client integration
// =============================================================================
(function(global) {
  'use strict';

  if (typeof global.DollarRecognizer === 'undefined') {
    class DollarRecognizer {
      constructor() {
        this.numPoints = 64;
        this.squareSize = 250.0;
        this.templates = [];
        this.initTemplates();
      }

      initTemplates() {
        // 1. Vertical Line
        const vert = [];
        for (let i = 0; i <= 20; i++) vert.push({ x: 125, y: 25 + (i / 20) * 200 });
        this.addTemplate('Vertical Line', vert);

        // 2. Horizontal Line
        const horiz = [];
        for (let i = 0; i <= 20; i++) horiz.push({ x: 25 + (i / 20) * 200, y: 125 });
        this.addTemplate('Horizontal Line', horiz);

        // 3. V-Shape
        const vPts = [];
        for (let i = 0; i <= 10; i++) vPts.push({ x: 30 + (i / 10) * 95, y: 40 + (i / 10) * 170 });
        for (let i = 1; i <= 10; i++) vPts.push({ x: 125 + (i / 10) * 95, y: 210 - (i / 10) * 170 });
        this.addTemplate('V-Shape', vPts);

        // 4. Caret (^)
        const caret = [];
        for (let i = 0; i <= 10; i++) caret.push({ x: 30 + (i / 10) * 95, y: 210 - (i / 10) * 170 });
        for (let i = 1; i <= 10; i++) caret.push({ x: 125 + (i / 10) * 95, y: 40 + (i / 10) * 170 });
        this.addTemplate('Caret', caret);

        // 5. Circle
        const circle = [];
        const numC = 36;
        for (let i = 0; i <= numC; i++) {
          const a = -Math.PI / 2 + (i / numC) * 2 * Math.PI;
          circle.push({ x: 125 + 95 * Math.cos(a), y: 125 + 95 * Math.sin(a) });
        }
        this.addTemplate('Circle', circle);

        // 6. Lightning Bolt
        const bolt = [];
        for (let i = 0; i <= 8; i++) bolt.push({ x: 170 - (i / 8) * 110, y: 25 + (i / 8) * 85 });
        for (let i = 1; i <= 6; i++) bolt.push({ x: 60 + (i / 6) * 110, y: 110 });
        for (let i = 1; i <= 8; i++) bolt.push({ x: 170 - (i / 8) * 115, y: 110 + (i / 8) * 115 });
        this.addTemplate('Lightning Bolt', bolt);
      }

      addTemplate(name, points) {
        const resampled = this.resample(points, this.numPoints);
        const scaled = this.scale(resampled, this.squareSize);
        const translated = this.translateToOrigin(scaled);
        this.templates.push({ name, points: translated, rawPoints: points });
      }

      resample(points, n) {
        if (!points || points.length === 0) return [];
        if (points.length === 1) {
          const out = [];
          for (let i = 0; i < n; i++) out.push({ x: points[0].x, y: points[0].y });
          return out;
        }
        const I = this.pathLength(points) / (n - 1);
        let D = 0.0;
        const newPoints = [{ x: points[0].x, y: points[0].y }];
        const pts = points.slice();
        for (let i = 1; i < pts.length; i++) {
          const d = this.distance(pts[i - 1], pts[i]);
          if (D + d >= I) {
            const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
            const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
            const q = { x: qx, y: qy };
            newPoints.push(q);
            pts.splice(i, 0, q);
            D = 0.0;
          } else {
            D += d;
          }
        }
        while (newPoints.length < n) newPoints.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
        return newPoints.slice(0, n);
      }

      pathLength(pts) {
        let d = 0.0;
        for (let i = 1; i < pts.length; i++) d += this.distance(pts[i - 1], pts[i]);
        return d;
      }

      distance(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
      }

      boundingBox(pts) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
      }

      scale(pts, size) {
        const box = this.boundingBox(pts);
        const is1D = (box.width / box.height < 0.25) || (box.height / box.width < 0.25);
        const newPts = [];
        for (const p of pts) {
          let qx, qy;
          if (is1D) {
            const maxDim = Math.max(box.width, box.height);
            qx = ((p.x - box.x) / maxDim) * size;
            qy = ((p.y - box.y) / maxDim) * size;
          } else {
            qx = ((p.x - box.x) / box.width) * size;
            qy = ((p.y - box.y) / box.height) * size;
          }
          newPts.push({ x: qx, y: qy });
        }
        return newPts;
      }

      centroid(pts) {
        let x = 0.0, y = 0.0;
        for (const p of pts) { x += p.x; y += p.y; }
        return { x: x / pts.length, y: y / pts.length };
      }

      translateToOrigin(pts) {
        const c = this.centroid(pts);
        return pts.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
      }

      pathDistance(pts1, pts2) {
        let d = 0.0;
        const n = Math.min(pts1.length, pts2.length);
        for (let i = 0; i < n; i++) d += this.distance(pts1[i], pts2[i]);
        return d / n;
      }

      recognize(rawPoints) {
        if (!rawPoints || rawPoints.length < 8) return null;
        const totalLen = this.pathLength(rawPoints);
        if (totalLen < 28) return null;

        const box = this.boundingBox(rawPoints);
        const startPt = rawPoints[0];
        const endPt = rawPoints[rawPoints.length - 1];
        const startEndDist = this.distance(startPt, endPt);
        const aspectHW = box.height / box.width;
        const aspectWH = box.width / box.height;

        const resampled = this.resample(rawPoints, this.numPoints);
        const scaled = this.scale(resampled, this.squareSize);
        const translated = this.translateToOrigin(scaled);
        const reversed = translated.slice().reverse();

        const isClosedLoop = (startEndDist / totalLen < 0.32) && (box.width > 22 && box.height > 22) && (aspectHW > 0.55 && aspectHW < 1.8);
        const isVerticalDominant = (aspectHW > 2.4) && (box.width < 45 || aspectHW > 3.0);
        const isHorizontalDominant = (aspectWH > 2.4) && (box.height < 45 || aspectWH > 3.0);

        let bestDistance = Infinity;
        let bestTemplate = null;

        for (const tmpl of this.templates) {
          const dForward = this.pathDistance(translated, tmpl.points);
          const dReverse = this.pathDistance(reversed, tmpl.points);
          let d = Math.min(dForward, dReverse);

          if (tmpl.name === 'Circle') {
            let bestCircleDist = Infinity;
            for (let shift = 0; shift < this.numPoints; shift += 8) {
              const shifted = translated.slice(shift).concat(translated.slice(0, shift));
              const shiftedRev = reversed.slice(shift).concat(reversed.slice(0, shift));
              const dF = this.pathDistance(shifted, tmpl.points);
              const dR = this.pathDistance(shiftedRev, tmpl.points);
              bestCircleDist = Math.min(bestCircleDist, dF, dR);
            }
            d = bestCircleDist;
            if (isClosedLoop) d *= 0.55; else d *= 1.45;
          } else if (tmpl.name === 'Vertical Line') {
            if (isVerticalDominant) d *= 0.45;
            if (isHorizontalDominant || isClosedLoop) d *= 2.5;
          } else if (tmpl.name === 'Horizontal Line') {
            if (isHorizontalDominant) d *= 0.45;
            if (isVerticalDominant || isClosedLoop) d *= 2.5;
          } else if (tmpl.name === 'V-Shape') {
            const midY = translated[Math.floor(this.numPoints / 2)].y;
            const endsY = (translated[0].y + translated[this.numPoints - 1].y) / 2;
            if (midY > endsY + 15) d *= 0.7; else d *= 1.5;
          } else if (tmpl.name === 'Caret') {
            const midY = translated[Math.floor(this.numPoints / 2)].y;
            const endsY = (translated[0].y + translated[this.numPoints - 1].y) / 2;
            if (midY < endsY - 15) d *= 0.7; else d *= 1.5;
          } else if (tmpl.name === 'Lightning Bolt') {
            let reversals = 0;
            for (let p = 2; p < resampled.length; p++) {
              const dx1 = resampled[p - 1].x - resampled[p - 2].x;
              const dx2 = resampled[p].x - resampled[p - 1].x;
              if (dx1 * dx2 < -10) reversals++;
            }
            if (reversals >= 1) d *= 0.75;
          }

          if (d < bestDistance) {
            bestDistance = d;
            bestTemplate = tmpl;
          }
        }

        if (!bestTemplate) return null;
        const halfDiagonal = 0.5 * Math.sqrt(this.squareSize * this.squareSize * 2);
        const score = Math.max(0, 1.0 - (bestDistance / halfDiagonal));
        return (score >= 0.55) ? { name: bestTemplate.name, score } : null;
      }
    }

    global.DollarRecognizer = DollarRecognizer;
  }

  // Ensure Enemy and InkslaughtGame are globally accessible
  global.InkslaughtEnemy = global.InkslaughtEnemy || null;
  global.InkslaughtGame = global.InkslaughtGame || null;

})(typeof window !== 'undefined' ? window : this);

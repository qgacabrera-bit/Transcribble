/**
 * ============================================================================
 * ImpostorClientManager - Front-End Controller for Impostor Game Mode
 * ============================================================================
 * 
 * Manages:
 * 1. Role Assignment & Guidance Display (Regular vs Impostor stealth banner).
 * 2. Turn Queue & Canvas Lock/Unlock (Only active player has canvas write access).
 * 3. Synchronized 10s Countdown Timer.
 * 4. Voting Phase Overlay (Candidate cards, single vote, countdown, majority result).
 * 5. Game Stopping Controls:
 *    - Host: Immediate "⏹ Stop Game" buttons (in banner, turn strip, & voting screen).
 *    - Impostor: "🕵️ Guess Word & Win" modal to stop the game and steal the victory.
 * 6. Concluding 'GAME_OVER' Leaderboard with revealed scores and Impostor identity.
 */

(function () {
  'use strict';

  class ImpostorClientManager {
    constructor() {
      this.socket = null;
      this.isImpostorGameActive = false;
      this.myRole = null; // 'IMPOSTOR' | 'REGULAR'
      this.isImpostor = false;
      this.secretWord = null;
      this.secretCategory = null;

      this.activePlayerId = null;
      this.isMyTurn = false;
      this.turnTimeLeft = 0;
      this.votingTimeLeft = 0;
      this.selectedVoteTarget = null;
      this.hasVoted = false;
      this.isRoomHost = false;

      // Bound callbacks for integration with main client canvas
      this.onCanvasLockChange = null;
    }

    init(socket, options = {}) {
      this.socket = socket;
      if (options.onCanvasLockChange) {
        this.onCanvasLockChange = options.onCanvasLockChange;
      }

      this.cacheDOMElements();
      this.bindSocketEvents();
      this.bindUIEvents();
      console.log('🕵️ ImpostorClientManager initialized.');
    }

    cacheDOMElements() {
      // Turn Strip
      this.turnStrip = document.getElementById('impostorTurnStrip');
      this.turnStripInner = document.getElementById('turnStripInner');
      this.turnStripIcon = document.getElementById('turnStripIcon');
      this.turnStripText = document.getElementById('turnStripText');
      this.turnStripTimer = document.getElementById('turnStripTimer');

      // Impostor Guess Word Modal
      this.impostorGuessOverlay = document.getElementById('impostorGuessOverlay');
      this.impostorGuessForm = document.getElementById('impostorGuessForm');
      this.impostorGuessInput = document.getElementById('impostorGuessInput');
      this.btnCancelImpostorGuess = document.getElementById('btnCancelImpostorGuess');

      // Voting Modal
      this.votingOverlay = document.getElementById('impostorVotingOverlay');
      this.votingCandidatesGrid = document.getElementById('votingCandidatesGrid');
      this.votingTimerDigits = document.getElementById('votingTimerDigits');
      this.votingStatusText = document.getElementById('votingStatusText');
      this.votingCountPill = document.getElementById('votingCountPill');
      this.votingResultBox = document.getElementById('votingResultBox');
      this.votingResultHeadline = document.getElementById('votingResultHeadline');
      this.votingResultDetails = document.getElementById('votingResultDetails');
      this.votingBreakdown = document.getElementById('votingBreakdown');

      // Game Over Modal
      this.gameOverOverlay = document.getElementById('impostorGameOverOverlay');
      this.winBannerTitle = document.getElementById('impostorWinTitle');
      this.winBannerIcon = document.getElementById('impostorWinIcon');
      this.winBanner = document.getElementById('impostorWinBanner');
      this.impostorAvatar = document.getElementById('impostorAvatar');
      this.impostorName = document.getElementById('impostorName');
      this.revealedSecretWord = document.getElementById('revealedSecretWord');
      this.revealedCategory = document.getElementById('revealedCategory');
      this.leaderboardList = document.getElementById('impostorLeaderboardList');
      this.playAgainBtn = document.getElementById('impostorPlayAgainBtn');

      // In-Room Mode Selector Pill
      this.roomModePill = document.getElementById('roomModeSelectorPill');
      this.roomModeIcon = document.getElementById('roomModeIcon');
      this.roomModeName = document.getElementById('roomModeName');

      // Landing Mode Selection Buttons
      this.modeBtnClassic = document.getElementById('modeBtnClassic');
      this.modeBtnImpostor = document.getElementById('modeBtnImpostor');
      this.modeTagImpostor = document.getElementById('modeTagImpostor');

      // Primary Start / Stop Game Button in Header
      this.startGameBtn = document.getElementById('startGameBtn');

      // Existing Header & Canvas Elements
      this.roundPill = document.getElementById('roundPill');
      this.gameTimerPill = document.getElementById('gameTimerPill');
      this.timerDigits = document.getElementById('timerDigits');
      this.wordLabel = document.getElementById('wordLabel');
      this.currentWordEl = document.getElementById('currentWord');
      this.drawerStatusChip = document.getElementById('drawerStatusChip');
      this.tabooGuideCard = document.getElementById('tabooGuideCard');
      this.drawerGuideCard = document.getElementById('drawerGuideCard');
      this.artToolbar = document.getElementById('artToolbar');
      this.guesserLockOverlay = document.getElementById('guesserLockOverlay');
      this.lockTitle = document.getElementById('lockTitle');
      this.lockSubtext = document.getElementById('lockSubtext');
      this.roleHelpText = document.getElementById('roleHelpText');
    }

    bindSocketEvents() {
      if (!this.socket) return;

      // 1. Role Assignment
      this.socket.on('impostor-role-assigned', (payload) => {
        this.handleRoleAssigned(payload);
      });

      // 2. Turn Start (Sequential 10s drawing turns)
      this.socket.on('impostor-turn-start', (payload) => {
        this.handleTurnStart(payload);
      });

      // 3. Synchronized 1-second Countdown Timer Tick
      this.socket.on('impostor-timer-tick', (payload) => {
        this.handleTimerTick(payload);
      });

      // 4. Voting Phase Trigger ('VOTING_PHASE')
      this.socket.on('VOTING_PHASE', (payload) => {
        this.handleVotingPhase(payload);
      });

      // 4.1 Voting Timer Tick
      this.socket.on('impostor-voting-tick', (payload) => {
        this.handleVotingTick(payload);
      });

      // 4.2 Vote Cast Update (Live tally progress)
      this.socket.on('impostor-vote-cast-update', (payload) => {
        this.handleVoteCastUpdate(payload);
      });

      // 4.3 Voting Result & Strict Majority Elimination
      this.socket.on('impostor-voting-result', (payload) => {
        this.handleVotingResult(payload);
      });

      // 5. Game Over & Final Revealed Leaderboard
      this.socket.on('GAME_OVER', (payload) => {
        if (this.isImpostorGameActive || payload.impostorUsername) {
          this.handleGameOver(payload);
        }
      });

      // 6. Game Stopped / Return to Lobby
      this.socket.on('impostor-game-stopped', (payload) => {
        this.handleGameStopped(payload);
      });

      this.socket.on('return-to-lobby', (payload) => {
        this.handleGameStopped(payload);
      });

      // State Synchronization
      this.socket.on('impostor-state-sync', (payload) => {
        this.handleStateSync(payload);
      });

      this.socket.on('room-joined', (payload) => {
        if (payload && typeof payload.isHost === 'boolean') {
          this.isRoomHost = payload.isHost;
          window.isRoomHost = payload.isHost;
        }
      });

      this.socket.on('game-state-sync', (payload) => {
        if (payload && typeof payload.isHost === 'boolean') {
          this.isRoomHost = payload.isHost;
          window.isRoomHost = payload.isHost;
        }
      });

      // Mode changed in room
      this.socket.on('game-mode-changed', (payload) => {
        this.updateModePill(payload.mode);
      });
    }

    openGuessModal() {
      if (this.impostorGuessOverlay) {
        this.impostorGuessOverlay.style.display = 'flex';
        if (this.impostorGuessInput) {
          this.impostorGuessInput.value = '';
          setTimeout(() => this.impostorGuessInput.focus(), 50);
        }
      }
    }

    bindUIEvents() {
      // Landing page Impostor mode button
      if (this.modeBtnImpostor) {
        this.modeBtnImpostor.addEventListener('click', () => {
          this.setLocalMode('impostor');
        });
      }
      if (this.modeBtnClassic) {
        this.modeBtnClassic.addEventListener('click', () => {
          this.setLocalMode('classic');
        });
      }

      // Room Header Mode Pill (Host can click to toggle between Classic and Impostor)
      if (this.roomModePill) {
        this.roomModePill.addEventListener('click', async () => {
          const isHost = Boolean(this.isRoomHost || window.isRoomHost);
          if (!isHost) {
            if (typeof window.showToast === 'function') {
              window.showToast('Only the Room Host can change game modes! 👑', 'warning', '🔒', 3000);
            }
            return;
          }

          const currentMode = this.roomModePill.dataset.mode || window.selectedGameMode || 'classic';
          const nextMode = (currentMode === 'classic') ? 'impostor' : 'classic';
          const nextModeLabel = (nextMode === 'impostor') ? '🕵️ Impostor Mode' : '🎨 Classic Mode';

          const isGameActive = (typeof window.isGameInProgress === 'function')
            ? window.isGameInProgress()
            : (this.isImpostorGameActive || window.currentPhase === 'PLAYING');

          if (isGameActive) {
            let confirmed = false;
            if (typeof window.showGameConfirmModal === 'function') {
              confirmed = await window.showGameConfirmModal({
                icon: '⚠️',
                badge: 'MATCH IN PROGRESS',
                title: 'Change Game Mode?',
                message: 'Changing the game mode will cancel the current game in progress and return everyone to the lobby.',
                targetName: nextModeLabel,
                subnote: 'Active turns and drawings will be cleared.',
                confirmText: 'Cancel Game & Switch',
                cancelText: 'Keep Playing'
              });
            } else {
              confirmed = confirm(
                `⚠️ A game is currently in progress!\n\nChanging the game mode will cancel the current game and switch the room to ${nextModeLabel}.\n\nDo you want to proceed and switch to ${nextModeLabel}?`
              );
            }
            if (!confirmed) {
              return; // Host cancelled - keep existing game running
            }
          }

          this.socket.emit('set-game-mode', { mode: nextMode });
        });
      }


      // Cancel Impostor Guess Modal
      if (this.btnCancelImpostorGuess) {
        this.btnCancelImpostorGuess.addEventListener('click', () => {
          if (this.impostorGuessOverlay) {
            this.impostorGuessOverlay.style.display = 'none';
          }
        });
      }

      // Submit Impostor Guess Form
      if (this.impostorGuessForm) {
        this.impostorGuessForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const guess = (this.impostorGuessInput?.value || '').trim();
          if (!guess) return;

          let confirmed = false;
          if (typeof window.showGameConfirmModal === 'function') {
            confirmed = await window.showGameConfirmModal({
              icon: '🕵️',
              badge: 'FINAL IMPOSTOR GUESS',
              title: 'Submit Secret Word Guess?',
              message: `Stop the game and submit "${guess.toUpperCase()}" as your final answer? If correct, you WIN immediately! If wrong, Regulars win.`,
              targetName: `"${guess.toUpperCase()}"`,
              subnote: 'This will conclude the game for all players.',
              confirmText: 'Submit & End Game',
              cancelText: 'Cancel'
            });
          } else {
            confirmed = confirm(`Stop the game and submit "${guess.toUpperCase()}" as the secret word?\n\nIf correct, you WIN! If incorrect, Regulars win.`);
          }

          if (confirmed) {
            this.socket.emit('impostor-guess-word', { guess });
            if (this.impostorGuessOverlay) {
              this.impostorGuessOverlay.style.display = 'none';
            }
          }
        });
      }

      // Play Again in Impostor Game Over
      if (this.playAgainBtn) {
        this.playAgainBtn.addEventListener('click', () => {
          this.gameOverOverlay.style.display = 'none';
          this.socket.emit('start-game', { mode: 'impostor' });
        });
      }
    }

    async setLocalMode(mode) {
      if (this.modeBtnImpostor && this.modeBtnClassic) {
        if (mode === 'impostor') {
          this.modeBtnImpostor.classList.add('mode-btn-active');
          if (this.modeTagImpostor) {
            this.modeTagImpostor.textContent = 'Active';
            this.modeTagImpostor.className = 'mode-tag mode-tag-active';
          }
          this.modeBtnClassic.classList.remove('mode-btn-active');
          const classicTag = this.modeBtnClassic.querySelector('.mode-tag');
          if (classicTag) {
            classicTag.textContent = 'Select';
            classicTag.className = 'mode-tag';
          }
        } else {
          this.modeBtnClassic.classList.add('mode-btn-active');
          const classicTag = this.modeBtnClassic.querySelector('.mode-tag');
          if (classicTag) {
            classicTag.textContent = 'Active';
            classicTag.className = 'mode-tag mode-tag-active';
          }
          this.modeBtnImpostor.classList.remove('mode-btn-active');
          if (this.modeTagImpostor) {
            this.modeTagImpostor.textContent = 'Select';
            this.modeTagImpostor.className = 'mode-tag';
          }
        }
      }
      window.selectedGameMode = mode;
      if (this.socket) {
        const isGameActive = (typeof window.isGameInProgress === 'function')
          ? window.isGameInProgress()
          : (this.isImpostorGameActive || window.currentPhase === 'PLAYING');
        if (isGameActive) {
          const isHost = Boolean(this.isRoomHost || window.isRoomHost);
          if (!isHost) {
            if (typeof window.showToast === 'function') {
              window.showToast('Only the Room Host can change game modes! 👑', 'warning', '🔒', 3000);
            }
            return;
          }
          const targetModeLabel = (mode === 'impostor') ? '🕵️ Impostor Mode' : '🎨 Classic Mode';
          let confirmed = false;
          if (typeof window.showGameConfirmModal === 'function') {
            confirmed = await window.showGameConfirmModal({
              icon: '⚠️',
              badge: 'MATCH IN PROGRESS',
              title: 'Change Game Mode?',
              message: 'Changing the game mode will cancel the current game in progress and return everyone to the lobby.',
              targetName: targetModeLabel,
              subnote: 'Active turns and drawings will be cleared.',
              confirmText: 'Cancel Game & Switch',
              cancelText: 'Keep Playing'
            });
          } else {
            confirmed = confirm(
              `⚠️ A game is currently in progress!\n\nChanging the game mode will cancel the current game and switch the room to ${targetModeLabel}.\n\nDo you want to proceed and switch to ${targetModeLabel}?`
            );
          }
          if (!confirmed) return;
        }
        this.socket.emit('set-game-mode', { mode });
      }
    }

    updateModePill(mode) {
      if (!this.roomModePill) return;
      this.roomModePill.dataset.mode = mode;
      const isHost = Boolean(this.isRoomHost || window.isRoomHost);
      this.roomModePill.title = isHost
        ? 'Switch Game Mode (Classic / Impostor)'
        : 'Game Mode (Only the host can switch)';

      if (mode === 'impostor') {
        this.roomModePill.className = 'mode-selector-pill impostor-mode';
        if (this.roomModeIcon) this.roomModeIcon.textContent = '🕵️';
        if (this.roomModeName) this.roomModeName.textContent = 'Impostor';
      } else {
        this.roomModePill.className = 'mode-selector-pill classic-mode';
        if (this.roomModeIcon) this.roomModeIcon.textContent = '🎨';
        if (this.roomModeName) this.roomModeName.textContent = 'Classic';
      }
    }

    // ========================================================================
    // 1. Role Assignment & Guidance Display
    // ========================================================================
    handleRoleAssigned(payload) {
      this.isImpostorGameActive = true;
      this.myRole = payload.role;
      this.isImpostor = payload.isImpostor;
      this.secretWord = payload.secretWord;
      this.secretCategory = payload.category;

      // Hide Classic Mode guides
      if (this.tabooGuideCard) this.tabooGuideCard.style.display = 'none';
      if (this.drawerGuideCard) this.drawerGuideCard.style.display = 'none';
      if (this.guesserLockOverlay) this.guesserLockOverlay.classList.remove('active');
      if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'none';
      if (this.impostorGuessOverlay) this.impostorGuessOverlay.style.display = 'none';

      // Update Round Banner
      if (this.roundPill) {
        this.roundPill.textContent = '🕵️ IMPOSTOR MODE';
        this.roundPill.style.display = 'inline-flex';
      }

      if (typeof payload.isHost === 'boolean') {
        this.isRoomHost = payload.isHost;
        window.isRoomHost = payload.isHost;
      }
      this.isImpostor = Boolean(payload.isImpostor);

      // Primary Start/Stop Game Button in Header (Host only)
      if (this.startGameBtn) {
        if (this.isRoomHost) {
          this.startGameBtn.textContent = '⏹ Stop Game';
          this.startGameBtn.className = 'btn-primary-action danger';
          this.startGameBtn.style.display = 'inline-flex';
          this.startGameBtn.disabled = false;
          this.startGameBtn.title = 'Stop Impostor Mode and return to lobby';
        } else {
          this.startGameBtn.style.display = 'none';
        }
      }

      if (this.isImpostor) {
        this.currentCategory = payload.category || 'General';
        // Impostor View - follows style of other players with white/none background and visible topic
        if (this.wordLabel) this.wordLabel.textContent = 'YOUR ROLE:';
        if (this.currentWordEl) {
          const cat = (payload.category || 'General').toUpperCase();
          this.currentWordEl.textContent = `🕵️ YOU ARE THE IMPOSTOR! (Topic: ${cat})`;
          this.currentWordEl.className = 'secret-word';
        }
        if (this.roleHelpText) {
          const cat = (payload.category || 'General').toUpperCase();
          this.roleHelpText.textContent = `🕵️ You are the Impostor • Topic: ${cat} (Click "Guess Word" if you deduce it!)`;
        }

        this.showDramaticRoleModal({
          isImpostor: true,
          title: 'YOU ARE THE IMPOSTOR!',
          subtitle: 'You do not know the secret word.',
          instruction: 'Watch what everyone else draws, pretend you know the word, and blend in! Click "Guess Word" anytime to stop the game and steal the win!',
          category: payload.category
        });
      } else {
        // Regular Player View
        if (this.wordLabel) this.wordLabel.textContent = 'SECRET WORD:';
        if (this.currentWordEl) {
          this.currentWordEl.textContent = `${payload.secretWord.toUpperCase()} (${payload.category})`;
          this.currentWordEl.className = 'secret-word';
        }
        if (this.roleHelpText) {
          this.roleHelpText.textContent = `🎨 Secret: ${payload.secretWord.toUpperCase()} • Take turns adding strokes & identify the Impostor!`;
        }

        this.showDramaticRoleModal({
          isImpostor: false,
          title: 'YOU ARE A REGULAR PLAYER',
          subtitle: `Secret Word: ${payload.secretWord.toUpperCase()}`,
          instruction: 'Take turns drawing clues for the word without making it too obvious for the Impostor!',
          category: payload.category
        });
      }

      // Lock canvas until turn begins
      this.setCanvasInteractivity(false, 'Preparing drawing phase...');
    }

    showDramaticRoleModal(data) {
      const modal = document.createElement('div');
      modal.className = `impostor-role-flash-modal ${data.isImpostor ? 'impostor' : 'regular'}`;
      modal.innerHTML = `
        <div class="role-flash-card">
          <div class="role-flash-icon">${data.isImpostor ? '🕵️' : '🎨'}</div>
          <span class="role-flash-badge">${data.isImpostor ? 'SECRET ASSIGNMENT' : 'TEAM REGULARS'}</span>
          <h2 class="role-flash-title">${data.title}</h2>
          <p class="role-flash-sub">${data.subtitle}</p>
          <div class="role-flash-box">
            <span class="category-tag">Category: ${data.category || 'General'}</span>
            <p class="role-flash-inst">${data.instruction}</p>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      setTimeout(() => {
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 400);
      }, 2500);
    }

    // ========================================================================
    // 2. Turn Queue & Canvas Lock/Unlock
    // ========================================================================
    handleTurnStart(payload) {
      this.isImpostorGameActive = true;
      this.activePlayerId = payload.activePlayerId;
      this.isMyTurn = (payload.activePlayerId === this.socket.id);
      this.turnTimeLeft = payload.timeLeft;

      // Close voting overlay if still open
      if (this.votingOverlay) {
        this.votingOverlay.style.display = 'none';
      }

      // Update Round and Rotation Pill
      if (this.roundPill) {
        this.roundPill.textContent = `ROTATION ${payload.rotation}/${payload.totalRotations}`;
        this.roundPill.style.display = 'inline-flex';
      }

      // Ensure Stop Game button is displayed in header (Host only)
      if (this.startGameBtn) {
        if (this.isRoomHost) {
          this.startGameBtn.textContent = '⏹ Stop Game';
          this.startGameBtn.className = 'btn-primary-action danger';
          this.startGameBtn.style.display = 'inline-flex';
          this.startGameBtn.disabled = false;
          this.startGameBtn.title = 'Stop Impostor Mode and return to lobby';
        } else {
          this.startGameBtn.style.display = 'none';
        }
      }

      // Synchronize timer digits
      if (this.gameTimerPill) this.gameTimerPill.style.display = 'flex';
      if (this.timerDigits) this.timerDigits.textContent = `${payload.timeLeft}s`;

      // Update Turn Strip
      if (this.turnStrip) {
        this.turnStrip.style.display = 'flex';
        if (this.isMyTurn) {
          this.turnStrip.className = 'impostor-turn-strip my-turn';
          if (this.turnStripIcon) this.turnStripIcon.textContent = '✏️';
          if (this.turnStripText) this.turnStripText.textContent = 'YOUR TURN TO DRAW!';
        } else {
          this.turnStrip.className = 'impostor-turn-strip waiting-turn';
          if (this.turnStripIcon) this.turnStripIcon.textContent = '🔒';
          if (this.turnStripText) this.turnStripText.textContent = `${payload.activeUsername} is drawing...`;
        }
        if (this.turnStripTimer) this.turnStripTimer.textContent = `${payload.timeLeft}s`;
      }

      // Update Drawer status chip
      if (this.drawerStatusChip) {
        this.drawerStatusChip.style.display = 'inline-flex';
        this.drawerStatusChip.textContent = this.isMyTurn
          ? '🎨 YOUR TURN! Draw on the shared canvas!'
          : `👀 ${payload.activeUsername} is sketching...`;
        this.drawerStatusChip.className = this.isMyTurn
          ? 'drawer-status-chip is-drawing'
          : 'drawer-status-chip';
      }

      // Canvas Write Access & Interactivity Control:
      this.setCanvasInteractivity(this.isMyTurn, `${payload.activeUsername} is sketching...`);

      // On smartphones, automatically transition to canvas view so player can draw immediately
      if (this.isMyTurn && typeof window.autoSwitchToCanvasOnMyTurn === 'function') {
        window.autoSwitchToCanvasOnMyTurn();
      }
    }

    setCanvasInteractivity(canDraw, waitingMessage = 'Waiting for your turn...') {
      // Toggle toolbar visibility and disabled state
      if (this.artToolbar) {
        if (canDraw) {
          this.artToolbar.style.display = 'flex';
          this.artToolbar.classList.remove('disabled');
        } else {
          this.artToolbar.style.display = 'none';
          this.artToolbar.classList.add('disabled');
        }
      }

      // Guesser/Lock Overlay
      if (this.guesserLockOverlay) {
        if (canDraw) {
          this.guesserLockOverlay.classList.remove('active');
        } else {
          this.guesserLockOverlay.classList.add('active');
          if (this.lockTitle) {
            this.lockTitle.textContent = waitingMessage;
          }
        }
      }

      // Callback to main client.js to set internal canDraw flag
      if (typeof this.onCanvasLockChange === 'function') {
        this.onCanvasLockChange(canDraw);
      }
    }

    handleTimerTick(payload) {
      this.turnTimeLeft = payload.timeLeft;
      if (this.timerDigits) {
        this.timerDigits.textContent = `${payload.timeLeft}s`;
      }
      if (this.turnStripTimer) {
        this.turnStripTimer.textContent = `${payload.timeLeft}s`;
      }
      if (payload.timeLeft <= 3 && payload.timeLeft > 0 && this.isMyTurn) {
        if (this.turnStrip) this.turnStrip.classList.add('urgent-pulse');
      }
    }

    // ========================================================================
    // 3. Voting Phase Overlay & Strict Majority Elimination
    // ========================================================================
    handleVotingPhase(payload) {
      this.isImpostorGameActive = true;
      this.votingTimeLeft = payload.duration;
      this.selectedVoteTarget = null;
      this.hasVoted = false;

      // Lock canvas for all during voting
      this.setCanvasInteractivity(false, 'Voting in progress...');
      if (this.turnStrip) this.turnStrip.style.display = 'none';

      // Update Round pill
      if (this.roundPill) {
        this.roundPill.textContent = `🗳️ VOTING ROUND ${payload.votingRound}`;
        this.roundPill.style.display = 'inline-flex';
      }



      // Reset voting UI containers
      if (this.votingResultBox) this.votingResultBox.style.display = 'none';
      if (this.votingCandidatesGrid) this.votingCandidatesGrid.style.display = 'grid';
      if (this.votingStatusBar) this.votingStatusBar.style.display = 'flex';

      if (this.votingTimerDigits) {
        this.votingTimerDigits.textContent = `${payload.duration}s`;
      }
      if (this.votingCountPill) {
        this.votingCountPill.textContent = `0 / ${payload.activeCount} voted`;
      }
      if (this.votingStatusText) {
        this.votingStatusText.textContent = 'Click on a suspect to cast your vote:';
      }

      // Render Candidate Cards
      this.renderCandidateCards(payload.candidates);

      // Show Voting Overlay
      if (this.votingOverlay) {
        this.votingOverlay.style.display = 'flex';
      }
    }

    renderCandidateCards(candidates) {
      if (!this.votingCandidatesGrid) return;
      this.votingCandidatesGrid.innerHTML = '';

      candidates.forEach(cand => {
        const isSelf = (cand.id === this.socket.id);
        const card = document.createElement('div');
        card.className = `voting-candidate-card ${isSelf ? 'is-self' : ''}`;
        card.dataset.candidateId = cand.id;

        card.innerHTML = `
          <div class="candidate-avatar-wrap" style="--cand-color: ${cand.color || '#666'};">
            <span class="candidate-avatar-initial">${(cand.username || 'P').charAt(0).toUpperCase()}</span>
          </div>
          <div class="candidate-info">
            <span class="candidate-name">${escapeHTML(cand.username)}</span>
            ${isSelf ? '<span class="candidate-self-badge">You</span>' : ''}
          </div>
          <button type="button" class="btn-cast-vote ${isSelf ? 'disabled' : ''}" ${isSelf ? 'disabled' : ''}>
            ${isSelf ? 'Cannot vote self' : 'Vote Impostor'}
          </button>
        `;

        if (!isSelf) {
          const voteBtn = card.querySelector('.btn-cast-vote');
          voteBtn.addEventListener('click', () => {
            this.castVote(cand.id, cand.username, card);
          });
        }

        this.votingCandidatesGrid.appendChild(card);
      });
    }

    castVote(targetId, targetUsername, cardElement) {
      if (this.hasVoted) return;

      this.selectedVoteTarget = targetId;
      this.hasVoted = true;

      // Update card UI
      const allCards = this.votingCandidatesGrid.querySelectorAll('.voting-candidate-card');
      allCards.forEach(c => {
        c.classList.remove('selected');
        const b = c.querySelector('.btn-cast-vote');
        if (b && !c.classList.contains('is-self')) {
          b.disabled = true;
          b.textContent = 'Vote';
        }
      });

      cardElement.classList.add('selected');
      const activeBtn = cardElement.querySelector('.btn-cast-vote');
      if (activeBtn) {
        activeBtn.textContent = '✓ Voted';
        activeBtn.classList.add('voted-success');
      }

      if (this.votingStatusText) {
        this.votingStatusText.textContent = `You voted for ${targetUsername}! Waiting for remaining votes...`;
      }

      // Emit vote to server
      this.socket.emit('cast-vote', { targetId });
    }

    handleVotingTick(payload) {
      this.votingTimeLeft = payload.timeLeft;
      if (this.votingTimerDigits) {
        this.votingTimerDigits.textContent = `${payload.timeLeft}s`;
      }
      if (this.votingCountPill) {
        this.votingCountPill.textContent = `${payload.votesCast} / ${payload.totalEligible} voted`;
      }
    }

    handleVoteCastUpdate(payload) {
      if (this.votingCountPill) {
        this.votingCountPill.textContent = `${payload.votesCast} / ${payload.totalEligible} voted`;
      }
    }

    // ========================================================================
    // 4. Voting Results & Strict Majority Elimination
    // ========================================================================
    handleVotingResult(payload) {
      // Hide candidate buttons and show results box
      if (this.votingCandidatesGrid) this.votingCandidatesGrid.style.display = 'none';
      if (this.votingStatusBar) this.votingStatusBar.style.display = 'none';

      if (this.votingResultBox) {
        this.votingResultBox.style.display = 'block';

        if (payload.eliminated) {
          if (payload.wasImpostor) {
            // Eliminated player was Impostor!
            this.votingResultBox.className = 'voting-result-box impostor-eliminated';
            this.votingResultHeadline.textContent = `🎯 ${payload.eliminated.username} WAS THE IMPOSTOR!`;
            this.votingResultDetails.textContent = `Strict majority (${payload.votesCount}/${payload.totalVoters} votes) identified the Impostor! Regulars win!`;
          } else {
            // Eliminated player was innocent!
            this.votingResultBox.className = 'voting-result-box innocent-eliminated';
            this.votingResultHeadline.textContent = `❌ ${payload.eliminated.username} was NOT the Impostor!`;
            this.votingResultDetails.textContent = `An innocent player was eliminated! (${payload.eliminatedNonImpostorsCount}/3 innocents eliminated). Impostor survived!`;
          }
        } else {
          // No strict majority
          this.votingResultBox.className = 'voting-result-box no-majority';
          this.votingResultHeadline.textContent = '⚖️ No Strict Majority Reached';
          this.votingResultDetails.textContent = payload.reason || 'No player received more than half of the votes. No one was eliminated! The Impostor survives another round!';
        }

        // Render vote breakdown pills
        if (this.votingBreakdown && Array.isArray(payload.voteDetails)) {
          this.votingBreakdown.innerHTML = '';
          payload.voteDetails.forEach(v => {
            const pill = document.createElement('span');
            pill.className = 'vote-tally-pill';
            pill.innerHTML = `<strong>${escapeHTML(v.voterName)}</strong> voted for <em>${escapeHTML(v.targetName)}</em>`;
            this.votingBreakdown.appendChild(pill);
          });
        }
      }
    }

    // ========================================================================
    // 5. Concluding 'GAME_OVER' Leaderboard
    // ========================================================================
    handleGameOver(payload) {
      this.isImpostorGameActive = false;
      this.setCanvasInteractivity(false, 'Game Over');

      if (this.turnStrip) this.turnStrip.style.display = 'none';
      if (this.votingOverlay) this.votingOverlay.style.display = 'none';
      if (this.impostorGuessOverlay) this.impostorGuessOverlay.style.display = 'none';

      const isRegularWin = (payload.winner === 'REGULARS');

      if (this.winBanner) {
        this.winBanner.className = isRegularWin
          ? 'impostor-win-banner regulars-win'
          : 'impostor-win-banner impostor-win';
      }
      if (this.winBannerIcon) {
        this.winBannerIcon.textContent = isRegularWin ? '🏆' : '🕵️';
      }
      if (this.winBannerTitle) {
        this.winBannerTitle.textContent = isRegularWin
          ? 'REGULARS WIN!'
          : 'THE IMPOSTOR WINS!';
      }

      // Impostor Identity Reveal
      if (this.impostorName) {
        this.impostorName.textContent = payload.impostorUsername || 'Unknown';
      }
      if (this.revealedSecretWord) {
        this.revealedSecretWord.textContent = (payload.secretWord || '***').toUpperCase();
      }
      if (this.revealedCategory) {
        this.revealedCategory.textContent = payload.secretCategory || 'General';
      }

      // Render Revealed Leaderboard
      if (this.leaderboardList && Array.isArray(payload.leaderboard)) {
        this.leaderboardList.innerHTML = '';

        payload.leaderboard.forEach((player, index) => {
          const row = document.createElement('div');
          const isPlayerImpostor = (player.role === 'IMPOSTOR');
          row.className = `leaderboard-player-row rank-${index + 1} ${isPlayerImpostor ? 'is-impostor-row' : ''}`;

          let rankBadge = `${index + 1}`;
          if (index === 0) rankBadge = '🥇';
          else if (index === 1) rankBadge = '🥈';
          else if (index === 2) rankBadge = '🥉';

          const bd = player.breakdown || {};
          let breakdownText = '';
          if (isPlayerImpostor) {
            breakdownText = `Survival: +${bd.survivalBonus || 0} pts • Win Bonus: +${bd.winBonus || 0} pts`;
          } else {
            breakdownText = `Accuracy: +${bd.correctVotes || 0} pts • Win Bonus: +${bd.winBonus || 0} pts • Penalties: -${bd.penalties || 0} pts`;
          }

          row.innerHTML = `
            <div class="lb-rank">${rankBadge}</div>
            <div class="lb-user-info">
              <span class="lb-user-name">${escapeHTML(player.username)}</span>
              <span class="lb-role-tag ${isPlayerImpostor ? 'tag-impostor' : 'tag-regular'}">
                ${isPlayerImpostor ? '🕵️ Impostor' : '👥 Regular'}
              </span>
              <div class="lb-breakdown">${breakdownText}</div>
            </div>
            <div class="lb-score-wrap">
              <span class="lb-score-val">${player.score}</span>
              <span class="lb-score-label">pts</span>
            </div>
          `;

          this.leaderboardList.appendChild(row);
        });
      }

      // Show modal
      if (this.gameOverOverlay) {
        this.gameOverOverlay.style.display = 'flex';
      }
    }

    // ========================================================================
    // 6. Stop Game / Return to Lobby Handler
    // ========================================================================
    handleGameStopped(payload) {
      this.isImpostorGameActive = false;
      this.selectedVoteTarget = null;
      this.hasVoted = false;

      // Hide all overlays
      if (this.turnStrip) this.turnStrip.style.display = 'none';
      if (this.votingOverlay) this.votingOverlay.style.display = 'none';
      if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'none';


      // Reset banner headers
      if (this.roundPill) this.roundPill.textContent = 'LOBBY';
      if (this.wordLabel) this.wordLabel.textContent = 'Prompt:';
      if (this.currentWordEl) {
        this.currentWordEl.textContent = '🎨 Free Draw Mode';
        this.currentWordEl.className = 'secret-word';
      }
      if (this.drawerStatusChip) this.drawerStatusChip.style.display = 'none';
      if (this.gameTimerPill) this.gameTimerPill.style.display = 'none';

      // Restore free canvas drawing
      this.setCanvasInteractivity(true, 'Free Draw Mode');

      // Reset Start/Stop button
      if (this.startGameBtn) {
        if (this.isRoomHost) {
          this.startGameBtn.textContent = '▶ Start Game';
          this.startGameBtn.className = 'btn-primary-action';
          this.startGameBtn.style.display = 'inline-flex';
          this.startGameBtn.disabled = false;
        } else {
          this.startGameBtn.textContent = '👑 Waiting for Host...';
          this.startGameBtn.className = 'btn-primary-action waiting-host';
          this.startGameBtn.style.display = 'inline-flex';
          this.startGameBtn.disabled = true;
        }
      }
    }

    handleStateSync(state) {
      if (!state) return;
      this.isRoomHost = Boolean(state.isHost);

      // Keep Start/Stop button updated for Host only
      if (this.isImpostorGameActive) {
        if (this.startGameBtn) {
          if (this.isRoomHost) {
            this.startGameBtn.textContent = '⏹ Stop Game';
            this.startGameBtn.className = 'btn-primary-action danger';
            this.startGameBtn.style.display = 'inline-flex';
            this.startGameBtn.disabled = false;
          } else {
            this.startGameBtn.style.display = 'none';
          }
        }
      }

      if (this.playAgainBtn) {
        this.playAgainBtn.style.display = this.isRoomHost ? 'inline-block' : 'none';
      }
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose globally for pairing with client.js
  window.ImpostorClientManager = ImpostorClientManager;
})();

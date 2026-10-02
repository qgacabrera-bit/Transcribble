/**
 * ============================================================================
 * ImpostorMode - State Machine & Game Engine for Impostor Drawing Mode
 * ============================================================================
 * 
 * Rules & State Machine Architecture:
 * 1. Role Assignment & Initialization:
 *    - 1 player randomly assigned "Impostor", remaining are "Regulars".
 *    - Regulars receive secret word + category.
 *    - Impostor receives: "You are the impostor, try to blend in with the players."
 *    - Hidden scoring initialized on server.
 * 2. Collaborative Turn-Based Drawing:
 *    - Players share a single canvas and take sequential 10-second turns.
 *    - Only the active player has canvas write access; others are locked read-only.
 *    - Synchronized countdown timer ticks to all clients.
 *    - Phase 1 lasts for 2 full rotations (each active player draws twice).
 * 3. Voting Phase:
 *    - Triggered after required drawing rotations ('VOTING_PHASE' event).
 *    - All active players cast 1 vote for the suspected Impostor within time limit.
 *    - Strict majority tallying (> 50% of active voters).
 * 4. Elimination & Progressive Rounds:
 *    - If eliminated player IS Impostor: Game over, Regulars win!
 *    - If eliminated player is NOT Impostor:
 *      * Regulars penalized (-80 pts to hidden score).
 *      * Impostor gets scaling survival points (+200 * votingRound).
 *      * If 3 non-impostors eliminated total: Game over, Impostor wins!
 *    - If game continues: start a new drawing phase with remaining players (lasts 1 rotation).
 * 5. Hidden Scoring:
 *    - Hidden until concluding 'GAME_OVER' broadcast.
 *    - Impostor scales by rounds survived.
 *    - Regulars get partial points (+150 pts) whenever voting for the true Impostor,
 *      even if group majority eliminated an innocent.
 */

const IMPOSTOR_STATES = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLE_REVEAL',
  DRAWING_TURN: 'DRAWING_TURN',
  VOTING_PHASE: 'VOTING_PHASE',
  VOTING_RESULT: 'VOTING_RESULT',
  GAME_OVER: 'GAME_OVER'
};

const { getRandomCard, getAllCards } = require('./wordBank');
const IMPOSTOR_WORDS = getAllCards();

const CONFIG = {
  TURN_SECONDS: 10,
  FIRST_PHASE_ROTATIONS: 2,
  SUBSEQUENT_PHASE_ROTATIONS: 1,
  VOTING_SECONDS: 20,
  RESULT_DISPLAY_SECONDS: 4,
  MAX_INNOCENT_ELIMINATIONS: 3,

  // Scoring weights
  IMPOSTOR_SURVIVAL_BASE: 200,      // Multiplied by votingRound
  IMPOSTOR_WIN_BONUS: 500,
  REGULAR_ACCURACY_POINTS: 150,     // Awarded whenever a player voted for the true Impostor
  REGULAR_WIN_BONUS: 400,
  INNOCENT_PENALTY: 80              // Deducted from Regulars on wrong elimination
};

class ImpostorGame {
  /**
   * @param {Object} room - The Room object from server.js
   * @param {Object} io - The Socket.IO server instance
   */
  constructor(room, io) {
    this.room = room;
    this.io = io;

    this.state = IMPOSTOR_STATES.LOBBY;
    this.secretWord = '';
    this.secretCategory = '';

    this.impostorId = null;
    this.impostorUsername = '';

    // playerMap: socketId -> PlayerData
    this.players = new Map();
    // activeQueue: array of socketIds of players still in the drawing/voting pool
    this.activeQueue = [];
    this.currentTurnIndex = 0;

    this.currentRotation = 1;
    this.requiredRotations = CONFIG.FIRST_PHASE_ROTATIONS;
    this.turnsInCurrentRotation = 0;

    this.votingRound = 0;
    this.eliminatedNonImpostorsCount = 0;
    // Map of voterSocketId -> targetSocketId
    this.currentVotes = new Map();

    this.timer = null;
    this.timeLeft = 0;
    this.totalTime = 0;
  }

  // ==========================================================================
  // 1. Role Assignment & Initialization
  // ==========================================================================
  start() {
    this.cleanup();

    // 1. Filter active connected players
    const activeEntries = Array.from(this.room.connectedUsers.entries())
      .filter(([_, user]) => !user.disconnected);

    if (activeEntries.length < 2) {
      this.io.to(this.room.id).emit('notification', {
        id: 'notif_' + Date.now(),
        text: 'Need at least 2 players to start Impostor Mode!',
        type: 'warning',
        icon: '⚠️',
        duration: 3500
      });
      return false;
    }

    // 2. Select Secret Word (avoiding recent repeats per room)
    if (!this.room.usedWords) this.room.usedWords = new Set();
    const card = getRandomCard(this.room.usedWords);
    this.secretWord = card.word;
    this.secretCategory = card.category;

    // 3. Pick random player as Impostor
    const impostorIndex = Math.floor(Math.random() * activeEntries.length);
    this.impostorId = activeEntries[impostorIndex][0];
    this.impostorUsername = activeEntries[impostorIndex][1].username;

    // 4. Initialize player metadata & hidden scoring
    this.players.clear();
    this.activeQueue = [];

    activeEntries.forEach(([socketId, user]) => {
      const isImpostor = (socketId === this.impostorId);
      this.players.set(socketId, {
        id: socketId,
        username: user.username,
        color: user.color,
        role: isImpostor ? 'IMPOSTOR' : 'REGULAR',
        isEliminated: false,
        hiddenScore: 0,
        scoreBreakdown: {
          survivalBonus: 0,
          correctVotes: 0,
          penalties: 0,
          winBonus: 0
        }
      });
      this.activeQueue.push(socketId);
      user.role = isImpostor ? 'IMPOSTOR' : 'REGULAR';
      user.score = 0; // Displayed score stays 0 or hidden during the game
    });

    this.currentTurnIndex = 0;
    this.currentRotation = 1;
    this.requiredRotations = CONFIG.FIRST_PHASE_ROTATIONS;
    this.turnsInCurrentRotation = 0;
    this.votingRound = 0;
    this.eliminatedNonImpostorsCount = 0;
    this.state = IMPOSTOR_STATES.ROLE_REVEAL;

    // 5. Clear shared canvas for new cooperative drawing round
    this.room.drawingHistory = [];
    this.io.to(this.room.id).emit('clear-canvas', { clearedBy: 'System' });

    console.log(`[Impostor Mode] Started in room ${this.room.id}. Impostor: ${this.impostorUsername}. Word: ${this.secretWord}`);

    // 6. Emit role assignments according to Instructions.md specifications:
    //    - Emit secret word to all Regulars
    //    - Emit specific payload to Impostor: "You are the impostor, try to blend in with the players."
    this.players.forEach((p, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) return;

      const isHost = (this.room.hostId === socketId);

      if (p.role === 'IMPOSTOR') {
        socket.emit('impostor-role-assigned', {
          role: 'IMPOSTOR',
          isImpostor: true,
          isHost,
          hostId: this.room.hostId,
          secretWord: null,
          category: this.secretCategory,
          message: 'You are the impostor, try to blend in with the players.'
        });
      } else {
        socket.emit('impostor-role-assigned', {
          role: 'REGULAR',
          isImpostor: false,
          isHost,
          hostId: this.room.hostId,
          secretWord: this.secretWord,
          category: this.secretCategory,
          message: `Secret Word: ${this.secretWord.toUpperCase()} (${this.secretCategory}). Coordinate & spot the Impostor!`
        });
      }
    });

    // Notify room of game start
    this.io.to(this.room.id).emit('notification', {
      id: 'notif_' + Date.now(),
      text: '🕵️ Impostor Mode Started! One player has no clue what the word is!',
      type: 'info',
      icon: '🕵️',
      duration: 4000
    });

    // Synchronize room state
    this.syncRoomState();

    // Give players 2.5 seconds to read their role, then begin Drawing Loop
    this.timer = setTimeout(() => {
      this.startDrawingPhase(CONFIG.FIRST_PHASE_ROTATIONS);
    }, 2500);

    return true;
  }

  // ==========================================================================
  // 2. Turn-Based Drawing Loop
  // ==========================================================================
  startDrawingPhase(rotationsRequired) {
    if (this.state === IMPOSTOR_STATES.GAME_OVER) return;

    this.state = IMPOSTOR_STATES.DRAWING_TURN;
    this.requiredRotations = rotationsRequired;
    this.currentRotation = 1;
    this.turnsInCurrentRotation = 0;
    this.currentTurnIndex = 0;

    this.io.to(this.room.id).emit('notification', {
      id: 'notif_' + Date.now(),
      text: `🎨 Drawing Phase: ${this.requiredRotations} rotation(s). 10 seconds per turn!`,
      type: 'info',
      icon: '✏️',
      duration: 3000
    });

    this.startNextTurn();
  }

  startNextTurn() {
    this.clearTimer();

    // Verify there are active players
    if (this.activeQueue.length === 0) {
      this.endGame('IMPOSTOR', 'No active players remaining.');
      return;
    }

    // Safety clamp on index
    if (this.currentTurnIndex >= this.activeQueue.length) {
      this.currentTurnIndex = 0;
    }

    const activeSocketId = this.activeQueue[this.currentTurnIndex];
    const activePlayer = this.players.get(activeSocketId);

    // Skip disconnected or nonexistent players
    if (!activePlayer) {
      this.activeQueue.splice(this.currentTurnIndex, 1);
      this.startNextTurn();
      return;
    }

    this.timeLeft = CONFIG.TURN_SECONDS;
    this.totalTime = CONFIG.TURN_SECONDS;

    console.log(`[Impostor Turn] Player: ${activePlayer.username} (${this.currentTurnIndex + 1}/${this.activeQueue.length}) - Rot: ${this.currentRotation}/${this.requiredRotations}`);

    // Broadcast turn start to all clients
    // Client locks canvas for all players EXCEPT activeSocketId
    this.io.to(this.room.id).emit('impostor-turn-start', {
      activePlayerId: activeSocketId,
      activeUsername: activePlayer.username,
      activeColor: activePlayer.color,
      timeLeft: this.timeLeft,
      totalTime: this.totalTime,
      rotation: this.currentRotation,
      totalRotations: this.requiredRotations,
      turnIndex: this.currentTurnIndex,
      activePlayersCount: this.activeQueue.length,
      queue: this.activeQueue.map(id => {
        const p = this.players.get(id);
        return { id, username: p ? p.username : 'Player', color: p ? p.color : '#666' };
      })
    });

    this.syncRoomState();

    // Synchronized 1-second countdown timer
    this.timer = setInterval(() => {
      this.timeLeft--;

      this.io.to(this.room.id).emit('impostor-timer-tick', {
        timeLeft: this.timeLeft,
        totalTime: this.totalTime,
        activePlayerId: activeSocketId
      });

      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.handleTurnComplete();
      }
    }, 1000);
  }

  handleTurnComplete() {
    this.clearTimer();
    this.turnsInCurrentRotation++;

    // Check if current rotation is complete
    if (this.turnsInCurrentRotation >= this.activeQueue.length) {
      console.log(`[Impostor Rotation] Completed rotation ${this.currentRotation} of ${this.requiredRotations}`);

      if (this.currentRotation >= this.requiredRotations) {
        // Required rotations finished! Proceed to Voting Phase
        this.startVotingPhase();
        return;
      } else {
        // Move to next rotation
        this.currentRotation++;
        this.turnsInCurrentRotation = 0;
        this.currentTurnIndex = 0;
      }
    } else {
      // Advance to next active player in current rotation
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.activeQueue.length;
    }

    this.startNextTurn();
  }

  // ==========================================================================
  // 3. Voting Phase
  // ==========================================================================
  startVotingPhase() {
    this.clearTimer();
    this.state = IMPOSTOR_STATES.VOTING_PHASE;
    this.votingRound++;
    this.currentVotes.clear();

    this.timeLeft = CONFIG.VOTING_SECONDS;
    this.totalTime = CONFIG.VOTING_SECONDS;

    // List of eligible candidates (all active, non-eliminated players)
    const candidates = this.activeQueue.map(id => {
      const p = this.players.get(id);
      return {
        id,
        username: p ? p.username : 'Player',
        color: p ? p.color : '#888'
      };
    });

    console.log(`[Impostor Voting] Starting Voting Phase #${this.votingRound} with ${candidates.length} candidates.`);

    // Instructions.md: "trigger a 'VOTING_PHASE' event. On client, overlay a Voting UI showing all active players."
    this.io.to(this.room.id).emit('VOTING_PHASE', {
      duration: this.timeLeft,
      votingRound: this.votingRound,
      candidates,
      activeCount: this.activeQueue.length
    });

    this.io.to(this.room.id).emit('notification', {
      id: 'notif_' + Date.now(),
      text: `🗳️ Voting Round ${this.votingRound}: Identify and vote out the Impostor!`,
      type: 'warning',
      icon: '🗳️',
      duration: 3500
    });

    this.syncRoomState();

    // Voting timer interval
    this.timer = setInterval(() => {
      this.timeLeft--;

      this.io.to(this.room.id).emit('impostor-voting-tick', {
        timeLeft: this.timeLeft,
        totalTime: this.totalTime,
        votesCast: this.currentVotes.size,
        totalEligible: this.activeQueue.length
      });

      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.tallyVotes();
      }
    }, 1000);
  }

  /**
   * Cast a vote by an active player
   * @param {string} voterId - Socket ID of voter
   * @param {string} targetId - Socket ID of candidate voted for
   */
  castVote(voterId, targetId) {
    if (this.state !== IMPOSTOR_STATES.VOTING_PHASE) return false;

    // Voter must be in active queue
    if (!this.activeQueue.includes(voterId)) return false;

    // Target must be in active queue
    if (!this.activeQueue.includes(targetId)) return false;

    // Record vote
    this.currentVotes.set(voterId, targetId);

    const voter = this.players.get(voterId);
    console.log(`[Impostor Vote] ${voter ? voter.username : voterId} voted. (${this.currentVotes.size}/${this.activeQueue.length})`);

    // Broadcast updated vote count (without revealing votes yet)
    this.io.to(this.room.id).emit('impostor-vote-cast-update', {
      votesCast: this.currentVotes.size,
      totalEligible: this.activeQueue.length,
      voterId
    });

    // If all eligible players cast their vote, tally immediately
    if (this.currentVotes.size >= this.activeQueue.length) {
      this.clearTimer();
      this.tallyVotes();
    }

    return true;
  }

  // ==========================================================================
  // 4. Elimination & Progressive Rounds + 5. Scoring Logic
  // ==========================================================================
  tallyVotes() {
    this.clearTimer();
    this.state = IMPOSTOR_STATES.VOTING_RESULT;

    const totalEligibleVoters = this.activeQueue.length;
    const voteTallies = new Map(); // targetId -> count

    this.activeQueue.forEach(id => voteTallies.set(id, 0));

    // Count votes
    for (const [_, targetId] of this.currentVotes.entries()) {
      if (voteTallies.has(targetId)) {
        voteTallies.set(targetId, voteTallies.get(targetId) + 1);
      }
    }

    // Determine candidate with highest votes
    let topCandidateId = null;
    let maxVotes = 0;
    let isTie = false;

    for (const [candId, count] of voteTallies.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        topCandidateId = candId;
        isTie = false;
      } else if (count === maxVotes && count > 0) {
        isTie = true;
      }
    }

    // Instructions.md: "If a player receives a strict majority, they are eliminated from the active queue."
    // Strict majority means strictly more than half of the eligible voters (> 50%).
    const strictMajorityThreshold = Math.floor(totalEligibleVoters / 2);
    const hasStrictMajority = !isTie && (maxVotes > strictMajorityThreshold);

    console.log(`[Impostor Tally] Round ${this.votingRound}. Top: ${topCandidateId} (${maxVotes} votes / ${totalEligibleVoters} voters). Threshold: > ${strictMajorityThreshold}. Strict Majority: ${hasStrictMajority}`);

    // Award partial points to Regulars who voted for the true Impostor
    // Instructions.md: "Regular player scoring: Award partial points if a player voted for the Impostor,
    // even if the group majority eliminated the wrong person."
    for (const [voterId, targetId] of this.currentVotes.entries()) {
      if (targetId === this.impostorId && voterId !== this.impostorId) {
        const voterData = this.players.get(voterId);
        if (voterData) {
          voterData.hiddenScore += CONFIG.REGULAR_ACCURACY_POINTS;
          voterData.scoreBreakdown.correctVotes += CONFIG.REGULAR_ACCURACY_POINTS;
        }
      }
    }

    // Compile vote details for client overlay
    const voteDetails = [];
    this.currentVotes.forEach((targetId, voterId) => {
      const v = this.players.get(voterId);
      const t = this.players.get(targetId);
      if (v && t) {
        voteDetails.push({
          voterId,
          voterName: v.username,
          targetId,
          targetName: t.username
        });
      }
    });

    let eliminatedPlayer = null;

    if (hasStrictMajority && topCandidateId) {
      eliminatedPlayer = this.players.get(topCandidateId);
    }

    // ------------------------------------------------------------------------
    // CASE A: A player was eliminated by strict majority
    // ------------------------------------------------------------------------
    if (eliminatedPlayer) {
      const wasImpostor = (eliminatedPlayer.id === this.impostorId);

      // Remove from active queue
      this.activeQueue = this.activeQueue.filter(id => id !== eliminatedPlayer.id);
      eliminatedPlayer.isEliminated = true;

      // Instructions.md Section 4:
      // "If the eliminated player IS the Impostor: The game ends, Regulars win."
      if (wasImpostor) {
        // Award Regulars win bonus
        this.players.forEach(p => {
          if (p.role === 'REGULAR') {
            p.hiddenScore += CONFIG.REGULAR_WIN_BONUS;
            p.scoreBreakdown.winBonus += CONFIG.REGULAR_WIN_BONUS;
          }
        });

        this.io.to(this.room.id).emit('impostor-voting-result', {
          eliminated: {
            id: eliminatedPlayer.id,
            username: eliminatedPlayer.username,
            color: eliminatedPlayer.color
          },
          votesCount: maxVotes,
          totalVoters: totalEligibleVoters,
          wasImpostor: true,
          voteDetails,
          reason: `Strict majority (${maxVotes}/${totalEligibleVoters}) voted out ${eliminatedPlayer.username}! They WERE the Impostor!`
        });

        // 3-second delay to view elimination result, then trigger GAME_OVER
        this.timer = setTimeout(() => {
          this.endGame('REGULARS', `Regulars identified and eliminated the Impostor (${eliminatedPlayer.username})!`);
        }, CONFIG.RESULT_DISPLAY_SECONDS * 1000);
        return;
      }

      // "If the eliminated player is NOT the Impostor: Apply a penalty to the Regulars' hidden scores,
      // and award bonus survival points to the Impostor."
      this.eliminatedNonImpostorsCount++;

      // Impostor scaling survival bonus
      const impostorSurvivalBonus = CONFIG.IMPOSTOR_SURVIVAL_BASE * this.votingRound;
      const impostorData = this.players.get(this.impostorId);
      if (impostorData) {
        impostorData.hiddenScore += impostorSurvivalBonus;
        impostorData.scoreBreakdown.survivalBonus += impostorSurvivalBonus;
      }

      // Penalty to Regulars' hidden scores
      this.players.forEach(p => {
        if (p.role === 'REGULAR') {
          p.hiddenScore = Math.max(0, p.hiddenScore - CONFIG.INNOCENT_PENALTY);
          p.scoreBreakdown.penalties += CONFIG.INNOCENT_PENALTY;
        }
      });

      // "If 3 non-impostor players are eliminated total, the game ends, Impostor wins."
      // (Also win if active queue reduced to <= 2 players, meaning Impostor cannot be outvoted)
      if (this.eliminatedNonImpostorsCount >= CONFIG.MAX_INNOCENT_ELIMINATIONS || this.activeQueue.length <= 2) {
        if (impostorData) {
          impostorData.hiddenScore += CONFIG.IMPOSTOR_WIN_BONUS;
          impostorData.scoreBreakdown.winBonus += CONFIG.IMPOSTOR_WIN_BONUS;
        }

        this.io.to(this.room.id).emit('impostor-voting-result', {
          eliminated: {
            id: eliminatedPlayer.id,
            username: eliminatedPlayer.username,
            color: eliminatedPlayer.color
          },
          votesCount: maxVotes,
          totalVoters: totalEligibleVoters,
          wasImpostor: false,
          voteDetails,
          eliminatedNonImpostorsCount: this.eliminatedNonImpostorsCount,
          reason: `Strict majority voted out innocent player ${eliminatedPlayer.username}! 3 innocents have been eliminated!`
        });

        this.timer = setTimeout(() => {
          this.endGame('IMPOSTOR', `The Impostor fooled everyone! 3 non-impostor players were eliminated.`);
        }, CONFIG.RESULT_DISPLAY_SECONDS * 1000);
        return;
      }

      // ----------------------------------------------------------------------
      // Game Continues: Progressive Rounds
      // "If the game continues, start a new drawing phase with the remaining players.
      // This subsequent drawing phase only lasts for 1 rotation before the next vote."
      // ----------------------------------------------------------------------
      this.io.to(this.room.id).emit('impostor-voting-result', {
        eliminated: {
          id: eliminatedPlayer.id,
          username: eliminatedPlayer.username,
          color: eliminatedPlayer.color
        },
        votesCount: maxVotes,
        totalVoters: totalEligibleVoters,
        wasImpostor: false,
        voteDetails,
        eliminatedNonImpostorsCount: this.eliminatedNonImpostorsCount,
        remainingActiveCount: this.activeQueue.length,
        reason: `${eliminatedPlayer.username} was eliminated, but was NOT the Impostor! (${this.eliminatedNonImpostorsCount}/${CONFIG.MAX_INNOCENT_ELIMINATIONS} innocents eliminated)`
      });

      this.timer = setTimeout(() => {
        this.startDrawingPhase(CONFIG.SUBSEQUENT_PHASE_ROTATIONS);
      }, CONFIG.RESULT_DISPLAY_SECONDS * 1000);
      return;
    }

    // ------------------------------------------------------------------------
    // CASE B: No Strict Majority - No one was eliminated
    // ------------------------------------------------------------------------
    // Impostor survived another round!
    const impostorSurvivalBonus = Math.floor(CONFIG.IMPOSTOR_SURVIVAL_BASE * 0.75 * this.votingRound);
    const impostorData = this.players.get(this.impostorId);
    if (impostorData) {
      impostorData.hiddenScore += impostorSurvivalBonus;
      impostorData.scoreBreakdown.survivalBonus += impostorSurvivalBonus;
    }

    this.io.to(this.room.id).emit('impostor-voting-result', {
      eliminated: null,
      votesCount: maxVotes,
      totalVoters: totalEligibleVoters,
      wasImpostor: false,
      voteDetails,
      eliminatedNonImpostorsCount: this.eliminatedNonImpostorsCount,
      remainingActiveCount: this.activeQueue.length,
      reason: isTie
        ? 'A tie occurred! No player received a strict majority. No one is eliminated.'
        : `Highest vote had only ${maxVotes}/${totalEligibleVoters}. Strict majority (> ${strictMajorityThreshold}) was not met. No one is eliminated.`
    });

    // Continue to next drawing phase (1 rotation)
    this.timer = setTimeout(() => {
      this.startDrawingPhase(CONFIG.SUBSEQUENT_PHASE_ROTATIONS);
    }, CONFIG.RESULT_DISPLAY_SECONDS * 1000);
  }

  // ==========================================================================
  // Concluding 'GAME_OVER' Logic & Revealed Leaderboard
  // ==========================================================================
  endGame(winner, reason) {
    this.clearTimer();
    this.state = IMPOSTOR_STATES.GAME_OVER;

    // Synchronize scores back to Room's connectedUsers so room scoreboard updates
    this.players.forEach((p, socketId) => {
      const user = this.room.connectedUsers.get(socketId);
      if (user) {
        user.score = p.hiddenScore;
      }
    });

    // Prepare revealed leaderboard sorted by score descending
    const revealedLeaderboard = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        username: p.username,
        color: p.color,
        role: p.role,
        score: p.hiddenScore,
        isEliminated: p.isEliminated,
        breakdown: p.scoreBreakdown
      }))
      .sort((a, b) => b.score - a.score);

    console.log(`[Impostor Game Over] Winner: ${winner}. Impostor was: ${this.impostorUsername}. Secret word: ${this.secretWord}`);

    // Instructions.md: "At game over, broadcast the 'GAME_OVER' event with the final revealed scores
    // and the Impostor's identity to update a leaderboard UI."
    this.io.to(this.room.id).emit('GAME_OVER', {
      winner, // 'REGULARS' | 'IMPOSTOR'
      impostorId: this.impostorId,
      impostorUsername: this.impostorUsername,
      secretWord: this.secretWord,
      secretCategory: this.secretCategory,
      reason,
      leaderboard: revealedLeaderboard,
      podium: revealedLeaderboard.slice(0, 3)
    });

    this.io.to(this.room.id).emit('players-update', Array.from(this.room.connectedUsers.values()));

    this.io.to(this.room.id).emit('notification', {
      id: 'notif_' + Date.now(),
      text: winner === 'REGULARS'
        ? `🎉 Regulars Win! ${this.impostorUsername} was caught!`
        : `🕵️ Impostor Wins! ${this.impostorUsername} blended in!`,
      type: winner === 'REGULARS' ? 'success' : 'danger',
      icon: winner === 'REGULARS' ? '🏆' : '🕵️',
      duration: 6000
    });

    this.syncRoomState();
  }

  // ==========================================================================
  // Permissions & State Synchronization
  // ==========================================================================
  getActivePlayerId() {
    if (this.state !== IMPOSTOR_STATES.DRAWING_TURN) return null;
    return this.activeQueue[this.currentTurnIndex] || null;
  }

  /**
   * Only the active player in the current turn has write access to the canvas
   */
  canDraw(socketId) {
    if (this.state !== IMPOSTOR_STATES.DRAWING_TURN) return false;
    return (socketId === this.getActivePlayerId());
  }

  /**
   * Broadcast sanitized state to all clients
   */
  syncRoomState() {
    const activeDrawerId = this.getActivePlayerId();
    const activePlayer = activeDrawerId ? this.players.get(activeDrawerId) : null;

    this.players.forEach((p, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) return;

      const isCurrentDrawer = (socketId === activeDrawerId);

      socket.emit('impostor-state-sync', {
        state: this.state,
        role: p.role,
        isImpostor: (p.role === 'IMPOSTOR'),
        // Keep targetWord secret from Impostor
        secretWord: (p.role === 'IMPOSTOR') ? null : this.secretWord,
        category: this.secretCategory,
        canDraw: isCurrentDrawer,
        activeDrawerId,
        activeDrawerUsername: activePlayer ? activePlayer.username : null,
        activeDrawerColor: activePlayer ? activePlayer.color : null,
        timeLeft: this.timeLeft,
        totalTime: this.totalTime,
        currentRotation: this.currentRotation,
        requiredRotations: this.requiredRotations,
        votingRound: this.votingRound,
        eliminatedNonImpostorsCount: this.eliminatedNonImpostorsCount,
        activeQueueLength: this.activeQueue.length,
        isEliminated: p.isEliminated,
        isHost: (this.room.hostId === socketId)
      });
    });
  }

  /**
   * Disconnect handling
   */
  handleDisconnect(socketId) {
    console.log(`[Impostor Mode] Player disconnected: ${socketId}`);

    const isCurrentDrawer = (socketId === this.getActivePlayerId());
    const isImpostor = (socketId === this.impostorId);

    // Remove from active queue
    this.activeQueue = this.activeQueue.filter(id => id !== socketId);
    this.currentVotes.delete(socketId);

    // If Impostor disconnects, Regulars win by default
    if (isImpostor && this.state !== IMPOSTOR_STATES.GAME_OVER) {
      this.endGame('REGULARS', `The Impostor (${this.impostorUsername}) disconnected.`);
      return;
    }

    // If too few players remain
    if (this.activeQueue.length < 2 && this.state !== IMPOSTOR_STATES.GAME_OVER) {
      this.endGame('REGULARS', 'Too few players remaining to continue Impostor Mode.');
      return;
    }

    // If current drawer disconnected during their turn, advance immediately
    if (isCurrentDrawer && this.state === IMPOSTOR_STATES.DRAWING_TURN) {
      this.clearTimer();
      this.startNextTurn();
    }
  }

  /**
   * Allows the Impostor to stop the game at any time by guessing the secret word.
   * If correct, the Impostor wins! If incorrect, the Regulars win!
   * @param {string} socketId - Socket ID of the player attempting to guess
   * @param {string} guessText - The guessed secret word
   */
  handleImpostorGuess(socketId, guessText) {
    if (this.state === IMPOSTOR_STATES.GAME_OVER) return false;
    if (socketId !== this.impostorId) return false;

    const cleanGuess = (guessText || '').trim().toLowerCase();
    const cleanTarget = (this.secretWord || '').trim().toLowerCase();
    if (!cleanGuess) return false;

    console.log(`[Impostor Guess] Impostor ${this.impostorUsername} stopped game to guess: "${cleanGuess}" (target: "${cleanTarget}")`);

    if (cleanGuess === cleanTarget) {
      // Correct guess! Impostor wins immediately!
      const impostorData = this.players.get(this.impostorId);
      if (impostorData) {
        impostorData.hiddenScore += CONFIG.IMPOSTOR_WIN_BONUS;
        impostorData.scoreBreakdown.winBonus += CONFIG.IMPOSTOR_WIN_BONUS;
      }

      this.io.to(this.room.id).emit('notification', {
        id: 'notif_' + Date.now(),
        text: `🕵️ The Impostor stopped the game and correctly guessed: "${this.secretWord.toUpperCase()}"!`,
        type: 'danger',
        icon: '🕵️',
        duration: 6000
      });

      this.endGame('IMPOSTOR', `The Impostor (${this.impostorUsername}) stopped the game and correctly guessed the secret word: "${this.secretWord.toUpperCase()}"!`);
      return true;
    } else {
      // Incorrect guess! Regulars win!
      this.players.forEach(p => {
        if (p.role === 'REGULAR') {
          p.hiddenScore += CONFIG.REGULAR_WIN_BONUS;
          p.scoreBreakdown.winBonus += CONFIG.REGULAR_WIN_BONUS;
        }
      });

      this.io.to(this.room.id).emit('notification', {
        id: 'notif_' + Date.now(),
        text: `❌ The Impostor guessed "${cleanGuess.toUpperCase()}" (Wrong!). Regulars Win!`,
        type: 'success',
        icon: '🎉',
        duration: 6000
      });

      this.endGame('REGULARS', `The Impostor (${this.impostorUsername}) stopped the game and guessed "${cleanGuess.toUpperCase()}", which is incorrect! The secret word was "${this.secretWord.toUpperCase()}".`);
      return false;
    }
  }

  /**
   * Checks if socketId is the impostor
   */
  isImpostor(socketId) {
    return socketId === this.impostorId;
  }

  /**
   * Stops the Impostor game immediately and notifies all players
   * @param {string} reason - Cancellation reason
   */
  stop(reason = 'Host stopped the game.') {
    this.cleanup();
    this.io.to(this.room.id).emit('impostor-game-stopped', { reason });
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  cleanup() {
    this.clearTimer();
    this.state = IMPOSTOR_STATES.LOBBY;
    this.currentVotes.clear();
    this.activeQueue = [];
    this.players.clear();
    this.io.to(this.room.id).emit('impostor-state-sync', {
      state: IMPOSTOR_STATES.LOBBY,
      canDraw: true,
      isHost: false
    });
  }
}

module.exports = {
  ImpostorGame,
  IMPOSTOR_STATES,
  CONFIG
};

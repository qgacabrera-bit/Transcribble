require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { DeepgramClient, createClient } = require('@deepgram/sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const MIN_ROOM_PLAYERS = 2;
const MAX_ROOM_PLAYERS = 10;
const RECONNECT_GRACE_PERIOD_MS = 30000;
const MAX_HISTORY = 15000;

// Serve static files from 'public' and root directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Distinct vibrant colors for player badges
const PLAYER_COLORS = [
  '#FF5C8D', // Bright Pink
  '#6C5CE7', // Purple
  '#00CEC9', // Turquoise
  '#FDCB6E', // Warm Amber
  '#0984E3', // Electric Blue
  '#00B894', // Emerald Green
  '#E17055', // Terracotta
  '#D63031', // Crimson
  '#A29BFE', // Periwinkle
  '#E84393'  // Deep Rose
];

// ============================================================================
// Deepgram Live WebSocket Speech-to-Text Manager
// ============================================================================
let deepgramClient = null;

function getDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
    return null;
  }
  if (!deepgramClient) {
    try {
      if (typeof DeepgramClient === 'function') {
        deepgramClient = new DeepgramClient({ apiKey });
      } else if (typeof createClient === 'function') {
        deepgramClient = createClient(apiKey);
      }
      console.log('🎙️ Deepgram SDK client initialized successfully.');
    } catch (err) {
      console.error('❌ Failed to initialize Deepgram SDK client:', err.message);
      return null;
    }
  }
  return deepgramClient;
}

getDeepgramClient();

function extractHighestConfidenceTranscript(msg) {
  if (!msg) return { text: '', confidence: 0 };
  let data = msg;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return { text: '', confidence: 0 };
    }
  }

  const alts = data?.channel?.alternatives || data?.alternatives;
  if (!Array.isArray(alts) || alts.length === 0) {
    return { text: '', confidence: 0 };
  }

  let bestText = '';
  let highestConf = -1;

  for (const alt of alts) {
    const text = (alt.transcript || '').trim();
    const conf = typeof alt.confidence === 'number' ? alt.confidence : 0;
    if (text && conf > highestConf) {
      highestConf = conf;
      bestText = text;
    }
  }

  if (!bestText && alts[0]?.transcript) {
    bestText = alts[0].transcript.trim();
    highestConf = alts[0].confidence || 0;
  }

  return { text: bestText, confidence: Math.max(0, highestConf) };
}

/**
 * Transcribes a 2-second audio burst using Deepgram Live WebSocket with pre-recorded file fallback
 */
async function transcribeAudioBurstViaDeepgram(audioBuffer, mimeType = 'audio/webm') {
  const client = getDeepgramClient();
  if (!client || !audioBuffer || audioBuffer.length < 200) {
    return { transcript: '', confidence: 0 };
  }

  // 1. Try Live WebSocket Connection
  try {
    const livePromise = new Promise((resolve) => {
      let isResolved = false;
      let liveSocket = null;
      let timeoutId = null;
      let bestTranscript = '';
      let highestConfidence = 0;
      const finalTranscripts = [];

      const finish = (text, conf) => {
        if (isResolved) return;
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        try {
          if (liveSocket && typeof liveSocket.finish === 'function') {
            liveSocket.finish();
          }
        } catch (e) {}
        resolve({ transcript: text || '', confidence: conf || 0 });
      };

      timeoutId = setTimeout(() => {
        const combined = finalTranscripts.filter(Boolean).join(' ').trim() || bestTranscript.trim();
        finish(combined, highestConfidence);
      }, 2500);

      const liveOptions = {
        model: process.env.DEEPGRAM_MODEL || 'nova-2',
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'false',
        language: 'en',
        shouldReconnect: () => false,
        reconnectAttempts: 0,
        connectionTimeoutInSeconds: 3
      };

      if (!client.listen?.v1 || typeof client.listen.v1.connect !== 'function') {
        return finish('', 0);
      }

      client.listen.v1.connect(liveOptions).then((ws) => {
        liveSocket = ws;

        liveSocket.on('message', (data) => {
          let payload = data;
          if (typeof data === 'string') {
            try { payload = JSON.parse(data); } catch (e) {}
          }

          const extracted = extractHighestConfidenceTranscript(payload);
          if (extracted.text) {
            if (extracted.confidence >= highestConfidence) {
              highestConfidence = extracted.confidence;
              bestTranscript = extracted.text;
            }
            if (payload?.is_final) {
              finalTranscripts.push(extracted.text);
            }
          }

          if ((payload?.is_final && extracted.text) || payload?.type === 'Metadata') {
            const combined = finalTranscripts.filter(Boolean).join(' ').trim() || bestTranscript.trim();
            if (combined) {
              finish(combined, highestConfidence);
            }
          }
        });

        liveSocket.on('error', () => {
          const combined = finalTranscripts.filter(Boolean).join(' ').trim() || bestTranscript.trim();
          finish(combined, highestConfidence);
        });

        liveSocket.on('close', () => {
          const combined = finalTranscripts.filter(Boolean).join(' ').trim() || bestTranscript.trim();
          finish(combined, highestConfidence);
        });

        liveSocket.connect();
        liveSocket.waitForOpen().then(() => {
          liveSocket.sendMedia(audioBuffer);
          liveSocket.sendFinalize({ type: 'Finalize' });
        }).catch(() => {
          finish('', 0);
        });

      }).catch(() => {
        finish('', 0);
      });
    });

    const result = await livePromise;
    if (result && result.transcript) {
      return result;
    }
  } catch (err) {
    console.warn('[Deepgram Live WS] WS attempt error, falling back to pre-recorded:', err.message);
  }

  // 2. Pre-recorded HTTP Fallback
  try {
    if (client.listen?.prerecorded?.transcribeFile) {
      const response = await client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: process.env.DEEPGRAM_MODEL || 'nova-2',
          smart_format: true,
          punctuate: true,
          mimetype: mimeType
        }
      );
      const data = response?.result || response;
      return extractHighestConfidenceTranscript(data);
    }
  } catch (fallbackErr) {
    console.error('[Deepgram Fallback] Pre-recorded API error:', fallbackErr.message);
  }

  return { transcript: '', confidence: 0 };
}

// ============================================================================
// Reverse Pictionary + Taboo Cards & Game Constants
// ============================================================================
const GAME_STATES = {
  LOBBY: 'LOBBY',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER'
};

const PHASES = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING'
};

const ROUND_TIME_SECONDS = 80;
const ROUND_INTERMISSION_SECONDS = 6;
const TOTAL_ROUNDS = 3;

const TABOO_CARDS = [
  { word: 'Apple', category: 'Food', bannedWords: ['Fruit', 'Red', 'Tree', 'Pie', 'Juice', 'Doctor', 'Mac', 'iPhone'] },
  { word: 'Pizza', category: 'Food', bannedWords: ['Cheese', 'Pepperoni', 'Italy', 'Crust', 'Slice', 'Delivery', 'Dough'] },
  { word: 'Airplane', category: 'Transport', bannedWords: ['Fly', 'Wings', 'Pilot', 'Sky', 'Airport', 'Jet', 'Crash', 'Engine'] },
  { word: 'Guitar', category: 'Music', bannedWords: ['Strings', 'Music', 'Play', 'Rock', 'Instrument', 'Acoustic', 'Electric'] },
  { word: 'Cat', category: 'Animals', bannedWords: ['Pet', 'Meow', 'Feline', 'Dog', 'Kitten', 'Whisker', 'Fur', 'Tail'] },
  { word: 'Submarine', category: 'Vehicles', bannedWords: ['Underwater', 'Ocean', 'Torpedo', 'Yellow', 'Periscope', 'Ship', 'Boat'] },
  { word: 'Spider', category: 'Animals', bannedWords: ['Web', 'Eight', 'Legs', 'Insect', 'Bite', 'Arachnid', 'Creepy'] },
  { word: 'Clock', category: 'Objects', bannedWords: ['Time', 'Hour', 'Minute', 'Second', 'Watch', 'Tick', 'Hands'] },
  { word: 'Campfire', category: 'Outdoors', bannedWords: ['Fire', 'Wood', 'Tent', 'Marshmallow', 'Smoke', 'Burn', 'Hot'] },
  { word: 'Snowman', category: 'Winter', bannedWords: ['Snow', 'Winter', 'Carrot', 'Cold', 'Frosty', 'White', 'Melting'] },
  { word: 'Castle', category: 'Architecture', bannedWords: ['King', 'Queen', 'Fortress', 'Knight', 'Moat', 'Tower', 'Stone'] },
  { word: 'Bicycle', category: 'Vehicles', bannedWords: ['Wheels', 'Ride', 'Pedal', 'Handlebars', 'Bike', 'Chain', 'Two'] },
  { word: 'Telescope', category: 'Science', bannedWords: ['Stars', 'Space', 'Look', 'Moon', 'Sky', 'Astronomy', 'Lens'] },
  { word: 'Ghost', category: 'Spooky', bannedWords: ['Boo', 'Spooky', 'Haunted', 'Sheet', 'Dead', 'Spirit', 'Halloween'] },
  { word: 'Penguin', category: 'Animals', bannedWords: ['Bird', 'Antarctica', 'Ice', 'Tuxedo', 'Cold', 'Fly', 'Waddle'] },
  { word: 'Cactus', category: 'Nature', bannedWords: ['Desert', 'Prickly', 'Plant', 'Spines', 'Green', 'Water', 'Thorn'] },
  { word: 'Volcano', category: 'Nature', bannedWords: ['Lava', 'Erupt', 'Mountain', 'Magma', 'Ash', 'Fire', 'Hot'] },
  { word: 'Rocket', category: 'Space', bannedWords: ['Space', 'Launch', 'Astronaut', 'NASA', 'Moon', 'Fly', 'Fuel'] },
  { word: 'Dragon', category: 'Mythology', bannedWords: ['Fire', 'Breathe', 'Wings', 'Scales', 'Monster', 'Medieval', 'Fly'] },
  { word: 'Camera', category: 'Technology', bannedWords: ['Photo', 'Picture', 'Snap', 'Lens', 'Flash', 'Shoot', 'Video'] },
  { word: 'Lighthouse', category: 'Maritime', bannedWords: ['Ocean', 'Light', 'Beacon', 'Coast', 'Tower', 'Ships', 'Water'] },
  { word: 'Popcorn', category: 'Food', bannedWords: ['Movie', 'Corn', 'Kernel', 'Butter', 'Salt', 'Microwave', 'Theater'] }
];

// ============================================================================
// Multi-Room State Management
// ============================================================================

/** Map of roomId -> Room */
const rooms = new Map();
/** Map of socketId -> roomId */
const socketRoomMap = new Map();

/**
 * Generates a short, readable 5-character uppercase alphanumeric Room ID.
 * Excludes ambiguous characters (0, O, 1, I).
 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(id)) {
    return generateRoomId();
  }
  return id;
}

/**
 * Creates and initializes a new Room
 */
function createRoom(requestedId = null, isCustom = false) {
  const id = (requestedId && requestedId.toUpperCase().trim()) || generateRoomId();
  const room = {
    id,
    isCustom,
    createdAt: Date.now(),
    hostId: null,
    hostToken: null,
    disconnectTimers: new Map(), // sessionToken -> timeoutId
    connectedUsers: new Map(), // socketId -> User
    drawingHistory: [],
    gameState: {
      phase: PHASES.LOBBY,
      mode: GAME_STATES.LOBBY,
      currentRound: 1,
      totalRounds: TOTAL_ROUNDS,
      drawerId: null,
      drawerUsername: null,
      drawerQueue: [],
      currentDrawerIndex: 0,
      targetWord: '',
      targetCategory: '',
      bannedWords: [],
      wordHint: '',
      timeLeft: 0,
      totalTime: ROUND_TIME_SECONDS,
      tabooViolations: 0
    },
    timerInterval: null
  };
  rooms.set(id, room);
  console.log(`[Room] Created room ${id} (custom: ${isCustom}). Active rooms: ${rooms.size}`);
  return room;
}

/**
 * Sanitizes user data for clean JSON serialization over Socket.IO
 */
function getPublicUser(user, room) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    color: user.color,
    score: user.score || 0,
    role: user.role,
    isHost: Boolean(room && room.hostId === user.id),
    disconnected: Boolean(user.disconnected)
  };
}

function getPublicUsers(room) {
  if (!room) return [];
  return Array.from(room.connectedUsers.values()).map(u => getPublicUser(u, room));
}

/**
 * Finds an open room in LOBBY phase with available player slots, or creates a new one
 */
function findOrCreateMatchmakingRoom() {
  for (const room of rooms.values()) {
    const activeCount = Array.from(room.connectedUsers.values()).filter(u => !u.disconnected).length;
    if (room.gameState.phase === PHASES.LOBBY && activeCount < MAX_ROOM_PLAYERS) {
      return room;
    }
  }
  return createRoom(null, false);
}

function getSocketRoom(socketId) {
  const roomId = socketRoomMap.get(socketId);
  return roomId ? rooms.get(roomId) : null;
}

/**
 * Reassigns the room host to the next active player if the current host departed or disconnected
 */
function assignNewHostIfNeeded(room) {
  if (!room) return;
  const currentHost = room.connectedUsers.get(room.hostId);
  if (!currentHost || currentHost.disconnected) {
    for (const [sId, u] of room.connectedUsers.entries()) {
      if (!u.disconnected) {
        room.hostId = sId;
        room.hostToken = u.sessionToken;
        console.log(`[Host] Reassigned host of room ${room.id} to ${u.username} (${sId})`);
        broadcastNotification(room, `👑 ${u.username} is now the Room Host!`, 'info', '👑', 3000);
        broadcastSanitizedState(room);
        io.to(room.id).emit('players-update', getPublicUsers(room));
        break;
      }
    }
  }
}

/**
 * Sanitized Game State for Room:
 * Never transmits targetWord or bannedWords to Blind Drawer or Lobby.
 * Provides hostId, isHost, and player limit metadata.
 */
function getSanitizedState(room, socketId) {
  const gs = room.gameState;
  const isLobby = (gs.phase === PHASES.LOBBY);
  const isDrawer = (!isLobby && socketId === gs.drawerId);
  const isDescriber = (!isLobby && socketId !== gs.drawerId);

  let role = 'LOBBY';
  if (!isLobby) {
    role = isDrawer ? 'DRAWER' : 'DESCRIBER';
  }

  let micMode = 'OPEN_MIC';
  if (!isLobby && isDescriber) {
    micMode = 'BURST_2S';
  }

  const canDraw = isLobby || (isDrawer && gs.mode === GAME_STATES.ROUND_ACTIVE);
  const hasSecretAccess = (!isLobby && isDescriber);

  return {
    roomId: room.id,
    phase: gs.phase,
    subPhase: gs.mode,
    role,
    micMode,
    canDraw,
    drawerId: gs.drawerId,
    drawerUsername: gs.drawerUsername,
    currentRound: gs.currentRound,
    totalRounds: gs.totalRounds,
    timeLeft: gs.timeLeft,
    totalTime: gs.totalTime,
    category: isLobby ? null : gs.targetCategory,
    wordHint: isLobby ? null : gs.wordHint,
    letterCount: isLobby ? 0 : (gs.targetWord ? gs.targetWord.length : 0),
    targetWord: hasSecretAccess ? gs.targetWord : null,
    bannedWords: hasSecretAccess ? [...gs.bannedWords] : [],
    hostId: room.hostId,
    isHost: (room.hostId === socketId),
    minPlayers: MIN_ROOM_PLAYERS,
    maxPlayers: MAX_ROOM_PLAYERS,
    players: getPublicUsers(room)
  };
}

function broadcastSanitizedState(room) {
  if (!room) return;
  room.connectedUsers.forEach((user, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('game-state-sync', getSanitizedState(room, socketId));
    }
  });
}

function broadcastNotification(room, text, type = 'info', icon = '🔔', duration = 3500) {
  if (!room) return;
  io.to(room.id).emit('notification', {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    text,
    type,
    icon,
    duration,
    time: formatCurrentTime()
  });
}

function sendPrivateNotification(socket, text, type = 'warning', icon = '⚠️', duration = 4000) {
  socket.emit('notification', {
    id: 'pnotif_' + Date.now(),
    text,
    type,
    icon,
    duration,
    time: formatCurrentTime()
  });
}

function joinSocketToRoom(socket, room, rawUsername, sessionToken) {
  leaveCurrentRoom(socket, true);

  const cleanUsername = (typeof rawUsername === 'string' && rawUsername.trim())
    ? rawUsername.trim().slice(0, 20)
    : `Player ${room.connectedUsers.size + 1}`;

  // Check for reconnection via sessionToken in this room
  let existingUserKey = null;
  let existingUser = null;
  if (sessionToken) {
    for (const [sId, u] of room.connectedUsers.entries()) {
      if (u.sessionToken === sessionToken) {
        existingUserKey = sId;
        existingUser = u;
        break;
      }
    }
  }

  if (existingUser) {
    // ------------------------------------------------------------------------
    // RECONNECTION FLOW (Restores score, role, spot during grace period)
    // ------------------------------------------------------------------------
    if (room.disconnectTimers.has(existingUser.sessionToken)) {
      clearTimeout(room.disconnectTimers.get(existingUser.sessionToken));
      room.disconnectTimers.delete(existingUser.sessionToken);
    }

    if (existingUserKey !== socket.id) {
      socketRoomMap.delete(existingUserKey);
      room.connectedUsers.delete(existingUserKey);
    }

    existingUser.id = socket.id;
    existingUser.disconnected = false;
    existingUser.username = cleanUsername; // allow updating display name

    room.connectedUsers.set(socket.id, existingUser);
    socketRoomMap.set(socket.id, room.id);
    socket.join(room.id);

    // Re-link host status if this user held the hostToken
    if (room.hostToken === sessionToken || room.hostId === existingUserKey) {
      room.hostId = socket.id;
      room.hostToken = sessionToken;
    }

    // Re-link drawer role if this user was actively drawing
    room.gameState.drawerQueue = room.gameState.drawerQueue.map(id => (id === existingUserKey ? socket.id : id));
    if (room.gameState.drawerId === existingUserKey) {
      room.gameState.drawerId = socket.id;
      room.gameState.drawerUsername = existingUser.username;
    }

    console.log(`[Reconnected] ${existingUser.username} reconnected to room ${room.id} (${socket.id})`);

    socket.emit('room-joined', {
      roomId: room.id,
      currentUser: getPublicUser(existingUser, room),
      users: getPublicUsers(room),
      drawingHistory: room.drawingHistory,
      isHost: (room.hostId === socket.id),
      minPlayers: MIN_ROOM_PLAYERS,
      maxPlayers: MAX_ROOM_PLAYERS,
      gameState: {
        phase: room.gameState.phase,
        mode: room.gameState.mode,
        currentRound: room.gameState.currentRound,
        totalRounds: room.gameState.totalRounds,
        drawerId: room.gameState.drawerId,
        drawerUsername: room.gameState.drawerUsername,
        timeLeft: room.gameState.timeLeft,
        totalTime: room.gameState.totalTime
      }
    });

    socket.to(room.id).emit('user-reconnected', {
      user: getPublicUser(existingUser, room),
      users: getPublicUsers(room)
    });

    socket.emit('game-state-sync', getSanitizedState(room, socket.id));
    broadcastSanitizedState(room);
    io.to(room.id).emit('players-update', getPublicUsers(room));
    broadcastNotification(room, `🎉 ${existingUser.username} reconnected!`, 'info', '🔄', 2500);
    return;
  }

  // --------------------------------------------------------------------------
  // NEW PLAYER JOIN FLOW
  // --------------------------------------------------------------------------
  const activeCount = Array.from(room.connectedUsers.values()).filter(u => !u.disconnected).length;
  if (activeCount >= MAX_ROOM_PLAYERS) {
    socket.emit('join-error', { message: `Room "${room.id}" is full (maximum ${MAX_ROOM_PLAYERS} players).` });
    return;
  }

  const assignedColor = PLAYER_COLORS[room.connectedUsers.size % PLAYER_COLORS.length];
  const userToken = sessionToken || ('tok_' + socket.id);
  const user = {
    id: socket.id,
    sessionToken: userToken,
    username: cleanUsername,
    color: assignedColor,
    score: 0,
    role: (room.gameState.phase === PHASES.LOBBY) ? 'LOBBY' : 'DESCRIBER',
    joinedAt: new Date().toISOString(),
    disconnected: false
  };

  room.connectedUsers.set(socket.id, user);
  socketRoomMap.set(socket.id, room.id);
  socket.join(room.id);

  // First player to join becomes Room Host
  if (!room.hostId || !room.connectedUsers.has(room.hostId)) {
    room.hostId = socket.id;
    room.hostToken = userToken;
    console.log(`[Host] ${user.username} is now host of room ${room.id}`);
  }

  if (room.gameState.phase !== PHASES.LOBBY && !room.gameState.drawerQueue.includes(socket.id)) {
    room.gameState.drawerQueue.push(socket.id);
  }

  console.log(`[+] ${user.username} joined room ${room.id}. Players: ${room.connectedUsers.size}`);

  socket.emit('room-joined', {
    roomId: room.id,
    currentUser: getPublicUser(user, room),
    users: getPublicUsers(room),
    drawingHistory: room.drawingHistory,
    isHost: (room.hostId === socket.id),
    minPlayers: MIN_ROOM_PLAYERS,
    maxPlayers: MAX_ROOM_PLAYERS,
    gameState: {
      phase: room.gameState.phase,
      mode: room.gameState.mode,
      currentRound: room.gameState.currentRound,
      totalRounds: room.gameState.totalRounds,
      drawerId: room.gameState.drawerId,
      drawerUsername: room.gameState.drawerUsername,
      timeLeft: room.gameState.timeLeft,
      totalTime: room.gameState.totalTime
    }
  });

  socket.to(room.id).emit('user-joined', {
    user: getPublicUser(user, room),
    users: getPublicUsers(room)
  });

  socket.emit('game-state-sync', getSanitizedState(room, socket.id));
  broadcastSanitizedState(room);
  broadcastNotification(room, `${user.username} joined the party!`, 'info', '👋', 2500);
}

/**
 * Handles socket leave or disconnect.
 * If isExplicit is true (e.g. user clicked Home), removes player immediately.
 * If isExplicit is false (e.g. Wi-Fi blip or browser refresh), triggers 30s grace period.
 */
function leaveCurrentRoom(socket, isExplicit = false) {
  const roomId = socketRoomMap.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) {
    socketRoomMap.delete(socket.id);
    return;
  }

  const user = room.connectedUsers.get(socket.id);
  if (!user) {
    socketRoomMap.delete(socket.id);
    return;
  }

  if (isExplicit) {
    finalizePlayerLeave(room, socket.id, user);
  } else {
    handlePlayerDisconnectGrace(room, socket.id, user);
  }
}

/**
 * 30-Second Grace Period for network disconnects or browser refreshes
 */
function handlePlayerDisconnectGrace(room, socketId, user) {
  user.disconnected = true;
  socketRoomMap.delete(socketId);

  // Clear existing timer if any
  if (room.disconnectTimers.has(user.sessionToken)) {
    clearTimeout(room.disconnectTimers.get(user.sessionToken));
    room.disconnectTimers.delete(user.sessionToken);
  }

  console.log(`[~] ${user.username} temporarily disconnected from ${room.id}. Spot saved for ${RECONNECT_GRACE_PERIOD_MS / 1000}s.`);
  broadcastNotification(room, `📶 ${user.username} disconnected (saving spot for 30s...)`, 'warning', '⏳', 3500);

  io.to(room.id).emit('players-update', getPublicUsers(room));
  broadcastSanitizedState(room);

  const timer = setTimeout(() => {
    room.disconnectTimers.delete(user.sessionToken);
    finalizePlayerLeave(room, socketId, user);
  }, RECONNECT_GRACE_PERIOD_MS);

  room.disconnectTimers.set(user.sessionToken, timer);
}

/**
 * Permanently removes a player when they explicitly leave or when their grace period expires
 */
function finalizePlayerLeave(room, socketId, user) {
  if (room.disconnectTimers.has(user.sessionToken)) {
    clearTimeout(room.disconnectTimers.get(user.sessionToken));
    room.disconnectTimers.delete(user.sessionToken);
  }

  room.connectedUsers.delete(socketId);
  socketRoomMap.delete(socketId);
  room.gameState.drawerQueue = room.gameState.drawerQueue.filter(id => id !== socketId);

  console.log(`[-] ${user.username} permanently left room ${room.id}. Remaining: ${room.connectedUsers.size}`);
  io.to(room.id).emit('user-left', {
    userId: socketId,
    username: user.username,
    users: getPublicUsers(room)
  });
  broadcastNotification(room, `${user.username} left the game`, 'info', '👋', 2500);

  // If no players remain in the room (including no disconnected players waiting)
  if (room.connectedUsers.size === 0) {
    clearInterval(room.timerInterval);
    for (const timer of room.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    room.disconnectTimers.clear();
    rooms.delete(room.id);
    console.log(`[Room] Room ${room.id} deleted (all players departed). Active rooms: ${rooms.size}`);
    return;
  }

  assignNewHostIfNeeded(room);
  broadcastSanitizedState(room);
  io.to(room.id).emit('players-update', getPublicUsers(room));

  if (room.gameState.drawerId === socketId && room.gameState.mode === GAME_STATES.ROUND_ACTIVE) {
    endRound(room, false, 'The Blind Drawer disconnected.');
  }
}

// ============================================================================
// Turn & Role Management (Room Scoped)
// ============================================================================

function startGame(room) {
  if (!room || room.connectedUsers.size === 0) return;

  room.connectedUsers.forEach(user => {
    user.score = 0;
    user.role = 'SPECTATOR';
  });

  room.gameState.phase = PHASES.PLAYING;
  const activeKeys = Array.from(room.connectedUsers.entries())
    .filter(([_, u]) => !u.disconnected)
    .map(([id]) => id);

  room.gameState.drawerQueue = activeKeys.length > 0 ? activeKeys : Array.from(room.connectedUsers.keys());
  room.gameState.currentDrawerIndex = 0;
  room.gameState.currentRound = 1;

  console.log(`[Game] Starting Reverse Pictionary & Taboo in room ${room.id} with ${room.gameState.drawerQueue.length} players!`);
  startRound(room);
}

function startRound(room) {
  if (!room) return;
  clearInterval(room.timerInterval);

  if (room.gameState.drawerQueue.length === 0) {
    returnToLobby(room, 'No players left in game.');
    return;
  }

  if (room.gameState.currentDrawerIndex >= room.gameState.drawerQueue.length) {
    room.gameState.currentDrawerIndex = 0;
    room.gameState.currentRound++;
    if (room.gameState.currentRound > room.gameState.totalRounds) {
      endGame(room);
      return;
    }
  }

  const drawerSocketId = room.gameState.drawerQueue[room.gameState.currentDrawerIndex];
  const drawerUser = room.connectedUsers.get(drawerSocketId);

  if (!drawerUser) {
    room.gameState.currentDrawerIndex++;
    startRound(room);
    return;
  }

  // Clear previous canvas
  room.drawingHistory = [];
  io.to(room.id).emit('clear-canvas', { clearedBy: 'System' });

  // Pick random Taboo card
  const card = TABOO_CARDS[Math.floor(Math.random() * TABOO_CARDS.length)];

  room.gameState.phase = PHASES.PLAYING;
  room.gameState.mode = GAME_STATES.ROUND_ACTIVE;
  room.gameState.drawerId = drawerSocketId;
  room.gameState.drawerUsername = drawerUser.username;
  room.gameState.targetWord = card.word;
  room.gameState.targetCategory = card.category;
  room.gameState.bannedWords = card.bannedWords;
  room.gameState.wordHint = generateWordBlanks(card.word);
  room.gameState.timeLeft = ROUND_TIME_SECONDS;
  room.gameState.totalTime = ROUND_TIME_SECONDS;
  room.gameState.tabooViolations = 0;

  room.connectedUsers.forEach((user, socketId) => {
    user.role = (socketId === drawerSocketId) ? 'DRAWER' : 'DESCRIBER';
  });

  broadcastSanitizedState(room);
  io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));

  // 1. Emit to DRAWER (Keeping target word STRICTLY HIDDEN)
  io.to(drawerSocketId).emit('round-start-drawer', {
    mode: room.gameState.mode,
    role: 'DRAWER',
    currentRound: room.gameState.currentRound,
    totalRounds: room.gameState.totalRounds,
    wordHint: room.gameState.wordHint,
    category: room.gameState.targetCategory,
    letterCount: card.word.length,
    timeLeft: room.gameState.timeLeft,
    totalTime: room.gameState.totalTime
  });

  // 2. Emit to DESCRIBERS (With Target Word & Taboo Banned Words)
  room.connectedUsers.forEach((user, socketId) => {
    if (socketId !== drawerSocketId) {
      io.to(socketId).emit('round-start-describer', {
        mode: room.gameState.mode,
        role: 'DESCRIBER',
        currentRound: room.gameState.currentRound,
        totalRounds: room.gameState.totalRounds,
        targetWord: room.gameState.targetWord,
        category: room.gameState.targetCategory,
        bannedWords: room.gameState.bannedWords,
        drawerUsername: room.gameState.drawerUsername,
        timeLeft: room.gameState.timeLeft,
        totalTime: room.gameState.totalTime
      });
    }
  });

  broadcastNotification(room, `Round ${room.gameState.currentRound}/${room.gameState.totalRounds}: ${drawerUser.username} is the Blind Drawer!`, 'info', '🎨', 4000);

  // Timer Interval
  room.timerInterval = setInterval(() => {
    room.gameState.timeLeft--;

    io.to(room.id).emit('timer-tick', {
      timeLeft: room.gameState.timeLeft,
      totalTime: room.gameState.totalTime
    });

    if (room.gameState.timeLeft <= 0) {
      endRound(room, false, 'Time ran out! The Drawer did not guess the word.');
    }
  }, 1000);
}

function generateWordBlanks(word) {
  return word.split('').map(char => (char === ' ' ? '   ' : '_')).join(' ');
}

function checkTabooViolation(text, targetWord, bannedWords) {
  if (!text || !targetWord) return { isViolation: false, violatedWord: null };
  const normalized = text.toLowerCase().trim();

  // 1. Check exact match or inclusion of target word
  const targetLower = targetWord.toLowerCase();
  const targetRegex = new RegExp(`\\b${escapeRegex(targetLower)}(s|es|ing|ed)?\\b`, 'i');
  if (targetRegex.test(normalized) || normalized.includes(targetLower)) {
    return { isViolation: true, violatedWord: targetWord };
  }

  // 2. Check each banned taboo word
  for (const banned of bannedWords) {
    const bannedLower = banned.toLowerCase();
    const bannedRegex = new RegExp(`\\b${escapeRegex(bannedLower)}(s|es|ing|ed)?\\b`, 'i');
    if (bannedRegex.test(normalized) || normalized === bannedLower) {
      return { isViolation: true, violatedWord: banned };
    }
  }

  return { isViolation: false, violatedWord: null };
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCloseGuess(guess, target) {
  const g = guess.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (Math.abs(g.length - t.length) > 1) return false;
  if (g === t) return false;

  let mismatches = 0;
  let i = 0, j = 0;
  while (i < g.length && j < t.length) {
    if (g[i] !== t[j]) {
      mismatches++;
      if (mismatches > 1) return false;
      if (g.length > t.length) i++;
      else if (t.length > g.length) j++;
      else { i++; j++; }
    } else {
      i++; j++;
    }
  }
  return true;
}

function endRound(room, won, reason) {
  if (!room) return;
  clearInterval(room.timerInterval);
  room.gameState.phase = PHASES.PLAYING;
  room.gameState.mode = GAME_STATES.ROUND_END;
  room.gameState.timeLeft = ROUND_INTERMISSION_SECONDS;
  room.gameState.totalTime = ROUND_INTERMISSION_SECONDS;

  broadcastSanitizedState(room);

  io.to(room.id).emit('round-end', {
    won: won,
    secretWord: room.gameState.targetWord,
    category: room.gameState.targetCategory,
    drawerUsername: room.gameState.drawerUsername,
    reason: reason,
    scores: Array.from(room.connectedUsers.values())
  });

  io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));

  room.timerInterval = setInterval(() => {
    room.gameState.timeLeft--;
    if (room.gameState.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      room.gameState.currentDrawerIndex++;
      startRound(room);
    }
  }, 1000);
}

function endGame(room) {
  if (!room) return;
  clearInterval(room.timerInterval);
  room.gameState.phase = PHASES.LOBBY;
  room.gameState.mode = GAME_STATES.GAME_OVER;
  room.gameState.timeLeft = 0;

  broadcastSanitizedState(room);

  const sorted = Array.from(room.connectedUsers.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sorted[0];

  io.to(room.id).emit('game-over', {
    winner: winner,
    podium: sorted.slice(0, 3)
  });

  broadcastNotification(room, `🏆 Game Over! Winner: ${winner ? winner.username : 'Nobody'}!`, 'success', '🏆', 5000);
}

function returnToLobby(room, reason) {
  if (!room) return;
  clearInterval(room.timerInterval);
  room.gameState.phase = PHASES.LOBBY;
  room.gameState.mode = GAME_STATES.LOBBY;
  room.gameState.drawerId = null;
  room.gameState.drawerUsername = null;
  room.gameState.targetWord = '';
  room.gameState.bannedWords = [];
  room.gameState.timeLeft = 0;

  room.connectedUsers.forEach(u => { u.role = 'LOBBY'; });

  broadcastSanitizedState(room);

  io.to(room.id).emit('return-to-lobby', { reason });
  io.to(room.id).emit('players-update', getPublicUsers(room));

  if (reason) {
    broadcastNotification(room, reason, 'info', '🎮', 3000);
  }
}

// ============================================================================
// Socket.IO Connections & Event Routing
// ============================================================================

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // 1. Matchmaking: Join Random Match
  socket.on('join-random-match', (data) => {
    const username = (data && data.username) ? String(data.username) : '';
    const sessionToken = (data && data.sessionToken) ? String(data.sessionToken) : '';
    const room = findOrCreateMatchmakingRoom();
    joinSocketToRoom(socket, room, username, sessionToken);
  });

  // 2. Custom Game: Create Custom Room
  socket.on('create-custom-game', (data) => {
    const username = (data && data.username) ? String(data.username) : '';
    const sessionToken = (data && data.sessionToken) ? String(data.sessionToken) : '';
    const room = createRoom(null, true);
    joinSocketToRoom(socket, room, username, sessionToken);
  });

  // 3. Custom Game: Join via Room ID
  socket.on('join-custom-game', (data) => {
    const username = (data && data.username) ? String(data.username) : '';
    const requestedCode = (data && data.roomId) ? String(data.roomId).trim().toUpperCase() : '';
    const sessionToken = (data && data.sessionToken) ? String(data.sessionToken) : '';

    if (!requestedCode || requestedCode.length !== 5) {
      socket.emit('join-error', { message: 'Please enter a valid 5-character Room ID.' });
      return;
    }

    const room = rooms.get(requestedCode);
    if (!room) {
      socket.emit('join-error', { message: `Room "${requestedCode}" does not exist. Check the code and try again!` });
      return;
    }

    joinSocketToRoom(socket, room, username, sessionToken);
  });

  // 4. Start Game (Room scoped - ONLY HOST CAN START)
  socket.on('start-game', () => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    if (room.hostId && room.hostId !== socket.id) {
      sendPrivateNotification(socket, 'Only the room host can start the game! 👑', 'warning', '🔒');
      return;
    }

    const activePlayers = Array.from(room.connectedUsers.values()).filter(u => !u.disconnected);
    if (activePlayers.length < MIN_ROOM_PLAYERS) {
      sendPrivateNotification(socket, `Need at least ${MIN_ROOM_PLAYERS} players to start! Invite friends using Room Code: ${room.id}`, 'warning', '👥');
      return;
    }

    if (room.gameState.mode === GAME_STATES.LOBBY || room.gameState.mode === GAME_STATES.GAME_OVER) {
      startGame(room);
    }
  });

  // 5. Leave / Return to Lobby (ONLY HOST CAN RETURN TO LOBBY)
  socket.on('leave-to-lobby', () => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    if (room.hostId && room.hostId !== socket.id) {
      sendPrivateNotification(socket, 'Only the room host can return to the lobby! 👑', 'warning', '🔒');
      return;
    }

    returnToLobby(room, 'Host returned to the Lobby.');
  });

  // 5.1 Leave Room to Home Screen (Explicit player departure)
  socket.on('leave-room', () => {
    leaveCurrentRoom(socket, true);
  });

  // 6. Drawing Stroke Handling
  socket.on('draw-stroke', (strokeData) => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    if (room.gameState.phase === PHASES.PLAYING && (room.gameState.mode !== GAME_STATES.ROUND_ACTIVE || socket.id !== room.gameState.drawerId)) {
      return;
    }
    if (!strokeData || typeof strokeData.currX !== 'number' || typeof strokeData.currY !== 'number') {
      return;
    }
    if (room.drawingHistory.length >= MAX_HISTORY) {
      room.drawingHistory.shift();
    }
    room.drawingHistory.push({ type: 'stroke', data: strokeData });
    socket.to(room.id).emit('draw-stroke', strokeData);
  });

  // 7. Drawing Dot Handling
  socket.on('draw-dot', (dotData) => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    if (room.gameState.phase === PHASES.PLAYING && (room.gameState.mode !== GAME_STATES.ROUND_ACTIVE || socket.id !== room.gameState.drawerId)) {
      return;
    }
    if (!dotData || typeof dotData.x !== 'number' || typeof dotData.y !== 'number') {
      return;
    }
    if (room.drawingHistory.length >= MAX_HISTORY) {
      room.drawingHistory.shift();
    }
    room.drawingHistory.push({ type: 'dot', data: dotData });
    socket.to(room.id).emit('draw-dot', dotData);
  });

  // 8. Clear Canvas Handling
  socket.on('clear-canvas', () => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    if (room.gameState.phase === PHASES.PLAYING && (room.gameState.mode !== GAME_STATES.ROUND_ACTIVE || socket.id !== room.gameState.drawerId)) {
      return;
    }
    room.drawingHistory = [];
    const user = room.connectedUsers.get(socket.id);
    const username = user ? user.username : 'Player';
    io.to(room.id).emit('clear-canvas', { clearedBy: username });
    broadcastNotification(room, `${username} cleared the board!`, 'info', '🧹', 2000);
  });

  // 9. Chat & Role-Based Clue/Guess Logic
  socket.on('chat-message', (data) => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    const user = room.connectedUsers.get(socket.id);
    if (!user) return;

    const rawText = (data && data.text) ? String(data.text).trim() : '';
    if (!rawText) return;

    const sanitizedText = rawText.slice(0, 300);

    // Active Round Logic
    if (room.gameState.mode === GAME_STATES.ROUND_ACTIVE) {
      const isDrawer = (socket.id === room.gameState.drawerId);

      // --- A. DESCRIBER GIVES A CLUE ---
      if (!isDrawer) {
        const check = checkTabooViolation(sanitizedText, room.gameState.targetWord, room.gameState.bannedWords);

        if (check.isViolation) {
          const penaltyPts = 30;
          user.score = Math.max(0, (user.score || 0) - penaltyPts);
          room.gameState.timeLeft = Math.max(1, room.gameState.timeLeft - 5);
          room.gameState.tabooViolations++;

          io.to(room.id).emit('taboo-violation', {
            violator: user.username,
            violatorId: socket.id,
            bannedWordUsed: check.violatedWord,
            penaltyPoints: penaltyPts,
            penaltySeconds: 5,
            newScore: user.score,
            timeLeft: room.gameState.timeLeft
          });

          io.to(room.id).emit('play-sound', { sound: 'buzzer' });

          broadcastNotification(room, `🚨 TABOO VIOLATION! ${user.username} said "${check.violatedWord.toUpperCase()}"! (-${penaltyPts} pts, -5s)`, 'danger', '🚨', 4000);
          sendPrivateNotification(socket, `⚠️ Your clue was blocked! You cannot use forbidden word "${check.violatedWord}"!`, 'danger', '🚫', 4500);

          io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));
          return;
        }

        // Clean Clue!
        io.to(room.id).emit('chat-message', {
          id: 'clue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          sender: user.username,
          color: user.color,
          text: sanitizedText,
          time: formatCurrentTime(),
          isClue: true
        });
        return;
      }

      // --- B. DRAWER MAKES A GUESS ---
      if (isDrawer) {
        const isMatch = sanitizedText.toLowerCase() === room.gameState.targetWord.toLowerCase();

        if (isMatch) {
          const timeBonus = Math.floor((room.gameState.timeLeft / room.gameState.totalTime) * 300);
          const drawerPoints = 300 + timeBonus;
          user.score = (user.score || 0) + drawerPoints;

          room.connectedUsers.forEach((u, sid) => {
            if (sid !== room.gameState.drawerId) {
              u.score = (u.score || 0) + 120;
            }
          });

          io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));

          io.to(room.id).emit('round-won', {
            winner: user.username,
            targetWord: room.gameState.targetWord,
            points: drawerPoints
          });

          io.to(room.id).emit('play-sound', { sound: 'win' });
          broadcastNotification(room, `🏆 ${user.username} deduced "${room.gameState.targetWord.toUpperCase()}"! (+${drawerPoints} pts)`, 'success', '🎉', 5000);

          endRound(room, true, `${user.username} guessed the secret word!`);
          return;
        }

        if (isCloseGuess(sanitizedText, room.gameState.targetWord)) {
          broadcastNotification(room, `🔥 Drawer's guess "${sanitizedText}" is SO CLOSE!`, 'warning', '🔥', 3000);
        }

        io.to(room.id).emit('chat-message', {
          id: 'guess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          sender: `${user.username} (Drawer)`,
          color: user.color,
          text: sanitizedText,
          time: formatCurrentTime(),
          isGuess: true
        });
        return;
      }
    }

    // Normal lobby chat
    io.to(room.id).emit('chat-message', {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      sender: user.username,
      color: user.color,
      text: sanitizedText,
      time: formatCurrentTime(),
      isSystem: false
    });
  });

  // 10. Nickname Update
  socket.on('update-username', (newUsername) => {
    const room = getSocketRoom(socket.id);
    if (!room) return;

    const user = room.connectedUsers.get(socket.id);
    if (!user) return;

    if (!newUsername || typeof newUsername !== 'string') return;
    const cleanName = newUsername.trim().slice(0, 20);
    if (!cleanName || cleanName === user.username) return;

    const oldName = user.username;
    user.username = cleanName;
    room.connectedUsers.set(socket.id, user);

    if (room.gameState.drawerId === socket.id) {
      room.gameState.drawerUsername = cleanName;
    }

    io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));
    broadcastSanitizedState(room);
    broadcastNotification(room, `${oldName} changed name to "${cleanName}"`, 'info', '✏️', 2500);
  });

  // 11. Real-Time Raw PCM Voice Streaming Relay (Free Draw & Open Mic)
  socket.on('voice-pcm', (data) => {
    const room = getSocketRoom(socket.id);
    if (!room || !data || !data.pcm) return;

    const isAllowedOpenMic = (room.gameState.phase === PHASES.LOBBY || socket.id === room.gameState.drawerId);
    if (!isAllowedOpenMic) return;

    const user = room.connectedUsers.get(socket.id);
    if (!user) return;

    socket.to(room.id).emit('voice-pcm', {
      pcm: data.pcm,
      sampleRate: data.sampleRate || 16000,
      senderId: socket.id,
      username: user.username,
      color: user.color,
      isDrawer: (socket.id === room.gameState.drawerId)
    });
  });

  // 11.1 Backward Compatible Audio Chunk Relay
  socket.on('audio-chunk', (data) => {
    const room = getSocketRoom(socket.id);
    if (!room || !data || !data.chunk) return;

    const isAllowedOpenMic = (room.gameState.phase === PHASES.LOBBY || socket.id === room.gameState.drawerId);
    if (!isAllowedOpenMic) return;

    const user = room.connectedUsers.get(socket.id);
    if (!user) return;

    socket.to(room.id).emit('audio-chunk', {
      chunk: data.chunk,
      isFirst: data.isFirst,
      mimeType: data.mimeType,
      senderId: socket.id,
      username: user.username,
      color: user.color,
      isDrawer: (socket.id === room.gameState.drawerId)
    });
  });

  // 12. Real-Time 2-Second Audio Burst Relay & Deepgram Live STT Integration
  socket.on('stt-audio-burst', async (data) => {
    const room = getSocketRoom(socket.id);
    if (!room || !data || !data.audio) return;

    const user = room.connectedUsers.get(socket.id);
    if (!user) return;

    if (room.gameState.phase !== PHASES.PLAYING || socket.id === room.gameState.drawerId) {
      return;
    }

    console.log(`[Audio Burst] Room ${room.id}: 2s voice clue from Describer ${user.username} (${data.durationMs || 0}ms). Transcribing...`);

    const rawAudioBuffer = Buffer.isBuffer(data.audio) ? data.audio : Buffer.from(data.audio);

    try {
      const sttResult = await transcribeAudioBurstViaDeepgram(rawAudioBuffer, data.mimeType || 'audio/webm');

      if (!sttResult || !sttResult.transcript || !sttResult.transcript.trim()) {
        console.log(`[Deepgram STT] No transcript detected for ${user.username}'s voice burst.`);
        sendPrivateNotification(socket, '⚠️ No audible speech detected in your 2s burst. Hold to speak and speak clearly!', 'warning', '🎙️', 3500);
        return;
      }

      const transcriptText = sttResult.transcript.trim().slice(0, 300);
      console.log(`[Deepgram STT] Transcribed "${transcriptText}" (conf: ${(sttResult.confidence || 0).toFixed(2)}) from ${user.username}`);

      // Taboo Validation during Active Round
      if (room.gameState.mode === GAME_STATES.ROUND_ACTIVE) {
        const check = checkTabooViolation(transcriptText, room.gameState.targetWord, room.gameState.bannedWords);

        if (check.isViolation) {
          const penaltyPts = 30;
          user.score = Math.max(0, (user.score || 0) - penaltyPts);
          room.gameState.timeLeft = Math.max(1, room.gameState.timeLeft - 5);
          room.gameState.tabooViolations++;

          io.to(room.id).emit('taboo-violation', {
            violator: user.username,
            violatorId: socket.id,
            bannedWordUsed: check.violatedWord,
            penaltyPoints: penaltyPts,
            penaltySeconds: 5,
            newScore: user.score,
            timeLeft: room.gameState.timeLeft,
            isVoice: true
          });

          io.to(room.id).emit('play-sound', { sound: 'buzzer' });

          broadcastNotification(room, `🚨 TABOO VIOLATION! ${user.username} said "${check.violatedWord.toUpperCase()}"! Voice & text blocked! (-${penaltyPts} pts, -5s)`, 'danger', '🚨', 4000);
          sendPrivateNotification(socket, `⚠️ Your voice clue was rejected! You said forbidden word "${check.violatedWord}"!`, 'danger', '🚫', 4500);

          io.to(room.id).emit('players-update', Array.from(room.connectedUsers.values()));
          return;
        }

        // Clean Voice Clue! Accept BOTH voice and text
        const sharedBurstId = 'voice_clue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

        io.to(room.id).emit('chat-message', {
          id: sharedBurstId,
          sender: user.username,
          color: user.color,
          text: transcriptText,
          time: formatCurrentTime(),
          isClue: true,
          isVoice: true,
          audio: data.audio,
          mimeType: data.mimeType || 'audio/webm',
          durationMs: data.durationMs || 2000,
          confidence: sttResult.confidence
        });

        socket.to(room.id).emit('stt-audio-burst', {
          burstId: sharedBurstId,
          audio: data.audio,
          durationMs: data.durationMs || 2000,
          mimeType: data.mimeType || 'audio/webm',
          senderId: socket.id,
          senderName: user.username,
          senderColor: user.color,
          transcript: transcriptText
        });

        broadcastNotification(room, `🎙️ ${user.username} sent a voice clue!`, 'info', '💡', 2200);
        return;
      }

      // Lobby voice broadcast
      const sharedLobbyBurstId = 'voice_msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

      io.to(room.id).emit('chat-message', {
        id: sharedLobbyBurstId,
        sender: user.username,
        color: user.color,
        text: transcriptText,
        time: formatCurrentTime(),
        isSystem: false,
        isVoice: true,
        audio: data.audio,
        mimeType: data.mimeType || 'audio/webm',
        durationMs: data.durationMs || 2000,
        confidence: sttResult.confidence
      });

      socket.to(room.id).emit('stt-audio-burst', {
        burstId: sharedLobbyBurstId,
        audio: data.audio,
        durationMs: data.durationMs || 2000,
        mimeType: data.mimeType || 'audio/webm',
        senderId: socket.id,
        senderName: user.username,
        senderColor: user.color,
        transcript: transcriptText
      });

    } catch (err) {
      console.error(`[Deepgram STT] Unexpected error processing audio burst:`, err.message || err);
    }
  });

  // 13. Disconnect Handling (Grace period for network drop / tab refresh)
  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, false);
  });
});

function formatCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

server.listen(PORT, () => {
  const isKeyConfigured = Boolean(process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY !== 'your_deepgram_api_key_here');
  console.log(`====================================================`);
  console.log(`🎨 Transcribble: Reverse Pictionary & Taboo Engine`);
  console.log(`🚀 Multi-Room Matchmaking Server listening on: http://localhost:${PORT}`);
  console.log(`🎙️ Deepgram STT: ${isKeyConfigured ? `Enabled (Model: ${process.env.DEEPGRAM_MODEL || 'nova-2'})` : 'Missing API Key in .env (Voice relay active, STT disabled)'}`);
  console.log(`====================================================`);
});

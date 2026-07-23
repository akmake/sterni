import mongoose from 'mongoose';
import GameInvite from '../models/GameInvite.js';
import GameMatch from '../models/GameMatch.js';
import GameUser from '../models/GameUser.js';
import { gameUserForToken } from '../middlewares/gameAuth.js';
import { sendGameInvitePush } from './gamePushService.js';

const ROUND_MS = 6_000;
const REVEAL_MS = 3_200;
const INVITE_MS = 60_000;
const MOVES = ['rock', 'paper', 'scissors'];
const socketsByUser = new Map();
const matchTimers = new Map();

const roomForUser = (userId) => `game-user:${userId}`;
const roomForMatch = (matchId) => `game-match:${matchId}`;
const asId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

export function isGameUserOnline(userId) {
  return Boolean(socketsByUser.get(String(userId))?.size);
}

export function publicGameUser(user, inGame = false) {
  return {
    id: asId(user),
    username: user.username,
    displayName: user.displayName,
    online: isGameUserOnline(asId(user)),
    inGame,
    stats: user.stats,
  };
}

function actionFailure(code, message) {
  return { ok: false, error: { code, message } };
}

function winnerIndex(first, second) {
  if (first === second) return null;
  return (
    (first === 'rock' && second === 'scissors') ||
    (first === 'paper' && second === 'rock') ||
    (first === 'scissors' && second === 'paper')
  )
    ? 0
    : 1;
}

async function populatedMatch(matchId) {
  return GameMatch.findById(matchId).populate(
    'players.user',
    'username displayName stats',
  );
}

export async function gameState(matchOrId) {
  const match =
    typeof matchOrId === 'string' || matchOrId instanceof mongoose.Types.ObjectId
      ? await populatedMatch(matchOrId)
      : matchOrId.populated?.('players.user')
        ? matchOrId
        : await populatedMatch(matchOrId._id);
  if (!match) return null;
  const reveal = match.phase === 'revealing' || match.phase === 'finished';
  const choices = reveal
    ? Object.fromEntries(
        match.players.map((player) => [asId(player.user), player.move || null]),
      )
    : undefined;
  return {
    id: match._id.toString(),
    phase: match.phase,
    round: match.round,
    players: match.players.map((player) => ({
      user: publicGameUser(player.user, ['countdown', 'revealing'].includes(match.phase)),
      locked: Boolean(player.move),
      rematchReady: player.rematchReady,
    })),
    deadline: match.deadline?.getTime?.() ?? null,
    revealAt: match.revealAt?.getTime?.() ?? null,
    choices,
    winnerId: match.winnerId?.toString() || null,
    finishReason: match.finishReason || undefined,
  };
}

async function inviteState(inviteOrId) {
  const invite = inviteOrId.populated?.('from')
    ? inviteOrId
    : await GameInvite.findById(inviteOrId).populate(
        'from to',
        'username displayName stats',
      );
  return {
    id: invite._id.toString(),
    from: publicGameUser(invite.from),
    to: publicGameUser(invite.to),
    status: invite.status,
    createdAt: invite.createdAt.getTime(),
    expiresAt: invite.expiresAt.getTime(),
  };
}

function scheduleMatch(namespace, matchId, at, callback) {
  const key = String(matchId);
  if (matchTimers.has(key)) clearTimeout(matchTimers.get(key));
  const timer = setTimeout(callback, Math.max(0, at.getTime() - Date.now()));
  timer.unref?.();
  matchTimers.set(key, timer);
}

async function emitMatch(namespace, matchId) {
  const state = await gameState(String(matchId));
  if (state) namespace.to(roomForMatch(matchId)).emit('game:state', state);
  return state;
}

async function finishReveal(namespace, matchId) {
  const match = await GameMatch.findOneAndUpdate(
    { _id: matchId, phase: 'revealing' },
    { $set: { phase: 'finished' } },
    { new: true },
  );
  if (match) await emitMatch(namespace, matchId);
  matchTimers.delete(String(matchId));
}

async function finalizeSelection(namespace, matchId) {
  const match = await GameMatch.findOne({ _id: matchId, phase: 'countdown' });
  if (!match) return;
  const [first, second] = match.players;
  let winnerId = null;
  let finishReason = 'normal';
  if (first.move && second.move) {
    const index = winnerIndex(first.move, second.move);
    winnerId = index === null ? null : match.players[index].user;
  } else {
    finishReason = 'timeout';
    if (first.move) winnerId = first.user;
    if (second.move) winnerId = second.user;
  }
  const revealAt = new Date(Date.now() + REVEAL_MS);
  const updated = await GameMatch.findOneAndUpdate(
    { _id: matchId, phase: 'countdown' },
    {
      $set: {
        phase: 'revealing',
        revealAt,
        winnerId,
        finishReason,
      },
    },
    { new: true },
  );
  if (!updated) return;

  const firstId = asId(first.user);
  const secondId = asId(second.user);
  if (!winnerId) {
    await GameUser.updateMany(
      { _id: { $in: [firstId, secondId] } },
      { $inc: { 'stats.draws': 1 } },
    );
  } else {
    const winner = asId(winnerId);
    const loser = winner === firstId ? secondId : firstId;
    await Promise.all([
      GameUser.updateOne({ _id: winner }, { $inc: { 'stats.wins': 1 } }),
      GameUser.updateOne({ _id: loser }, { $inc: { 'stats.losses': 1 } }),
    ]);
  }
  await emitMatch(namespace, matchId);
  scheduleMatch(namespace, matchId, revealAt, () =>
    finishReveal(namespace, matchId).catch((error) =>
      console.error('[GAME] finish reveal failed:', error),
    ),
  );
}

async function beginMatch(namespace, firstId, secondId) {
  const deadline = new Date(Date.now() + ROUND_MS);
  const match = await GameMatch.create({
    players: [{ user: firstId }, { user: secondId }],
    phase: 'countdown',
    round: 1,
    deadline,
  });
  namespace.in(roomForUser(firstId)).socketsJoin(roomForMatch(match._id));
  namespace.in(roomForUser(secondId)).socketsJoin(roomForMatch(match._id));
  await emitMatch(namespace, match._id);
  scheduleMatch(namespace, match._id, deadline, () =>
    finalizeSelection(namespace, match._id).catch((error) =>
      console.error('[GAME] selection timeout failed:', error),
    ),
  );
  return match;
}

async function userHasActiveMatch(userId) {
  return Boolean(
    await GameMatch.exists({
      'players.user': userId,
      phase: { $in: ['countdown', 'revealing'] },
    }),
  );
}

async function handleInviteSend(namespace, from, targetId) {
  if (!mongoose.isValidObjectId(targetId))
    return actionFailure('USER_NOT_FOUND', 'המשתמש לא נמצא');
  if (asId(from) === String(targetId))
    return actionFailure('SELF_INVITE', 'אי אפשר להזמין את עצמך');
  const target = await GameUser.findById(targetId);
  if (!target) return actionFailure('USER_NOT_FOUND', 'המשתמש לא נמצא');
  if (await userHasActiveMatch(from._id))
    return actionFailure('ALREADY_IN_GAME', 'אתה כבר במשחק');
  if (await userHasActiveMatch(target._id))
    return actionFailure('USER_BUSY', 'השחקן נמצא במשחק אחר');

  const existing = await GameInvite.findOne({
    status: 'pending',
    expiresAt: { $gt: new Date() },
    $or: [
      { from: from._id, to: target._id },
      { from: target._id, to: from._id },
    ],
  });
  if (existing)
    return actionFailure('INVITE_EXISTS', 'כבר קיימת הזמנה פעילה ביניכם');

  const invite = await GameInvite.create({
    from: from._id,
    to: target._id,
    expiresAt: new Date(Date.now() + INVITE_MS),
  });
  await invite.populate('from to', 'username displayName stats');
  const state = await inviteState(invite);
  namespace.to(roomForUser(target._id)).emit('invite:received', state);
  namespace.to(roomForUser(from._id)).emit('invite:updated', state);
  sendGameInvitePush(target._id, from.displayName, invite._id).catch((error) =>
    console.error('[GAME PUSH] invite failed:', error.message),
  );
  return { ok: true, data: state };
}

async function handleInviteResponse(namespace, user, inviteId, accept) {
  if (!mongoose.isValidObjectId(inviteId))
    return actionFailure('INVITE_NOT_FOUND', 'ההזמנה לא נמצאה');
  const invite = await GameInvite.findOne({
    _id: inviteId,
    to: user._id,
    status: 'pending',
  }).populate('from to', 'username displayName stats');
  if (!invite) return actionFailure('INVITE_CLOSED', 'ההזמנה כבר אינה פעילה');
  if (invite.expiresAt <= new Date()) {
    invite.status = 'expired';
    await invite.save();
    return actionFailure('INVITE_EXPIRED', 'תוקף ההזמנה פג');
  }
  if (!accept) {
    invite.status = 'declined';
    invite.respondedAt = new Date();
    await invite.save();
    const state = await inviteState(invite);
    namespace.to(roomForUser(invite.from)).emit('invite:updated', state);
    return { ok: true, data: state };
  }
  if (
    (await userHasActiveMatch(invite.from._id)) ||
    (await userHasActiveMatch(invite.to._id))
  ) {
    return actionFailure('PLAYER_BUSY', 'אחד השחקנים כבר נמצא במשחק');
  }
  const claimed = await GameInvite.findOneAndUpdate(
    { _id: invite._id, status: 'pending' },
    { $set: { status: 'accepted', respondedAt: new Date() } },
    { new: true },
  ).populate('from to', 'username displayName stats');
  if (!claimed) return actionFailure('INVITE_CLOSED', 'ההזמנה כבר טופלה');
  const match = await beginMatch(namespace, claimed.from._id, claimed.to._id);
  const state = { ...(await inviteState(claimed)), gameId: match._id.toString() };
  namespace.to(roomForUser(claimed.from)).emit('invite:updated', state);
  namespace.to(roomForUser(claimed.to)).emit('invite:updated', state);
  return { ok: true, data: state };
}

async function handleChoose(namespace, user, { gameId, move, actionId }) {
  if (!MOVES.includes(move))
    return actionFailure('BAD_MOVE', 'בחירה לא חוקית');
  if (!mongoose.isValidObjectId(gameId) || !actionId)
    return actionFailure('GAME_NOT_FOUND', 'המשחק לא נמצא');
  const existing = await GameMatch.findOne({
    _id: gameId,
    processedActionIds: actionId,
    'players.user': user._id,
  });
  if (existing) return { ok: true, data: { locked: true } };

  const match = await GameMatch.findOneAndUpdate(
    {
      _id: gameId,
      phase: 'countdown',
      deadline: { $gt: new Date() },
      players: {
        $elemMatch: { user: user._id, move: null },
      },
    },
    {
      $set: {
        'players.$.move': move,
        'players.$.lockedAt': new Date(),
      },
      $addToSet: { processedActionIds: actionId },
    },
    { new: true },
  );
  if (!match) return actionFailure('ROUND_CLOSED', 'הבחירה כבר נעולה או שהזמן הסתיים');
  await emitMatch(namespace, gameId);
  if (match.players.every((player) => player.move)) {
    await finalizeSelection(namespace, gameId);
  }
  return { ok: true, data: { locked: true } };
}

async function handleRematch(namespace, user, gameId, ready) {
  const match = await GameMatch.findOneAndUpdate(
    {
      _id: gameId,
      phase: 'finished',
      'players.user': user._id,
    },
    { $set: { 'players.$.rematchReady': Boolean(ready) } },
    { new: true },
  );
  if (!match) return actionFailure('GAME_NOT_FINISHED', 'המשחק עדיין לא הסתיים');
  if (match.players.every((player) => player.rematchReady)) {
    const deadline = new Date(Date.now() + ROUND_MS);
    const historyEntry = {
      number: match.round,
      moves: match.players
        .filter((player) => player.move)
        .map((player) => ({ user: player.user, move: player.move })),
      winnerId: match.winnerId,
      reason: match.finishReason,
      startedAt: new Date(match.deadline.getTime() - ROUND_MS),
      finishedAt: new Date(),
    };
    const restarted = await GameMatch.findOneAndUpdate(
      {
        _id: gameId,
        phase: 'finished',
        players: { $not: { $elemMatch: { rematchReady: false } } },
      },
      {
        $inc: { round: 1 },
        $set: {
          phase: 'countdown',
          deadline,
          revealAt: null,
          winnerId: null,
          finishReason: null,
          'players.$[].move': null,
          'players.$[].lockedAt': null,
          'players.$[].rematchReady': false,
          processedActionIds: [],
        },
        $push: { history: historyEntry },
      },
      { new: true },
    );
    if (restarted) {
      await emitMatch(namespace, gameId);
      scheduleMatch(namespace, gameId, deadline, () =>
        finalizeSelection(namespace, gameId).catch(console.error),
      );
    }
  } else {
    await emitMatch(namespace, gameId);
  }
  return { ok: true, data: await gameState(gameId) };
}

export async function setupGameSocketIO(io) {
  const namespace = io.of('/game');
  namespace.use(async (socket, next) => {
    const authToken = socket.handshake.auth?.token;
    const authHeader = socket.handshake.headers.authorization || '';
    const token = authToken || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
    const user = await gameUserForToken(token);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.gameUser = user;
    next();
  });

  namespace.on('connection', async (socket) => {
    const user = socket.gameUser;
    const userId = asId(user);
    const sockets = socketsByUser.get(userId) || new Set();
    sockets.add(socket.id);
    socketsByUser.set(userId, sockets);
    socket.join(roomForUser(userId));
    namespace.emit('presence:update', publicGameUser(user));

    socket.on('invite:send', async ({ userId: targetId }, ack) => {
      ack(await handleInviteSend(namespace, user, targetId));
    });
    socket.on('invite:respond', async ({ inviteId, accept }, ack) => {
      ack(await handleInviteResponse(namespace, user, inviteId, Boolean(accept)));
    });
    socket.on('game:join', async ({ gameId }, ack) => {
      const match = await populatedMatch(gameId);
      if (!match || !match.players.some((player) => asId(player.user) === userId)) {
        return ack(actionFailure('GAME_NOT_FOUND', 'המשחק לא נמצא'));
      }
      socket.join(roomForMatch(gameId));
      ack({ ok: true, data: await gameState(match) });
    });
    socket.on('game:choose', async (payload, ack) => {
      ack(await handleChoose(namespace, user, payload));
    });
    socket.on('game:rematch', async ({ gameId, ready }, ack) => {
      ack(await handleRematch(namespace, user, gameId, ready));
    });
    socket.on('disconnect', () => {
      sockets.delete(socket.id);
      if (!sockets.size) socketsByUser.delete(userId);
      namespace.emit('presence:update', publicGameUser(user));
    });
  });

  const activeMatches = await GameMatch.find({
    phase: { $in: ['countdown', 'revealing'] },
  });
  for (const match of activeMatches) {
    if (match.phase === 'countdown') {
      scheduleMatch(namespace, match._id, match.deadline || new Date(), () =>
        finalizeSelection(namespace, match._id).catch(console.error),
      );
    } else {
      scheduleMatch(namespace, match._id, match.revealAt || new Date(), () =>
        finishReveal(namespace, match._id).catch(console.error),
      );
    }
  }
  console.log('✔ Game Socket.IO namespace initialized at /game');
}


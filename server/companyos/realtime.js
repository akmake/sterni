import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { CompanyMember } from './models.js';

let namespace = null;

const userRoom = (userId) => `user:${userId}`;
const teamRoom = (orgId) => `org:${orgId}:team`;
const everyoneRoom = (orgId) => `org:${orgId}:all`;

export const setupCompanySocket = (io) => {
  namespace = io.of('/company');

  namespace.use((socket, next) => {
    try {
      const cookies = parse(socket.handshake.headers.cookie || '');
      socket.data.userId = jwt.verify(cookies.jwt, process.env.JWT_ACCESS_SECRET).id;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  namespace.on('connection', async (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));
    const memberships = await CompanyMember.find({ userId, status: 'active' }).select('organizationId role');
    memberships.forEach(({ organizationId, role }) => {
      socket.join(everyoneRoom(organizationId));
      // Guests don't belong in public channels, so they stay out of this room.
      if (role !== 'guest') socket.join(teamRoom(organizationId));
    });
    socket.emit('ready');
  });
};

// Rooms are fixed at connect time, so any role or status change forces a reconnect.
export const dropUser = (userId) => {
  namespace?.in(userRoom(userId)).disconnectSockets(true);
};

export const emitToTeam = (orgId, event, payload) => {
  namespace?.to(teamRoom(orgId)).emit(event, payload);
};

export const emitToUsers = (userIds, event, payload) => {
  if (!namespace || userIds.length === 0) return;
  namespace.to(userIds.map(userRoom)).emit(event, payload);
};

// A content-free nudge: each client refetches through the API with its own access.
export const notifyWorkChanged = (req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) namespace?.to(everyoneRoom(req.organization._id)).emit('work_changed');
    });
  }
  next();
};

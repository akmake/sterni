import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import Family from '../models/Family.js';
import User from '../models/userModel.js';

export function setupSocketIO(io) {
  // Authentication middleware for Socket.IO - read JWT from cookies
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies.jwt;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: ${socket.userId}`);

    // ★ Admins join the 'admins' room — receive visitor-intelligence alerts
    try {
      const u = await User.findById(socket.userId).select('role').lean();
      if (u?.role === 'admin') {
        socket.join('admins');
        socket.isAdmin = true;
      }
    } catch (err) {
      console.error('Error joining admins room:', err.message);
    }

    // Auto-join user to their family room
    try {
      const family = await Family.findOne({ 'members.user': socket.userId });
      if (family) {
        const roomName = `family:${family._id}`;
        socket.join(roomName);
        socket.familyRoom = roomName;
        console.log(`👨‍👩‍👧‍👦 User ${socket.userId} joined room ${roomName}`);
      }
    } catch (err) {
      console.error('Error joining family room:', err.message);
    }

    // Handle manual room join (e.g., after creating/joining family)
    socket.on('family:join', async () => {
      try {
        const family = await Family.findOne({ 'members.user': socket.userId });
        if (family) {
          const roomName = `family:${family._id}`;
          socket.join(roomName);
          socket.familyRoom = roomName;
        }
      } catch (err) {
        console.error('Error joining family room:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });

  console.log('✔ Socket.IO initialized');
}

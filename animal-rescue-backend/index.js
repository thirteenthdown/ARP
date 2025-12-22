// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./src/db');

const authRoutes = require('./src/routes/auth');
const reportsRoutesFactory = require('./src/routes/reports');

const ngeohash = require('ngeohash');

const GEOHASH_PRECISION = parseInt(process.env.GEOHASH_PRECISION || '6', 10); // default 6 (~1.2km)

const app = express();
app.use("/uploads", express.static("uploads"));

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => res.send('Animal Rescue API — running'));
app.get('/health/db', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT now()');
    res.json({ db: rows[0].now });
  } catch (err) {
    console.error('DB health error', err);
    res.status(500).json({ error: 'db error', details: err.message });
  }
});

app.use('/auth', authRoutes);

// create server and io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// --- Secure Socket Authentication ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.log("Socket auth failed: missing token");
    return next(new Error("AUTH_REQUIRED"));
  }

  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // store user info on socket
    socket.data.user = {
      id: payload.userId
    };

    console.log("Socket auth success for user:", payload.userId);
    return next();
  } catch (err) {
    console.log("Socket auth failed:", err.message);
    return next(new Error("INVALID_TOKEN"));
  }
});


// Socket.IO: connection and geohash rooming
io.on('connection', (socket) => {
  console.log("Socket connected:", socket.id, "user:", socket.data.user?.id);

  // track geohash
  socket.data.geohash = null;

  socket.on('set_location', (payload) => {
    try {
      if (!payload || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
        return socket.emit('error', { message: 'Invalid {lat,lng}' });
      }

      const { lat, lng } = payload;

      const newGh = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
      const prevGh = socket.data.geohash;

      if (prevGh && prevGh !== newGh) {
        socket.leave(prevGh);
        console.log(`Socket ${socket.id} left ${prevGh}`);
      }

      socket.join(newGh);
      socket.data.geohash = newGh;

      console.log(`Socket ${socket.id} joined room ${newGh} (user ${socket.data.user.id})`);
      socket.emit('location_updated', { geohash: newGh });

    } catch (err) {
      console.error("set_location error", err);
      socket.emit("error", { message: "internal error" });
    }
  });

  socket.on('disconnect', () => {
    console.log("Socket disconnected:", socket.id);
  });
});


// mount reports routes AFTER io created, pass io to router
const reportsRoutes = reportsRoutesFactory(io, { ngeohash, GEOHASH_PRECISION });
app.use('/reports', reportsRoutes);

// optional debug route to list sockets (dev)
app.get('/__debug/sockets', (req, res) => {
  try {
    const clients = Array.from(io.sockets.sockets.keys());
    res.json({ count: clients.length, clients });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

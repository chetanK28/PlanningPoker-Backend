const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const os = require("os");
 
const app = express();
const server = http.createServer(app);
 
const io = socketIo(server, {
  cors: {
    /**
     * For quick local dev:
     * - origin: true  -> reflects the request origin (works with most dev setups)
     * - credentials: false -> matches the client (no withCredentials)
     *
     * If you later set withCredentials: true on client, switch to:
     *   origin: "https://your-frontend-domain"
     *   credentials: true
     */
    origin: true,
    credentials: false,
    methods: ["GET", "POST"],
  },
});
 
app.use(cors({ origin: true, credentials: false }));
 
const PORT = process.env.PORT || 3001;
 
// Simple HTTP health check
app.get("/", (req, res) => {
  res.send("🟢 Socket.IO server is running.");
});
 
// Print LAN IPv4s
function getLocalIPv4List() {
  const map = os.networkInterfaces();
  const ips = [];
  Object.keys(map).forEach((name) => {
    for (const iface of map[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  });
  return ips;
}
 
// In-memory room state
let rooms = {};
 
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);
 
  socket.on("join-room", ({ room, username, role }) => {
    if (!room || !username || !role) {
      console.warn("❗ Invalid join-room payload");
      return;
    }
 
    socket.join(room);
 
    if (!rooms[room]) {
      rooms[room] = { users: {}, votes: {}, usernames: {}, title: "", description: "" };
    }
 
    rooms[room].users[socket.id] = { username, role };
    rooms[room].usernames[socket.id] = username;
 
    console.log(`📌 ${username} joined room "${room}" as ${role}`);
    io.to(room).emit("room-update", rooms[room]);
  });
 
  socket.on("vote", ({ room, vote, username }) => {
    if (!rooms[room] || !username) return;
    rooms[room].votes[username] = vote;
    console.log(`🗳️ ${username} voted in room "${room}": ${vote}`);
    io.to(room).emit("vote-update", rooms[room].votes);
  });
 
  socket.on("reveal-votes", (room) => {
    if (!rooms[room]) return;
    console.log(`🎯 Revealing votes in room "${room}"`);
    io.to(room).emit("reveal", rooms[room].votes);
  });
 
  socket.on("reset-votes", (room) => {
    if (!rooms[room]) return;
    rooms[room].votes = {};
    io.to(room).emit("vote-update", {});
    io.to(room).emit("reset");
    console.log(`♻️ Votes reset in room "${room}"`);
  });
 
  socket.on("set-title-description", ({ room, title, description, username }) => {
    if (rooms[room]) {
      rooms[room].title = title;
      rooms[room].description = description;
      io.to(room).emit("title-description-updated", { title, description });
 
      const notification = `${username} updated the title and description.`;
      io.to(room).emit("notification", notification);
 
      console.log(`📝 ${username} updated room "${room}" with title and description.`);
    }
  });
 
  socket.on("disconnect", () => {
    console.log("🔌 User disconnected:", socket.id);
    for (const room in rooms) {
      const username = rooms[room].usernames[socket.id];
      if (username) {
        delete rooms[room].users[socket.id];
        delete rooms[room].usernames[socket.id];
        delete rooms[room].votes[username];
        console.log(`❌ ${username} left room "${room}"`);
        io.to(room).emit("room-update", rooms[room]);
 
        if (
          Object.keys(rooms[room].users).length === 0 &&
          Object.keys(rooms[room].votes).length === 0
        ) {
          delete rooms[room];
          console.log(`🧹 Room "${room}" deleted (empty)`);
        }
      }
    }
  });
});
 
// Extra logging for low-level engine errors
io.engine.on("connection_error", (err) => {
  console.error("⚠️ engine connection_error", {
    code: err.code,
    message: err.message,
    context: err.context,
  });
});
 
// 0.0.0.0 so it's reachable on LAN / containers
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  const ips = getLocalIPv4List();
  if (ips.length) {
    console.log("🌐 Reachable on your LAN at:");
    ips.forEach(({ name, address }) => {
      console.log(`   • ${name}: http://${address}:${PORT}`);
    });
  } else {
    console.log("ℹ️ No non-internal IPv4 addresses detected.");
  }
});
 

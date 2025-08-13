const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
 
const app = express();
const server = http.createServer(app);
 
// allow your SWA origin
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "https://blue-ground-028888400.1.azurestaticapps.net";
 
const corsOptions = {
  origin: FRONTEND_ORIGIN,
  methods: ["GET", "POST"],
  credentials: false,
};
 
const io = socketIo(server, { cors: corsOptions });
app.use(cors(corsOptions));
 
const PORT = process.env.PORT || 3001;
 
// Root + Health
app.get("/", (req, res) => res.send("🟢 Socket.IO server is running."));
app.get("/health", (req, res) => res.json({ ok: true }));
 
// ---- In-memory room state ----
let rooms = {};
 
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);
 
  socket.on("join-room", ({ room, username, role }) => {
    if (!room || !username || !role) return;
    socket.join(room);
    rooms[room] ||= { users: {}, votes: {}, usernames: {}, title: "", description: "" };
    rooms[room].users[socket.id] = { username, role };
    rooms[room].usernames[socket.id] = username;
    io.to(room).emit("room-update", rooms[room]);
  });
 
  socket.on("vote", ({ room, vote, username }) => {
    if (!rooms[room] || !username) return;
    rooms[room].votes[username] = vote;
    io.to(room).emit("vote-update", rooms[room].votes);
  });
 
  socket.on("reveal-votes", (room) => {
    if (!rooms[room]) return;
    io.to(room).emit("reveal", rooms[room].votes);
  });
 
  socket.on("reset-votes", (room) => {
    if (!rooms[room]) return;
    rooms[room].votes = {};
    io.to(room).emit("vote-update", {});
    io.to(room).emit("reset");
  });
 
  socket.on("set-title-description", ({ room, title, description, username }) => {
    if (!rooms[room]) return;
    rooms[room].title = title;
    rooms[room].description = description;
    io.to(room).emit("title-description-updated", { title, description });
    io.to(room).emit("notification", `${username} updated the title and description.`);
  });
 
  socket.on("disconnect", () => {
    for (const room in rooms) {
      const username = rooms[room].usernames[socket.id];
      if (!username) continue;
      delete rooms[room].users[socket.id];
      delete rooms[room].usernames[socket.id];
      delete rooms[room].votes[username];
      io.to(room).emit("room-update", rooms[room]);
      if (!Object.keys(rooms[room].users).length && !Object.keys(rooms[room].votes).length) {
        delete rooms[room];
      }
    }
  });
});
 
io.engine.on("connection_error", (err) => {
  console.error("⚠️ engine connection_error", {
    code: err.code, message: err.message, context: err.context,
  });
});
 
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend listening on :${PORT}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
});

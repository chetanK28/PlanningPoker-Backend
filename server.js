const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
 
const app = express();
const server = http.createServer(app);
 
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
 
app.use(cors());
 
const PORT = process.env.PORT || 3001;
 
// Test route to check server from browser
app.get("/", (req, res) => {
  res.send("🟢 Socket.IO server is running.");
});
 
// Room structure
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
 
  // Scrum Master sets title and description with username for notification
  socket.on("set-title-description", ({ room, title, description, username }) => {
    if (rooms[room]) {
      rooms[room].title = title;
      rooms[room].description = description;
      io.to(room).emit("title-description-updated", { title, description });
 
      // 🔔 Send notification to all users
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
 
// 👇 Binding to 0.0.0.0 allows LAN access
const HOST = process.env.HOST || "0.0.0.0"; // Bind to all interfaces
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});

 
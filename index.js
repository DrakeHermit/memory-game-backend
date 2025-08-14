import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import {
  createRoom,
  joinRoom,
  getRoom,
  getAllRooms,
} from "./utils/roomManager.js";

const activeRooms = new Map();

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
    ],
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "Memory Game Backend API", status: "running" });
});

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on("createRoom", ({ roomId, maxPlayers, theme, gridSize }) => {
    const room = createRoom(roomId, maxPlayers, theme, gridSize, socket.id);
    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${socket.id}`);
    console.log(`Active rooms: ${activeRooms.entries()}`);
    socket.emit("roomCreated", { roomId, room });
  });

  socket.on("joinRoom", ({ roomId, playerName }) => {
    const room = joinRoom(roomId, socket.id, playerName);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    socket.join(roomId);

    console.log(`Player ${socket.id} joined room ${roomId}`);
    console.log("Active rooms:", Array.from(activeRooms.entries()));

    io.to(roomId).emit("playerJoined", {
      playerId: socket.id,
      playerName,
      currentPlayers: room.currentPlayers,
      maxPlayers: room.maxPlayers,
    });
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/health`);
});

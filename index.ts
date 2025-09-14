import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import {
  createRoom,
  joinRoom,
} from "./utils/roomManager.js";
import gameManager from "./utils/gameManager.js";

interface CreateRoomData {
  roomId: string;
  maxPlayers: string;
  theme: string;
  gridSize: number;
  playerName: string;
}

interface JoinRoomData {
  roomId: string;
  playerName: string;
}

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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on("createRoom", ({ roomId, maxPlayers, theme, gridSize, playerName }: CreateRoomData) => {
    const room = createRoom(roomId, parseInt(maxPlayers), theme, gridSize, socket.id);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    // Add room creator to game state
    const gameResult = gameManager.addPlayer(roomId, socket.id, playerName);
    if (gameResult.error) {
      socket.emit("roomError", { message: gameResult.error });
      return;
    }

    socket.join(roomId);

    console.log(`Room created: ${roomId} by ${socket.id}`);
    socket.emit("roomCreated", { roomId, room });
  });


  socket.on("joinRoom", ({ roomId, playerName }: JoinRoomData) => {
    const room = joinRoom(roomId, socket.id, playerName);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    console.log('Join attempt - roomId:', roomId, 'playerName:', playerName);

    const gameResult = gameManager.addPlayer(roomId, socket.id, playerName);
    socket.join(roomId);


    if (!gameResult.error) {
      io.to(roomId).emit("gameState", gameResult); 
    }

    console.log(`Player ${socket.id} joined room ${roomId}`);

    io.to(roomId).emit("playerJoined", {
      playerId: socket.id,
      playerName,
      currentPlayers: room.room?.currentPlayers,
      maxPlayers: room.room?.maxPlayers,
    });
  });

  socket.on("changePlayerName", ({ roomId, newName }: { roomId: string; newName: string }) => {
    const result = gameManager.changePlayerName(roomId, socket.id, newName);
    
    if (result.error) {
      socket.emit("nameChangeError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("playerNameChanged", { 
      playerId: socket.id, 
      newName 
    });
  });

  socket.on("getGameState", ({ roomId }: { roomId: string }) => {
    const result = gameManager.getGameState(roomId);
    
    if (result.error) {
      socket.emit("gameStateError", { message: result.error });
      return;
    }
    
    socket.emit("gameState", result);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
});

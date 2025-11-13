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
  theme: string;
  gridSize: number;
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
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on("createRoom", ({ roomId, maxPlayers, theme, gridSize, playerName }: CreateRoomData) => {
    const room = createRoom(roomId, parseInt(maxPlayers), theme, gridSize, socket.id);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    const gameResult = gameManager.addPlayer(roomId, socket.id, playerName, theme, gridSize);
    if (gameResult.error) {
      socket.emit("roomError", { message: gameResult.error });
      return;
    }

    socket.join(roomId);
    socket.emit("roomCreated", { roomId, room });
    
    socket.emit("gameState", gameResult);
  });

  socket.on("joinRoom", ({ roomId, playerName, theme, gridSize }: JoinRoomData) => {
    const room = joinRoom(roomId, socket.id, playerName);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    const gameResult = gameManager.addPlayer(roomId, socket.id, playerName, theme, gridSize);
    socket.join(roomId);


    if (!gameResult.error) {
      io.to(roomId).emit("gameState", gameResult); 
    }

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

  socket.on("togglePlayerReady", ({ roomId }: { roomId: string }) => {
    const result = gameManager.togglePlayerReady(roomId, socket.id);
    
    if (result.error) {
      socket.emit("readyToggleError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("gameState", result);
  });

  socket.on("getGameState", ({ roomId }: { roomId: string }) => {
    const result = gameManager.getGameState(roomId);
    
    if (result.error) {
      socket.emit("gameStateError", { message: result.error });
      return;
    }
    
    socket.emit("gameState", result);
  });

  socket.on("startGame", ({ roomId }: { roomId: string }) => {
    const result = gameManager.startGame(roomId);
    
    if (result.error) {
      socket.emit("startGameError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gameStarted");
  });

  socket.on("flipCoin", ({ roomId, coinId }: { roomId: string; playerId: string; coinId: number }) => {
    const result = gameManager.flipCoin(roomId, socket.id, coinId);
    
    if (result.error) {
      socket.emit("flipCoinError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("gameState", result);

    if (result.shouldCheckForMatch) {
      const gameState = gameManager.getGameState(roomId);
      const flippedCoins = gameState.gameState?.flippedCoins || [];

      setTimeout(() => {
        const matchResult = gameManager.checkForMatch(roomId);

        if('error' in matchResult) {
          socket.emit("checkForMatchError", { message: matchResult.error });
          return;
        }

        if (!matchResult.isMatch && matchResult.coinsToFlipBack) {
          io.to(roomId).emit("flipCoinsBack", matchResult.coinsToFlipBack);
        }

        const gameState = gameManager.getGameState(roomId);
        if (gameState.gameState) {
          gameState.gameState.isProcessing = false;
        }

        const updateState = gameManager.getGameState(roomId);
        io.to(roomId).emit("gameState", updateState);
      }, 800);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

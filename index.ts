import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  removeRoom,
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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
].filter(Boolean) as string[];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

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

    socket.emit("joinRoom", roomId);

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

  socket.on("leaveRoom", ({ roomId }: { roomId: string }) => {
    const result = leaveRoom(roomId, socket.id);
    if (result.error) {
      socket.emit("leaveRoomError", { message: result.error });
      return;
    }
    
    const gameResult = gameManager.removePlayer(roomId, socket.id);
    
    console.log("Player left room", socket.id);
    console.log("Players in room", result.room?.players);
    socket.leave(roomId);
    
    io.to(roomId).emit("playerLeftRoom", {
      playerId: socket.id,
      playerLeftDuringGame: gameResult.playerLeftDuringGame || false,
      leftPlayerName: gameResult.leftPlayer?.name || "A player"
    });
    
    if (!gameResult.error) {
      io.to(roomId).emit("gameState", { gameState: gameResult.gameState });
    }
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

  socket.on("pauseGame", ({ roomId }: { roomId: string }) => {
    const result = gameManager.pauseGame(roomId, socket.id);
    if (result.error) {
      socket.emit("pauseGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gamePaused");
  });

  socket.on("resumeGame", ({ roomId }: { roomId: string }) => {
    const result = gameManager.resumeGame(roomId, socket.id);
    if (result.error) {
      socket.emit("resumeGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gameResumed");
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

      setTimeout(() => {
        const matchResult = gameManager.checkForMatch(roomId);

        if('error' in matchResult) {
          socket.emit("checkForMatchError", { message: matchResult.error });
          return;
        }

        if (!matchResult.isMatch && matchResult.coinsToFlipBack) {
          io.to(roomId).emit("flipCoinsBack", matchResult.coinsToFlipBack);
        }

        if (gameState.gameState) {
          const gameState = gameManager.getGameState(roomId);
          gameState!.gameState!.isProcessing = false;
        }

        const updateState = gameManager.getGameState(roomId);
        io.to(roomId).emit("gameState", updateState);

        const gridSize = updateState.gameState?.gridSize ?? 0;
        const matchedPairs = updateState.gameState?.matchedPairs.length ?? 0;
        const totalCoins = gridSize * gridSize;
        
        
        if (matchedPairs === totalCoins) {
          const finalState = gameManager.gameOver(roomId);
          console.log("Game over");
          io.to(roomId).emit("gameState", finalState);
        }
      }, 800);
    }
  });

  socket.on("removeRoom", ({ roomId }: { roomId: string }) => {
    const result = removeRoom(roomId);
    if (result.error) {
      socket.emit("removeRoomError", { message: result.error });
      return;
    }
  });

  socket.on("resetGame", ({ roomId }: { roomId: string }) => {
    const result = gameManager.resetGame(roomId);
    if (result.error) {
      socket.emit("resetGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gameReset");
    removeRoom(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

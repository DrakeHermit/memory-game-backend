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
  playerId: string;
}

interface JoinRoomData {
  roomId: string;
  playerName: string;
  playerId: string;
  theme?: string;
  gridSize?: number;
}

interface RegisterData {
  playerId: string;
  roomId?: string;
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

const playerSocketMap = new Map<string, string>();

const cleanupPlayerMapping = (playerId: string): void => {
  playerSocketMap.delete(playerId);
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

io.on("connection", (socket) => {
  socket.on("register", ({ playerId, roomId }: RegisterData) => {
    if (!playerId) {
      socket.emit("registerError", { message: "PlayerId is required" });
      return;
    }

    playerSocketMap.set(playerId, socket.id);
    
    let reconnected = false;
    
    if (roomId) {
      const gameResult = gameManager.getGameState(roomId);
      
      if (!gameResult.error && gameResult.gameState) {
        const existingPlayer = gameResult.gameState.players.find(p => p.id === playerId);
        
        if (existingPlayer) {
          socket.join(roomId);
          reconnected = true;
          
          socket.emit("gameState", gameResult);
        }
      
      }
    }
    
    socket.emit("registered", { success: true, reconnected });
  });

  socket.on("createRoom", ({ roomId, maxPlayers, theme, gridSize, playerName, playerId }: CreateRoomData) => {
    if (!playerId) {
      socket.emit("roomError", { message: "PlayerId is required" });
      return;
    }

    playerSocketMap.set(playerId, socket.id);

    const room = createRoom(roomId, parseInt(maxPlayers), theme, gridSize, playerId);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    const gameResult = gameManager.addPlayer(roomId, playerId, playerName, theme, gridSize);
    if (gameResult.error) {
      socket.emit("roomError", { message: gameResult.error });
      return;
    }

    socket.join(roomId);
    socket.emit("roomCreated", { roomId, room });
    
    socket.emit("gameState", gameResult);
  });

  socket.on("joinRoom", ({ roomId, playerName, playerId, theme, gridSize }: JoinRoomData) => {
    if (!playerId) {
      socket.emit("roomError", { message: "PlayerId is required" });
      return;
    }

    playerSocketMap.set(playerId, socket.id);

    const room = joinRoom(roomId, playerId, playerName);

    if (room.error) {
      socket.emit("roomError", { message: room.error });
      return;
    }

    const gameResult = gameManager.addPlayer(roomId, playerId, playerName, theme || '', gridSize || 0);
    socket.join(roomId);

    socket.emit("joinRoom", roomId);

    if (!gameResult.error) {
      io.to(roomId).emit("gameState", gameResult); 
    }

    io.to(roomId).emit("playerJoined", {
      playerId: playerId,
      playerName,
      currentPlayers: room.room?.currentPlayers,
      maxPlayers: room.room?.maxPlayers,
    });
  });

  socket.on("leaveRoom", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("leaveRoomError", { message: "PlayerId is required" });
      return;
    }

    const result = leaveRoom(roomId, playerId);
    if (result.error) {
      socket.emit("leaveRoomError", { message: result.error });
      return;
    }
    
    const gameResult = gameManager.removePlayer(roomId, playerId);
    
    io.to(roomId).emit("playerLeftRoom", {
      playerId: playerId,
      playerLeftDuringGame: gameResult.playerLeftDuringGame || false,
      leftPlayerName: gameResult.leftPlayer?.name || "A player"
    });
    
    if (!gameResult.error) {
      io.to(roomId).emit("gameState", { gameState: gameResult.gameState });
    }
    
    socket.leave(roomId);
    
    cleanupPlayerMapping(playerId);
  });

  socket.on("changePlayerName", ({ roomId, newName, playerId }: { roomId: string; newName: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("nameChangeError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.changePlayerName(roomId, playerId, newName);
    
    if (result.error) {
      socket.emit("nameChangeError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("playerNameChanged", { 
      playerId: playerId, 
      newName 
    });
    io.to(roomId).emit("gameState", result);
  });

  socket.on("togglePlayerReady", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("readyToggleError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.togglePlayerReady(roomId, playerId);
    
    if (result.error) {
      socket.emit("readyToggleError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("gameState", result);
  });

  socket.on("getGameState", ({ roomId, playerId }: { roomId: string; playerId?: string }) => {
    const result = gameManager.getGameState(roomId);
    
    if (result.error) {
      socket.emit("gameStateError", { message: result.error });
      return;
    }
    
    socket.emit("gameState", result);
  });

  socket.on("rejoinRoom", ({ roomId, playerId }: { roomId: string; playerId?: string }) => {
    socket.join(roomId);
  
    const result = gameManager.getGameState(roomId);
    if (!result.error) {
      socket.emit("gameState", result);
    } 
  });

  socket.on("startGame", ({ roomId, playerId }: { roomId: string; playerId?: string }) => {
    const result = gameManager.startGame(roomId);
    
    if (result.error) {
      socket.emit("startGameError", { message: result.error });
      return;
    }
    
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gameStarted");
  });

  socket.on("pauseGame", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("pauseGameError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.pauseGame(roomId, playerId);
    if (result.error) {
      socket.emit("pauseGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gamePaused");
  });

  socket.on("resumeGame", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("resumeGameError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.resumeGame(roomId, playerId);
    if (result.error) {
      socket.emit("resumeGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    io.to(roomId).emit("gameResumed");
  });

  socket.on("flipCoin", ({ roomId, coinId, playerId }: { roomId: string; playerId: string; coinId: number }) => {
    if (!playerId) {
      socket.emit("flipCoinError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.flipCoin(roomId, playerId, coinId);
    
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
          io.to(roomId).emit("gameState", finalState);
        }
      }, 500);
    }
  });

  socket.on("removeRoom", ({ roomId, playerId }: { roomId: string; playerId?: string }) => {
    const result = removeRoom(roomId);
    if (result.error) {
      socket.emit("removeRoomError", { message: result.error });
      return;
    }
    
    gameManager.removeGame(roomId);
    
    io.to(roomId).emit("roomRemoved", { roomId });
    
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        const socketInRoom = io.sockets.sockets.get(socketId);
        if (socketInRoom) {
          socketInRoom.leave(roomId);
        }
      });
    }
    
    if (playerId) {
      cleanupPlayerMapping(playerId);
    }
  });

  socket.on("resetGame", ({ roomId, playerId }: { roomId: string; playerId?: string }) => {
    const result = gameManager.resetGame(roomId);
    if (result.error) {
      socket.emit("resetGameError", { message: result.error });
      return;
    }
    io.to(roomId).emit("gameState", result);
    removeRoom(roomId);
    
    if (playerId) {
      cleanupPlayerMapping(playerId);
    }
  });

  socket.on("requestReset", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    if (!playerId) {
      socket.emit("requestResetError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.requestReset(roomId, playerId);
    if (result.error) {
      socket.emit("requestResetError", { message: result.error });
      return;
    }

    io.to(roomId).emit("resetRequested", {
      requestedBy: result.gameState?.resetRequestedBy,
      votes: result.gameState?.resetVotes
    });
    io.to(roomId).emit("gameState", result);
  });

  socket.on("voteReset", ({ roomId, playerId, accepted }: { roomId: string; playerId: string; accepted: boolean }) => {
    if (!playerId) {
      socket.emit("voteResetError", { message: "PlayerId is required" });
      return;
    }

    const result = gameManager.voteReset(roomId, playerId, accepted);
    if (result.error) {
      socket.emit("voteResetError", { message: result.error });
      return;
    }

    io.to(roomId).emit("resetVoteUpdate", {
      votes: result.gameState?.resetVotes,
      allVoted: result.allVoted
    });

    if (result.allVoted) {
      if (result.allAccepted) {
        const resetResult = gameManager.executeReset(roomId);
        if (!resetResult.error) {
          io.to(roomId).emit("resetAccepted");
          io.to(roomId).emit("gameState", resetResult);
          io.to(roomId).emit("gameStarted");
        }
      } else {
        io.to(roomId).emit("resetDeclined", {
          declinedBy: result.declinedBy
        });
        io.to(roomId).emit("gameState", result);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

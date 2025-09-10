interface Room {
  id: string;
  maxPlayers: number;
  currentPlayers: number;
  theme: string;
  gridSize: number;
  players: string[];
  host: string;
  status: "waiting" | "playing" | "finished";
}

interface RoomResponse {
  success?: boolean;
  error?: string;
  room?: Room;
}

const createRoomManager = () => {
  const activeRooms = new Map<string, Room>();

  return {
    createRoom(
      roomId: string, 
      maxPlayers: number, 
      theme: string, 
      gridSize: number, 
      hostId: string
    ): RoomResponse {
      if (activeRooms.has(roomId)) {
        return { error: "Room already exists" };
      }

      const room: Room = {
        id: roomId,
        maxPlayers: maxPlayers,
        currentPlayers: 1,
        theme,
        gridSize,
        players: [hostId],
        host: hostId,
        status: "waiting",
      };

      activeRooms.set(roomId, room);
      return { success: true, room };
    },

    joinRoom(roomId: string, playerId: string, playerName: string): RoomResponse {
      const room = activeRooms.get(roomId);

      if (!room) return { error: "Room not found" };
      if (room.players.includes(playerId)) return { error: "Already in room" };
      if (room.currentPlayers >= room.maxPlayers) return { error: "Room full" };
      if (room.status !== "waiting") return { error: "Game in progress" };

      room.currentPlayers++;
      room.players.push(playerId);

      return { success: true, room };
    },
  };
};

const roomManager = createRoomManager();

export const { createRoom, joinRoom } = roomManager;

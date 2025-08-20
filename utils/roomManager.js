const createRoomManager = () => {
  const activeRooms = new Map();

  return {
    createRoom(roomId, maxPlayers, theme, gridSize, hostId) {
      if (activeRooms.has(roomId)) {
        return { error: "Room already exists" };
      }

      const room = {
        id: roomId,
        maxPlayers: parseInt(maxPlayers),
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

    joinRoom(roomId, playerId, playerName) {
      const room = activeRooms.get(roomId);

      if (!room) return { error: "Room not found" };
      if (room.players.includes(playerId)) return { error: "Already in room" };
      if (room.currentPlayers >= room.maxPlayers) return { error: "Room full" };
      if (room.status !== "waiting") return { error: "Game in progress" };

      room.currentPlayers++;
      room.players.push(playerId);

      return { success: true, room };
    },

    getRoom(roomId) {
      return activeRooms.get(roomId);
    },

    getAllRooms() {
      return Array.from(activeRooms.entries());
    },
  };
};

const roomManager = createRoomManager();

export const { createRoom, joinRoom, getRoom, getAllRooms } = roomManager;

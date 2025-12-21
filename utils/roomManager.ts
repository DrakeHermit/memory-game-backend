import { RoomData, RoomResponse } from "../types/roomTypes";

const createRoomManager = () => {
  const activeRooms = new Map<string, RoomData>();

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

      const room: RoomData = {
        id: roomId,
        maxPlayers: maxPlayers,
        currentPlayers: 1,
        theme,
        gridSize,
        players: [hostId],
        host: hostId,
      };

      activeRooms.set(roomId, room);
      return { success: true, room };
    },

    joinRoom(roomId: string, playerId: string, playerName: string): RoomResponse {
      const room = activeRooms.get(roomId);

      if (!room) return { error: "Room not found" };
      if (room.players.includes(playerId)) return { error: "Already in room" };
      if (room.currentPlayers >= room.maxPlayers) return { error: "Room full" };

      room.currentPlayers++;
      room.players.push(playerId);

      return { success: true, room };
    },
    removeRoom(roomId: string): RoomResponse {
      const room = activeRooms.get(roomId);
      if (!room) return { error: "Room not found" };
      activeRooms.delete(roomId);
      console.log("Room removed");
      console.log(activeRooms);
      return { success: true };
    }
  };
};

const roomManager = createRoomManager();

export const { createRoom, joinRoom, removeRoom } = roomManager;

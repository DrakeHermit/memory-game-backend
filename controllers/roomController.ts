import { Socket } from "socket.io";
import { createRoom } from "../utils/roomManager";
import { Server } from "socket.io";
import { RoomData } from "../types/roomTypes";

export const registerRoomHandlers = (io: Server, socket: Socket) => {
  socket.on("createRoom", ({ id, maxPlayers, theme, gridSize }: RoomData) => {
    const room = createRoom(id, maxPlayers, theme, gridSize, socket.id);
  });
};
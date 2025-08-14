const activeRooms = new Map();

export function createRoom(roomId, maxPlayers, theme, gridSize, hostId) {
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
  return room;
}

export function joinRoom(roomId, playerId, playerName) {
  const room = activeRooms.get(roomId);

  if (!room) return { error: "Room not found" };
  if (room.players.includes(playerId)) return { error: "Already in room" };
  if (room.currentPlayers >= room.maxPlayers) return { error: "Room full" };
  if (room.status !== "waiting") return { error: "Game in progress" };

  room.currentPlayers++;
  room.players.push(playerId);

  return { success: true, room };
}

export function getRoom(roomId) {
  return activeRooms.get(roomId);
}

export function getAllRooms() {
  return Array.from(activeRooms.entries());
}

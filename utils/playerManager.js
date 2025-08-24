const createPlayerManager = () => {
  const activePlayers = new Map();
  const playerState = {
    id: null,
    name: null,
    roomId: null,
    score: 0,
    moves: 0,
    hasTurn: false,
  };

  return {
    addPlayer(playerId, playerName, roomId) {
      if (activePlayers.has(playerId)) {
        return { error: "Player already exists" };
      }

      const player = {
        id: playerId,
        name: playerName,
        roomId,
      };
    },
  };
};

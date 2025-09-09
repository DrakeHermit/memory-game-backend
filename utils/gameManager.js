const createGameManager = () => {
  const activeGames = new Map();

  const createPlayer = (playerId, playerName) => ({
    id: playerId,
    name: playerName,
    score: 0,
    moves: 0,
    hasTurn: false,
  });

  const createGame = (roomId) => ({
    roomId,
    players: [],
    gameStarted: false,
  });

  return {
    addPlayer(roomId, playerId, playerName) {
      let game = activeGames.get(roomId);

      if (!game) {
        game = createGame(roomId);
        activeGames.set(roomId, game);
      }

      if (game.gameStarted) {
        return { error: "Cannot add player to started game" };
      }

      const newPlayer = createPlayer(playerId, playerName);
      game.players.push(newPlayer);
      return { success: true, gameState: game };
    },
  };
};

const gameManager = createGameManager();
export default gameManager;

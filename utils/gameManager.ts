interface Player {
  id: string;
  name: string;
  score: number;
  moves: number;
  hasTurn: boolean;
}

interface Game {
  roomId: string;
  players: Player[];
  gameStarted: boolean;
}

interface GameResponse {
  success?: boolean;
  error?: string;
  gameState?: Game;
}

const createGameManager = () => {
  const activeGames = new Map<string, Game>();

  const createPlayer = (playerId: string, playerName: string): Player => ({
    id: playerId,
    name: playerName,
    score: 0,
    moves: 0,
    hasTurn: false,
  });

  const createGame = (roomId: string): Game => ({
    roomId,
    players: [],
    gameStarted: false,
  });

  return {
    addPlayer(roomId: string, playerId: string, playerName: string): GameResponse {
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

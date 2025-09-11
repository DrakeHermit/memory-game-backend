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
    changePlayerName(roomId: string, playerId: string, newName: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const player = game.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      
      player.name = newName;
      return { success: true, gameState: game };
    },

    getGameState(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      return { success: true, gameState: game };
    }
  };
};

const gameManager = createGameManager();
export default gameManager;

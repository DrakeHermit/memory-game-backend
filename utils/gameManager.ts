interface Player {
  id: string;
  name: string;
  score: number;
  moves: number;
  hasTurn: boolean;
  ready: boolean;
}

interface Game {
  roomId: string;
  players: Player[];
  gameStarted: boolean;
  theme: string;
  gridSize: number;
  coins: Array<{
    id: number;
    value: number | string;
  }>;
}

interface GameResponse {
  success?: boolean;
  error?: string;
  gameState?: Game;
}

export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array]; 
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

const getGridSize = (gridSize: number): number => { 
  return gridSize;
}
 
const generateServerGrid = (gridSize: number, theme: string): Array<{
  id: number;
  value: number | string;
}> => {
  const size = getGridSize(gridSize);
  const totalCoins = size * size;
  const maxIcons = 10; 

  const coins = Array.from({ length: totalCoins }, (_, index) => {
    const pairIndex = Math.floor(index / 2);
    
    return {
      id: index,
      value: theme === 'numbers' 
        ? pairIndex 
        : `icon-${pairIndex % maxIcons}`,
    };
  });

  return shuffleArray(coins);
}

const createGameManager = () => {
  const activeGames = new Map<string, Game>();

  const createPlayer = (playerId: string, playerName: string): Player => ({
    id: playerId,
    name: playerName,
    score: 0,
    moves: 0,
    hasTurn: false,
    ready: false,
  });

  const createGame = (roomId: string, theme: string, gridSize: number): Game => ({
    roomId,
    players: [],
    gameStarted: false,
    theme,
    gridSize,
    coins: [],
  });

  return {
    addPlayer(roomId: string, playerId: string, playerName: string, theme: string, gridSize: number): GameResponse {
      let game = activeGames.get(roomId);

      if (!game) {
        game = createGame(roomId, theme, gridSize);
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

    togglePlayerReady(roomId: string, playerId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const player = game.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      
      player.ready = !player.ready;
      return { success: true, gameState: game };
    },

    startGame(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      if (game.gameStarted) return { error: "Game already started" };
      
      const allGuestsReady = game.players.slice(1).every(p => p.ready);
      if (game.players.length > 1 && !allGuestsReady) {
        return { error: "Not all players are ready" };
      }
      
      game.coins = generateServerGrid(game.gridSize, game.theme);
      game.gameStarted = true;
      
      if (game.players.length > 0) {
        game.players[0].hasTurn = true;
      }
      
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

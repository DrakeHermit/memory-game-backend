interface Player {
  id: string;
  name: string;
  score: number;
  pairsFound: number;
  moves: number;
  hasTurn: boolean;
  ready: boolean;
}

interface Game {
  roomId: string;
  players: Player[];
  gameStarted: boolean;
  gameOver: boolean;
  flippedCoins: number[];
  matchedPairs: number[];
  isProcessing: boolean;
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
  shouldCheckForMatch?: boolean;
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
    pairsFound: 0,
    moves: 0,
    hasTurn: false,
    ready: false,
  });

  const createGame = (roomId: string, theme: string, gridSize: number): Game => ({
    roomId,
    players: [],
    gameStarted: false,
    gameOver: false,
    flippedCoins: [],
    matchedPairs: [],
    isProcessing: false,
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
    },
    checkForMatch(roomId: string): { isMatch: boolean, coinsToFlipBack?: number[] } | { error: string } {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      const coin1 = game?.coins.find(c => c.id === game?.flippedCoins[0]);
      const coin2 = game?.coins.find(c => c.id === game?.flippedCoins[1]);
      const currentPlayer = game?.players.find(p => p.hasTurn);
      
      if (currentPlayer) currentPlayer.moves++;
      
      if (coin1?.value === coin2?.value) {
        if (currentPlayer) {
          currentPlayer.score += 10;
          currentPlayer.pairsFound++;
          console.log("Pairs found:", currentPlayer.pairsFound);
          console.log("Score:", currentPlayer.score);
          console.log("Player info", game?.players);
        }
        game?.matchedPairs.push(coin1?.id ?? 0, coin2?.id ?? 0);
        game.flippedCoins = [];
        const currentIndex = game.players.findIndex(p => p.hasTurn);
        const nextIndex = (currentIndex + 1) % game.players.length;
        game.players[currentIndex].hasTurn = false;
        game.players[nextIndex].hasTurn = true;
        console.log("Match found");
        return {isMatch: true}
      } else {
        console.log("No match found");
        const coinsToFlipBack = [...game.flippedCoins];
        game.flippedCoins = [];
        const currentIndex = game.players.findIndex(p => p.hasTurn);
        const nextIndex = (currentIndex + 1) % game.players.length;
        game.players[currentIndex].hasTurn = false;
        game.players[nextIndex].hasTurn = true;
        return {isMatch: false, coinsToFlipBack};
      }
    },
    flipCoin(roomId: string, playerId: string, coinId: number): GameResponse {
      const game = activeGames.get(roomId)
      if (!game) return { error: "Game not found" };
      const player = game?.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      if (!player?.hasTurn) return { error: "Not your turn" };
      if(game.flippedCoins.length === 2) return { error: "Cannot flip more than 2 coins" };
      if (game && player && player.hasTurn && game.flippedCoins.length < 2) {
        console.log("Flipping coin:", coinId);
        game.flippedCoins.push(coinId);
        console.log("Flipped coins:", game?.flippedCoins);
      }
      if (game.flippedCoins.length === 2) {
        console.log("Checking for match");
        console.log("Flipped coins:", game?.flippedCoins);
        game.isProcessing = true;
        return { success: true, gameState: game, shouldCheckForMatch: true };
      } 
      return { success: true, gameState: game };
    },
    getWinner(roomId: string): { winner?: Player, winners: Player[], isTie: boolean } | { error: string } {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const maxScore = Math.max(...game.players.map(p => p.score));
      const winners = game.players.filter(p => p.score === maxScore);
      
      if (winners.length === 1) {
        return { winner: winners[0], winners, isTie: false };
      } else {
        return { winners, isTie: true };
      }
    },
    gameOver(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      const winnerData = this.getWinner(roomId);
      console.log("Winner data:", winnerData);
      game.gameOver = true;
      game.gameStarted = false;
      game.players.forEach(player => {
        player.hasTurn = false;
        player.ready = false;
      });
      game.flippedCoins = [];
      game.matchedPairs = [];
      game.coins = [];
      return { success: true, gameState: game, ...winnerData };
    },
  };
};

const gameManager = createGameManager();
export default gameManager;

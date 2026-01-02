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
  gamePaused: boolean;
  pausedBy: Player | null;
  flippedCoins: number[];
  matchedPairs: number[];
  isProcessing: boolean;
  theme: string;
  gridSize: number;
  coins: Array<{
    id: number;
    value: number | string;
  }>;
  winner: Player | null;
  winners: Player[];
  isTie: boolean;

  resetRequested: boolean;
  resetRequestedBy: Player | null;
  resetVotes: Record<string, boolean>; 
  resetUsed: boolean; 
}

interface GameResponse {
  success?: boolean;
  error?: string;
  gameState?: Game;
  shouldCheckForMatch?: boolean;
}

interface ResetVoteResponse extends GameResponse {
  allVoted?: boolean;
  allAccepted?: boolean;
  declinedBy?: Player;
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
    gamePaused: false,
    pausedBy: null,
    flippedCoins: [],
    matchedPairs: [],
    isProcessing: false,
    theme,
    gridSize,
    coins: [],
    winner: null,
    winners: [],
    isTie: false,
    resetRequested: false,
    resetRequestedBy: null,
    resetVotes: {},
    resetUsed: false,
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
        }
        game?.matchedPairs.push(coin1?.id ?? 0, coin2?.id ?? 0);
        game.flippedCoins = [];
        const currentIndex = game.players.findIndex(p => p.hasTurn);
        const nextIndex = (currentIndex + 1) % game.players.length;
        game.players[currentIndex].hasTurn = false;
        game.players[nextIndex].hasTurn = true;
        return {isMatch: true}
      } else {
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
        game.flippedCoins.push(coinId);
      }
      if (game.flippedCoins.length === 2) {
        game.isProcessing = true;
        return { success: true, gameState: game, shouldCheckForMatch: true };
      } 
      return { success: true, gameState: game };
    },
    removePlayer(roomId: string, playerId: string): GameResponse & { playerLeftDuringGame?: boolean, leftPlayer?: Player } {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const playerIndex = game.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return { error: "Player not found" };
      
      const leftPlayer = game.players[playerIndex];
      const wasGameInProgress = game.gameStarted && !game.gameOver;
      
      if (leftPlayer.hasTurn && game.players.length > 1) {
        const nextIndex = (playerIndex + 1) % game.players.length;
        if (nextIndex !== playerIndex) {
          game.players[nextIndex].hasTurn = true;
        }
      }
      
      game.players = game.players.filter(p => p.id !== playerId);

      if (game.pausedBy?.id === playerId) {
        game.gamePaused = false;
        game.pausedBy = null;
      }

      // If a player leaves during a reset vote, cancel the reset
      if (game.resetRequested) {
        game.resetRequested = false;
        game.resetRequestedBy = null;
        game.resetVotes = {};
        game.resetUsed = true;
      }
      
      return { 
        success: true, 
        gameState: game, 
        playerLeftDuringGame: wasGameInProgress,
        leftPlayer: leftPlayer
      };
    },
    removeGame(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      activeGames.delete(roomId);
      return { success: true };
    },
    gameOver(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const maxScore = Math.max(...game.players.map(p => p.score));
      const winners = game.players.filter(p => p.score === maxScore);
      
      game.isTie = winners.length > 1;
      game.winners = winners;
      game.winner = game.isTie ? null : winners[0];
      
      game.gameOver = true;
      game.gameStarted = false;
      game.players.forEach(player => {
        player.hasTurn = false;
        player.ready = false;
      });
      
      return { success: true, gameState: game };
    },
    resetGame(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      game.roomId = '';
      game.players = [];
      game.gameStarted = false;
      game.gameOver = false;
      game.flippedCoins = [];
      game.matchedPairs = [];
      game.isProcessing = false;
      game.theme = '';
      game.gridSize = 0;
      game.coins = [];
      game.winner = null;
      game.winners = [];
      game.isTie = false;
      return { success: true, gameState: game };
    },
    pauseGame(roomId: string, playerId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      const player = game.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      game.gamePaused = true;
      game.pausedBy = player;
      return { success: true, gameState: game };
    },
    resumeGame(roomId: string, playerId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      if (game.pausedBy && game.pausedBy.id !== playerId) {
        return { error: "Only the player who paused can resume" };
      }
      game.gamePaused = false;
      game.pausedBy = null;
      return { success: true, gameState: game };
    },
    requestReset(roomId: string, playerId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const player = game.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      
      if (game.resetUsed) {
        return { error: "Reset has already been used this game" };
      }
      
      if (game.resetRequested) {
        return { error: "Reset already requested" };
      }
      
      game.resetRequested = true;
      game.resetRequestedBy = player;
      game.resetVotes = {};
      game.resetVotes[playerId] = true;
      
      return { success: true, gameState: game };
    },
    voteReset(roomId: string, playerId: string, accepted: boolean): ResetVoteResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      const player = game.players.find(p => p.id === playerId);
      if (!player) return { error: "Player not found" };
      
      if (!game.resetRequested) {
        return { error: "No reset request pending" };
      }
      
      game.resetVotes[playerId] = accepted;
      
      const allVoted = game.players.every(p => game.resetVotes[p.id] !== undefined);
      
      if (!allVoted) {
        return { success: true, gameState: game, allVoted: false };
      }
      
      const allAccepted = game.players.every(p => game.resetVotes[p.id] === true);

      game.resetUsed = true;
      
      if (!allAccepted) {
        const decliner = game.players.find(p => game.resetVotes[p.id] === false);
        game.resetRequested = false;
        game.resetRequestedBy = null;
        game.resetVotes = {};
        return { 
          success: true, 
          gameState: game, 
          allVoted: true, 
          allAccepted: false,
          declinedBy: decliner
        };
      }
      
      return { success: true, gameState: game, allVoted: true, allAccepted: true };
    },
    executeReset(roomId: string): GameResponse {
      const game = activeGames.get(roomId);
      if (!game) return { error: "Game not found" };
      
      game.gameStarted = false;
      game.gameOver = false;
      game.gamePaused = false;
      game.pausedBy = null;
      game.flippedCoins = [];
      game.matchedPairs = [];
      game.isProcessing = false;
      game.coins = [];
      game.winner = null;
      game.winners = [];
      game.isTie = false;
      game.resetRequested = false;
      game.resetRequestedBy = null;
      game.resetVotes = {};
      game.resetUsed = false;

      game.players.forEach(player => {
        player.score = 0;
        player.pairsFound = 0;
        player.moves = 0;
        player.hasTurn = false;
        player.ready = false;
      });
      
      game.coins = generateServerGrid(game.gridSize, game.theme);
      
      game.gameStarted = true;
      if (game.players.length > 0) {
        game.players[0].hasTurn = true;
      }
      
      return { success: true, gameState: game };
    },
  };
};

const gameManager = createGameManager();
export default gameManager;

const createGameManager = () => {
  const activeUsers = new Map();
  const gameState = {
    coinsFlipped: [],
    currentPlayer: null,
    gameOver: false,
    winner: null,
    grid: [],
    players: [],
    roomId: null,
  };

  return {
    isMatch(coin1, coin2) {
      if (gameState.coinsFlipped.length === 0) return;
      if (gameState.coinsFlipped.length > 1) {
        const match = coin1.id === coin2.id ? true : false;
        return match;
      }
    },
  };
};

import { io } from 'socket.io-client';

export const player = async (email, debug, callback) => {
  let socket;
  try {
    socket = io('ws://localhost:4000');
  } catch (e) {
    console.log(e);
  }

  let game = null;
  let playerUuid = null;
  let round = 0;
  let allowedToEmit = true;

  debug && console.log('Creating player ' + email);

  const getGame = () => game;

  const getPlayerUuid = () => playerUuid;

  const getPlayer = () => {
    return game.players.find((player) => player.user.uuid === playerUuid);
  };

  const sleep = (ms) => {
    return new Promise((resolve, reject) => {
      debug && console.log('Sleeping for ' + ms + 'ms');
      setTimeout(() => resolve(), ms);
    });
  };

  const getHex = () => {
    const player = getPlayer();

    return game.board.find(
      (hex) =>
        hex.row === player.position.row && hex.column === player.position.column
    );
  };

  socket.on('pushConnection', (socket) => {
    debug && console.log('Connected!');
  });

  const createSession = () => {
    socket.emit('createSession', email, email, async (session) => {
      debug && console.log('Session created');
      playerUuid = session.user.uuid;
    });
  };

  const createAndJoinNewGame = (name) => {
    console.log('Creating new game ' + name);
    socket.emit('createAndJoinNewGame', name);
  };

  const joinGame = (gameUuid) => {
    socket.emit('joinGame', gameUuid);
  };

  socket.on('pushActiveGame', async (newGame) => {
    // debug && console.log(email + ': ' + 'Got new game!');
    // debug && console.log(email + ': ' + 'Processing state is ' + processing);

    // if (processing) return;

    game = newGame;

    if (game.state.status === 'won') {
      debug && console.log('Game won after ' + game.state.round + ' rounds');
      socket.disconnect();
      // console.log(game.players);
      // console.log('There may be a callback and ai am ' + email);
      if (callback) {
        // console.log('There is a callback and ai am ' + email);
        callback({ gameState: game.state, players: game.players });
      }
    }

    if (game.state.status === 'playing') {
      // console.log('We are playing');
      round = game.state.round;

      // console.log(game.state);

      if (game.state.currentRound.playerUuid === playerUuid) {
        debug &&
          console.log(
            'It is ' +
              email +
              's round with ' +
              game.state.currentRound.movesLeft +
              ' moves left'
          );

        // console.log(game.state.currentRound);
        // await sleep(100);

        // await sleep(1000);
        debug && console.log(round);
        console.log(email + ': ' + 'Setting processing to true');

        const pickedAchievement = await tryAchieve();
        if (pickedAchievement) {
          debug && console.log(email + ': ' + 'Achieved successfully');
          // processing = false;
          return;
        }

        const traded = await tryTrade();
        if (traded) {
          debug && console.log(email + ': ' + 'Traded successfully');
          // processing = false;
          return;
        }

        const ditched = await ditchIfFull();
        if (ditched) {
          debug && console.log(email + ': ' + 'Ditched successfully');
          // processing = false;
        }

        const loaded = await tryLoad();
        if (loaded) {
          debug && console.log(email + ': ' + 'Loaded successfully');
          // processing = false;
          return;
        }

        const sailed = await trySail();
        if (sailed) {
          debug && console.log(email + ': ' + 'Sailed successfully');
          // processing = false;
          return;
        }

        endRound();
        // processing = false;
      }
    }
  });

  const ditchIfFull = () => {
    return new Promise((resolve, reject) => {
      let player = getPlayer();

      if (player.cargo.length === 5) {
        debug &&
          console.log(
            email +
              ': ' +
              'Cargo hold full, ditching a ' +
              player.cargo[0] +
              ' cube'
          );

        if (!allowedToEmit) {
          debug && console.log(email + ': ' + 'Ditching. Not allowed to emit');
          resolve(false);
          return;
        }

        allowedToEmit = false;
        debug &&
          console.log(
            email + ': ' + 'Emiting ditchCargo with ' + player.cargo[0]
          );

        socket.emit('ditchCargo', [player.cargo[0]], (valid) => {
          allowedToEmit = true;
          resolve(valid);
          // processing = false;

          return;
        });
      } else {
        resolve(false);
        // processing = false;
      }
    });
  };

  const tryAchieve = () => {
    return new Promise((resolve, reject) => {
      debug && console.log(email + ': ' + 'Trying to pick an achievement');

      const availableAchievements = game.state.currentRound.achievementsEarned;

      if (availableAchievements.length === 0) {
        resolve(false);
        // processing = false;
        return;
      }
      if (!allowedToEmit) {
        debug &&
          console.log(
            email + ': ' + 'Picking achievement. Not allowed to emit'
          );
        resolve(false);
        return;
      }

      allowedToEmit = false;

      debug &&
        console.log(
          email +
            ': ' +
            'Emiting pickAchievement with ' +
            availableAchievements[0]
        );

      socket.emit('pickAchievement', availableAchievements[0], (valid) => {
        resolve(valid);
        allowedToEmit = true;
        // processing = false;
      });
    });
  };

  const tryTrade = () => {
    return new Promise((resolve, reject) => {
      debug && console.log(email + ': ' + 'Trying to trade');
      const hex = getHex();

      if (!game.state.currentRound.movesAvailable.includes('trade')) {
        // processing = false;
        resolve(false);

        return;
      }

      // If we are in a city, let's try to trade or load
      if (!hex.city) {
        // processing = false;
        resolve(false);

        return;
      }

      // first let's trade if there are contracts
      if (hex.city.contracts.length === 0) {
        // processing = false;
        resolve(false);

        return;
      }

      if (!allowedToEmit) {
        debug && console.log(email + ': ' + 'Trading. Not allowed to emit');
        resolve(false);
        return;
      }

      allowedToEmit = false;

      debug &&
        console.log(
          email + ': ' + 'Emiting makeTrades with ' + hex.city.contracts[0]
        );

      socket.emit('makeTrades', [hex.city.contracts[0]], (valid) => {
        // processing = false;
        resolve(valid);
        allowedToEmit = true;

        return;
      });

      // processing = false;
      resolve(false);
    });
  };

  const tryLoad = () => {
    return new Promise((resolve, reject) => {
      debug && console.log(email + ': ' + 'Trying to load');
      const hex = getHex();
      const player = getPlayer();

      if (!hex.city) {
        // processing = false;
        resolve(false);

        return;
      }

      if (player.cargo.length === 5) {
        // processing = false;
        resolve(false);

        return;
      }

      if (!game.state.currentRound.movesAvailable.includes('load')) {
        // processing = false;
        resolve(false);

        return;
      }

      if (!allowedToEmit) {
        debug &&
          console.log(email + ': ' + 'Cargo loading. Not allowed to emit');
        resolve(false);
        return;
      }

      allowedToEmit = false;

      const cargoToLoad = hex.city.goods;
      debug &&
        console.log(email + ': ' + 'Emiting loadCargo with ' + cargoToLoad[0]);
      socket.emit('loadCargo', [cargoToLoad[0]], (valid) => {
        // processing = false;
        resolve(valid);
        allowedToEmit = true;
        return;
      });
    });
  };

  const trySail = () => {
    return new Promise((resolve, reject) => {
      debug && console.log(email + ': ' + 'Trying to sail');
      if (!game.state.currentRound.movesAvailable.includes('sail')) {
        // processing = false;
        resolve(false);

        return;
      }
      const hexesWithinRange = game.state.currentRound.hexesWithinRange;

      const positionsWithCities =
        game.state.currentRound.hexesWithinRange.filter((ah) => {
          const boardHex = game.board.find(
            (bh) => bh.column === ah.column && bh.row === ah.row
          );
          if (boardHex.city) return true;
          return false;
        });

      if (!allowedToEmit) {
        debug && console.log(email + ': ' + 'Sailing. Not allowed to emit');
        resolve(false);
        return;
      }

      allowedToEmit = false;

      const randomDestination = Math.floor(
        Math.random() * positionsWithCities.length
      );
      debug &&
        console.log(
          email +
            ': ' +
            'Emiting sailTo with ' +
            positionsWithCities[randomDestination]
        );
      socket.emit('sailTo', positionsWithCities[randomDestination], (valid) => {
        // processing = false;
        resolve(valid);
        allowedToEmit = true;

        return;
      });
    });
  };

  const endRound = () => {
    if (!allowedToEmit) {
      debug && console.log(email + ': ' + 'Endround. Not allowed to emit');
      return;
    }

    debug && console.log(email + ': ' + 'Emitting endRound');
    socket.emit('endRound');
    // processing = false;
  };

  socket.on('error', (error) => {
    console.log('Got an error: ' + error);
  });

  const startGame = () => {
    if (!game.uuid) {
      console.log('No game to start');
      return;
    }

    socket.emit('startGame', game.uuid);
  };

  return {
    createSession,
    getPlayerUuid,
    createAndJoinNewGame,
    startGame,
    joinGame,
    getGame,
  };
};

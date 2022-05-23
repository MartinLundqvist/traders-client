import { player } from './player.js';

let allowedToStart = true;
let games = [];

const createPlayer = async (name, callback) => {
  const {
    createSession,
    getPlayerUuid,
    createAndJoinNewGame,
    startGame,
    joinGame,
    getGame,
  } = await player(name, true, callback);
  createSession();

  return { createAndJoinNewGame, getPlayerUuid, startGame, joinGame, getGame };
};

const sleep = (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), ms);
  });
};

const startMany = (nrGamesToPlay) => {
  console.log('Starting ' + nrGamesToPlay + ' games');
  const callback = (value) => {
    if (allowedToStart && nrGamesToPlay > games.length) {
      let gameNr = games.length + 1;
      console.log(
        'Game ' + gameNr + ' won after ' + value.gameState.round + ' rounds'
      );
      games.push(value);
      start(callback);
    }

    if (allowedToStart && nrGamesToPlay === games.length) {
      console.log('Done');
      console.log(games);
    }

    allowedToStart = false;
  };

  start(callback);
};

const start = async (callback) => {
  if (!allowedToStart) return;

  console.log('Starting new game');

  const players = [];

  players.push(await createPlayer('firstPlayer', callback));
  players.push(await createPlayer('secondPlayer', callback));
  players.push(await createPlayer('thirdPlayer', callback));
  players.push(await createPlayer('fourtPlayer', callback));
  players.push(await createPlayer('fifthPlayer', callback));
  players[0].createAndJoinNewGame('game');
  await sleep(200);

  // players.forEach((player) => {
  //   console.log(player.getPlayerUuid());
  // });

  const getGame = () => {
    console.log('Getting game');
    return new Promise((resolve, reject) => {
      let started = false;

      while (!started) {
        // console.log('Trying to find the game reference');
        let game = players[0].getGame();
        if (game) {
          console.log('Game found');
          started = true;
          resolve(game);
        }
      }
    });
  };

  const startGame = (game) => {
    return new Promise((resolve, reject) => {
      players[1].joinGame(game.uuid);
      players[2].joinGame(game.uuid);
      players[3].joinGame(game.uuid);
      players[4].joinGame(game.uuid);

      setTimeout(() => {
        players[0].startGame();
        resolve();
      }, 100);
    });
  };

  getGame().then((game) => {
    startGame(game).then(() => {
      // console.log('Game started');
      allowedToStart = true;
    });
  });
};

startMany(5);

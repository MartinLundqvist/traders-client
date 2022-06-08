import { player } from './player_cj.js';

const DEBUG_MODE = process.env.DEBUG_MODE || 'false';

const createPlayer = async (name) => {
  const debug = DEBUG_MODE === 'true' ? true : false;

  const {
    createSession,
    createAndJoinNewGame,
    startGame,
    joinGame,
    playRound,
  } = await player(name, debug);

  await createSession();

  return { createAndJoinNewGame, startGame, joinGame, playRound };
};

const startMany = async ({ nrPlayers, nrGames }) => {
  console.log('Starting ' + nrGames + ' games with ' + nrPlayers + ' players');
  let games = [];

  for (let i = 0; i < nrGames; i++) {
    let game = await start(nrPlayers);
    console.log('\nGame ' + i + ' won after ' + game.state.round + ' rounds');

    games.push(game);
  }
};

const start = async (nrPlayers) => {
  let game;

  console.log('Starting new game with ' + nrPlayers + ' players');

  const players = [];

  for (let i = 0; i < nrPlayers; i++) {
    players.push(await createPlayer(`Player-${i}`));
  }

  game = await players[0].createAndJoinNewGame('game');

  // console.log(game.state);

  for (let i = 1; i < nrPlayers; i++) {
    await players[i].joinGame(game.uuid);
  }

  game = await players[0].startGame();

  do {
    let won = false;
    for (let i = 0; i < players.length; i++) {
      // console.log(i);
      game = await players[i].playRound();
      // console.log(game.state.status);
      // console.log(game);
    }
  } while (game.state.status !== 'won');

  if (game.state.status === 'won') {
    console.log('game won');
    return game;
  }
};

startMany({ nrPlayers: 5, nrGames: 5 });

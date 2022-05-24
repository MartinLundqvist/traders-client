import fetch from 'node-fetch';

export const player = async (email, debug) => {
  let game = null;
  let session = null;

  debug && console.log('Creating player ' + email);

  const getGame = () => game;

  const getPlayerUuid = () => session.user.uuid;

  const getPlayer = () => {
    return game.players.find(
      (player) => player.user.uuid === session.user.uuid
    );
  };

  const getHex = () => {
    const player = getPlayer();

    return game.board.find(
      (hex) =>
        hex.row === player.position.row && hex.column === player.position.column
    );
  };

  const createSession = async () => {
    const response = await fetch(
      'http://localhost:4000/gameapi/createSession',
      {
        method: 'POST',
        body: JSON.stringify({ name: email, email: email }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    session = data;

    debug && console.log(session);
  };

  const createAndJoinNewGame = async (name) => {
    debug && console.log('Creating new game ' + name);

    const response = await fetch(
      'http://localhost:4000/gameapi/createAndJoinNewGame',
      {
        method: 'POST',
        body: JSON.stringify({ gameName: name, user: session.user }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    game = data;

    debug && console.log(game);

    return game;
  };

  const joinGame = async (gameUuid) => {
    debug && console.log(email + ': ' + 'Joining game ' + gameUuid);

    const response = await fetch('http://localhost:4000/gameapi/joinGame', {
      method: 'POST',
      body: JSON.stringify({ gameUuid: gameUuid, user: session.user }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    game = data;
  };

  const playRound = async () => {
    await refreshGame();

    if (game.state.status !== 'playing') return game;

    if (game.state.currentRound.playerUuid !== session.user.uuid) return game;

    debug && console.log(`Playing round ${game.state.round}. `);

    // console.log(game.state.currentRound);

    while (game.state.currentRound.playerUuid === session.user.uuid) {
      !debug && process.stdout.write(`Playing round ${game.state.round}. `);
      !debug &&
        process.stdout.write(
          `Cities emptied ${game.state.numberOfCitiesEmptied} / ${game.numberOfCitiesToEmpty}.\r`
        );

      debug &&
        console.log(
          'It is ' +
            email +
            's round with ' +
            game.state.currentRound.movesLeft +
            ' moves left'
        );
      debug &&
        console.log(
          `Cities emptied ${game.state.numberOfCitiesEmptied} / ${game.numberOfCitiesToEmpty}. `
        );

      const pickedAchievement = await tryAchieve();
      if (pickedAchievement) {
        debug && console.log(email + ': ' + 'Achieved successfully');
        continue;
      }

      const traded = await tryTrade();
      if (traded) {
        debug && console.log(email + ': ' + 'Traded successfully');
        continue;
      }

      const ditched = await ditchIfFull();
      if (ditched) {
        debug && console.log(email + ': ' + 'Ditched successfully');
        continue;
      }

      const loaded = await tryLoad();
      if (loaded) {
        debug && console.log(email + ': ' + 'Loaded successfully');
        continue;
      }

      const sailed = await trySail();
      if (sailed) {
        debug && console.log(email + ': ' + 'Sailed successfully');
        continue;
      }

      const endedRound = await endRound();
      if (endedRound) {
        debug && console.log(email + ': ' + 'Ended round successfully');
        continue;
      }
    }

    return game;
  };

  const refreshGame = async () => {
    debug && console.log(email + ': ' + 'Refreshing game data');
    const response = await fetch(
      'http://localhost:4000/gameapi/getGame/' + game.uuid
    );

    if (!response.ok) {
      console.log('Error fetching game data');
      return;
    }

    const data = await response.json();
    game = data;
  };

  const ditchIfFull = async () => {
    debug && console.log(email + ': ' + 'Trying to ditch cargo');
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

      const response = await fetch(
        'http://localhost:4000/gameapi/playing/ditchCargo',
        {
          method: 'POST',
          body: JSON.stringify({
            gameUuid: game.uuid,
            cargo: [player.cargo[0]],
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        debug && console.log(email + ': ' + 'Ditching failed');

        return false;
      }

      const data = await response.json();
      game = data;
      return true;
    }

    return false;
  };

  const tryAchieve = async () => {
    debug && console.log(email + ': ' + 'Trying to pick an achievement');

    const availableAchievements = game.state.currentRound.achievementsEarned;

    if (availableAchievements.length === 0) {
      return false;
    }

    debug &&
      console.log(
        email +
          ': ' +
          'POSTING pickAchievement with ' +
          availableAchievements[0]
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/pickAchievement',
      {
        method: 'POST',
        body: JSON.stringify({
          gameUuid: game.uuid,
          achievement: availableAchievements[0],
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      debug && console.log(email + ': ' + 'Achieving failed');

      return false;
    }

    const data = await response.json();
    game = data;

    return true;
  };

  const tryTrade = async () => {
    debug && console.log(email + ': ' + 'Trying to trade');
    const hex = getHex();

    if (!game.state.currentRound.movesAvailable.includes('trade')) {
      return false;
    }

    // If we are in a city, let's try to trade or load
    if (!hex.city) {
      return false;
    }

    // first let's trade if there are contracts
    if (hex.city.contracts.length === 0) {
      return false;
    }

    debug &&
      console.log(
        email + ': ' + 'POSTING makeTrades with ' + [hex.city.contracts[0]]
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/makeTrades',
      {
        method: 'POST',
        body: JSON.stringify({
          gameUuid: game.uuid,
          contracts: [hex.city.contracts[0]],
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      debug && console.log(email + ': ' + 'Trade failed');

      return false;
    }

    const data = await response.json();
    game = data;

    return true;
  };

  const tryLoad = async () => {
    debug && console.log(email + ': ' + 'Trying to load');
    const hex = getHex();
    const player = getPlayer();

    if (!hex.city) {
      return false;
    }

    if (player.cargo.length === 5) {
      return false;
    }

    if (!game.state.currentRound.movesAvailable.includes('load')) {
      return false;
    }

    const cargoToLoad = hex.city.goods;
    debug &&
      console.log(email + ': ' + 'POSTING loadCargo with ' + cargoToLoad[0]);

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/loadCargo',
      {
        method: 'POST',
        body: JSON.stringify({ gameUuid: game.uuid, cargo: [cargoToLoad[0]] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      debug && console.log(email + ': ' + 'Loding failed');

      return false;
    }

    const data = await response.json();
    game = data;

    return true;
  };

  const trySail = async () => {
    debug && console.log(email + ': ' + 'Trying to sail');
    if (!game.state.currentRound.movesAvailable.includes('sail')) {
      return false;
    }

    const positionsWithCities = game.state.currentRound.hexesWithinRange.filter(
      (ah) => {
        const boardHex = game.board.find(
          (bh) => bh.column === ah.column && bh.row === ah.row
        );
        if (boardHex.city) return true;
        return false;
      }
    );

    const randomDestination = Math.floor(
      Math.random() * positionsWithCities.length
    );
    debug &&
      console.log(
        email +
          ': ' +
          'POSTING sailTo with ' +
          positionsWithCities[randomDestination]
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/sailTo',
      {
        method: 'POST',
        body: JSON.stringify({
          gameUuid: game.uuid,
          position: positionsWithCities[randomDestination],
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      debug && console.log(email + ': ' + 'Sailing failed');

      return false;
    }

    const data = await response.json();
    game = data;

    return true;
  };

  const endRound = async () => {
    debug && console.log(email + ': ' + 'POSTING endRound');

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/endRound',
      {
        method: 'POST',
        body: JSON.stringify({ gameUuid: game.uuid }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      debug && console.log(email + ': ' + 'Ending round failed');

      return false;
    }

    const data = await response.json();
    game = data;

    return true;
  };

  const startGame = async () => {
    debug && console.log(email + ': ' + 'Starting game ' + game.uuid);
    if (!game.uuid) {
      console.log('No game to start');
      return;
    }

    const response = await fetch('http://localhost:4000/gameapi/startGame', {
      method: 'POST',
      body: JSON.stringify({ gameUuid: game.uuid, user: session.user }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    game = data;

    return game;
  };

  return {
    createSession,
    getPlayerUuid,
    createAndJoinNewGame,
    startGame,
    joinGame,
    getGame,
    playRound,
  };
};

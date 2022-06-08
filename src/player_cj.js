import fetch from 'node-fetch';
import {
  fulfillOneGood,
  sleep,
  cargoPriority,
  canFulfill,
  getDistanceBetweenHexes,
  findPositionTowardsPosition,
} from './utils.js';

export const player = async (email, debug) => {
  debug && console.log('Creating player ' + email);

  let game = null;
  let session = null;
  let targetContract = null;
  let targetPosition = null;
  let missingCubes = [];

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

  const getHexFromPosition = (position) => {
    return game.board.find(
      (hex) => hex.row === position.row && hex.column === position.column
    );
  };

  const getCityHexes = () => {
    return game.board.filter((hex) => hex.city);
  };

  const getAllContracts = () => {
    let contracts = [];
    const cityHexes = getCityHexes();

    cityHexes.forEach((cityHex) => {
      cityHex.city.contracts.forEach((contract) => {
        contracts.push(contract);
      });
    });

    return contracts;
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

    // debug && console.log(JSON.stringify(game, null, 2));

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

    if (game.state.status !== 'playing' && game.state.status !== 'endgame')
      return game;

    if (game.state.currentRound.playerUuid !== session.user.uuid) return game;

    debug && console.log(`Playing round ${game.state.round}. `);

    // console.log(game.state.currentRound);

    while (
      game.state.currentRound.playerUuid === session.user.uuid &&
      game.state.status !== 'won'
    ) {
      !debug && process.stdout.write(`Playing round ${game.state.round}. `);
      !debug &&
        process.stdout.write(
          `Cities emptied ${game.state.numberOfCitiesEmptied} / ${game.numberOfCitiesToEmpty}.\r`
        );

      if (game.state.round > 250) {
        debug = true;
        await sleep(200);
        // console.log(JSON.stringify(game, null, 2));
      }

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
      } else {
        debug && console.log(email + ': ' + 'No achievements');
      }

      // Action 1 - Trade if there are matching contracts
      const traded = await tradeIfMatchingContract();
      if (traded) {
        debug && console.log(email + ': ' + 'Traded successfully');
        continue;
      } else {
        debug && console.log(email + ': ' + 'Did not trade');
      }

      // Action 2 - Ditch any ship cubes for which there are no contracts on the map
      const ditched = await ditchIfNoContracts();
      if (ditched) {
        debug &&
          console.log(
            email + ': ' + 'Ditched successfully to remove useless cubes'
          );
      } else {
        debug && console.log(email + ': ' + 'Did not ditch');
      }

      // Action 3 - Update target contract
      const updatedTargetContract = updateTargetContract();
      if (updatedTargetContract) {
        debug && console.log(email + ': ' + 'Updated target contract');
      } else {
        debug && console.log(email + ': ' + 'Did not update target contract');
      }

      // Action 4 - Update missing cubes
      const updatedMissingCubes = updateMissingCubes();
      if (updatedMissingCubes) {
        debug && console.log(email + ': ' + 'Updated missing cubes');
      } else {
        debug && console.log(email + ': ' + 'Did update missing cubes');
      }

      // Debug check that things are going as they should
      if (debug) {
        console.log(
          email + ': ' + 'Target contract is ' + JSON.stringify(targetContract)
        );
        console.log(
          email + ': ' + 'Current cargo is ' + JSON.stringify(getPlayer().cargo)
        );
        console.log(
          email + ': ' + 'Missing cubes are ' + JSON.stringify(missingCubes)
        );
      }

      // Action 5 - Ditch if missing cubes and ship is almost full
      const ditchedToFitMissingCubes = await ditchToFitMissingCubes();
      if (ditchedToFitMissingCubes) {
        debug &&
          console.log(
            email + ': ' + 'Ditched successfully to make room for missing cubes'
          );
      } else {
        debug &&
          console.log(
            email + ': ' + 'Did not ditch to make room for missing cubes'
          );
      }

      // Action 6 - Load if there are matching contracts
      const loaded = await loadIfMatchingContracts();
      if (loaded) {
        debug && console.log(email + ': ' + 'Loaded successfully');
        continue;
      } else {
        debug && console.log(email + ': ' + 'Did not load');
      }

      // Action 7 - Sail towards the optimal city
      const sailed = await sailTowardsOptimalCity();
      if (sailed) {
        debug && console.log(email + ': ' + 'Sailed successfully');
        continue;
      } else {
        debug && console.log(email + ': ' + 'Did not sail');
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

  const updateTargetContract = () => {
    debug && console.log(email + ': ' + 'Updating target contract');
    const allContracts = getAllContracts();
    const player = getPlayer();

    //If we have a target contract, check if it's still available
    if (targetContract) {
      const exists = allContracts.find(
        (contract) => contract.uuid === targetContract.uuid
      );
      if (exists) return false;
    }

    // We either don't have a target contract, or it has been taken. So let's find a new one.

    // Figure out which city has the highest value contract
    const hexesWithCities = getCityHexes();
    let hexesPrioritized = [];

    hexesWithCities.forEach((hex) => {
      hex.city.contracts.forEach((contract) => {
        hexesPrioritized.push({
          value: contract.value,
          contract: contract,
          distance: getDistanceBetweenHexes(player.position, hex),
          position: { row: hex.row, column: hex.column },
          cityName: hex.city.name,
        });
      });
    });

    // Apply the magic round-up
    hexesPrioritized.sort((a, b) => {
      let valuatorA = a.value / (a.distance / 3);
      let valuatorB = b.value / (b.distance / 3);
      return valuatorB - valuatorA;
    });

    // Found it, so set it.
    targetContract = hexesPrioritized[0].contract;
    targetPosition = hexesPrioritized[0].position;

    return true;
  };

  const updateMissingCubes = () => {
    debug && console.log(email + ': ' + 'Updating missing cubes');

    if (!targetContract || !targetPosition) {
      debug && console.log('No target contract or target position found!');
      return false;
    }

    // Reset the missing cubes
    missingCubes = [];

    // First we need to check whether any of the target cubes are already available in the city.
    let targetCityHex = getHexFromPosition(targetPosition);

    if (!targetCityHex.city) {
      debug && console.log('Target position is not a city!!');
      return false;
    }

    // No, we filter for the cubes that do NOT already exist in the city
    let targetCubes = targetContract.cargo.filter(
      (targetCube) => !targetCityHex.city.goods.includes(targetCube)
    );

    // Check if the remaining cubes are part of players cargo. For each that is NOT we add to the missing cubes
    let playerCargo = getPlayer().cargo;

    targetCubes.forEach((targetCube) => {
      if (!playerCargo.includes(targetCube)) missingCubes.push(targetCube);
    });

    return true;
  };

  const ditchToFitMissingCubes = async () => {
    debug &&
      console.log(
        email +
          ': ' +
          'Executing action to potententially ditch cargo to make place for missing cubes'
      );

    // No need to ditch anything if no cubes are missing
    if (missingCubes.length === 0) return false;

    let playerCargo = getPlayer().cargo;
    let numberOfCubesToDitch = playerCargo.length + missingCubes.length - 5;

    // console.log('Number of cubes to ditch: ' + numberOfCubesToDitch);

    // No need to ditch anything if we have room for all missing cubes
    if (numberOfCubesToDitch <= 0) return false;

    let cargoToDitch = [];
    let i = cargoPriority.length - 1;
    let copyOfPlayerCargo = [...playerCargo];
    while (cargoToDitch.length < numberOfCubesToDitch && i > -1) {
      // console.log('looking for: ' + cargoPriority[i]);
      const found = copyOfPlayerCargo.find(
        (playerCube) => playerCube === cargoPriority[i]
      );
      if (found) {
        const cargoIndexToRemove = copyOfPlayerCargo.findIndex(
          (copyGood) => copyGood === found
        );
        copyOfPlayerCargo.splice(cargoIndexToRemove, 1);
        // console.log('Found one to ditch ' + found);
        // Check that this isn't actually a missing cube
        if (
          !missingCubes.includes(found) &&
          !targetContract.cargo.includes(found)
        ) {
          // console.log(
          //   'And it is NOT part of the missing cubes NOR target contract'
          // );
          cargoToDitch.push(found);
        }
      }
      if (!found) i--;
    }

    if (cargoToDitch.length > 0) {
      debug &&
        console.log(
          email +
            ': ' +
            'Ditching the following cargo ' +
            JSON.stringify(cargoToDitch)
        );

      // await sleep(500);

      const response = await fetch(
        'http://localhost:4000/gameapi/playing/ditchCargo',
        {
          method: 'POST',
          body: JSON.stringify({
            gameUuid: game.uuid,
            cargo: cargoToDitch,
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

  const ditchIfNoContracts = async () => {
    debug &&
      console.log(
        email +
          ': ' +
          'Executing action to potentially ditch cargo due to NO matching contracts'
      );
    let player = getPlayer();

    const allContracts = getAllContracts();

    // Go through my cargo and see if there is some contract matching it
    const cargoToDitch = [];
    player.cargo.forEach((playerGood) => {
      // console.log(playerGood);

      const match = allContracts.some((contract) => {
        return contract.cargo.includes(playerGood);
      });

      // console.log(match);

      if (!match) cargoToDitch.push(playerGood);
    });

    if (cargoToDitch.length > 0) {
      debug &&
        console.log(
          email +
            ': ' +
            'Ditching the following cargo ' +
            JSON.stringify(cargoToDitch)
        );

      const response = await fetch(
        'http://localhost:4000/gameapi/playing/ditchCargo',
        {
          method: 'POST',
          body: JSON.stringify({
            gameUuid: game.uuid,
            cargo: cargoToDitch,
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
    debug && console.log(email + ': ' + 'Looking for earned achievements');

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

  const tradeIfMatchingContract = async () => {
    debug &&
      console.log(
        email +
          ': ' +
          'Executing action to trade if there is a matching contract'
      );
    const hex = getHex();
    const player = getPlayer();

    // If not able to trade, no trade
    if (!game.state.currentRound.movesAvailable.includes('trade')) {
      return false;
    }

    // If we are not in a city, also no trade
    if (!hex.city) {
      return false;
    }

    // If no contracts, no trade
    if (hex.city.contracts.length === 0) {
      return false;
    }

    // Let's check if there is any matching contract
    let contractsToTrade = [];
    const mockPlayer = JSON.parse(JSON.stringify(player));
    const mockHex = JSON.parse(JSON.stringify(hex));
    const mockContracts = JSON.parse(JSON.stringify(hex.city.contracts));

    // Prioritize the highest value contracts first
    mockContracts.sort((a, b) => {
      return b.value - a.value;
    });

    mockContracts.forEach((contract) => {
      if (
        fulfillOneGood(contract.cargo[0], mockPlayer, mockHex.city) &&
        fulfillOneGood(contract.cargo[1], mockPlayer, mockHex.city)
      ) {
        contractsToTrade.push(contract);
      }
    });

    // No contracts matched
    if (contractsToTrade.length === 0) {
      return false;
    }

    // If more than two contracts matched, we only pass two.
    if (contractsToTrade.length > 2) {
      contractsToTrade = [contractsToTrade[0], contractsToTrade[1]];
    }

    debug &&
      console.log(
        email +
          ': ' +
          'POSTING makeTrades with ' +
          JSON.stringify(contractsToTrade)
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/makeTrades',
      {
        method: 'POST',
        body: JSON.stringify({
          gameUuid: game.uuid,
          contracts: contractsToTrade,
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

  const loadIfMatchingContracts = async () => {
    debug && console.log(email + ': ' + 'Executing action to load');
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

    // Figure out if the cargo matches any contracts on the map, we focus on those.
    const contracts = getAllContracts();
    let matchingCargo = [];
    hex.city.goods.forEach((cityGood) => {
      const match = contracts.some((contract) =>
        contract.cargo.includes(cityGood)
      );
      if (match) matchingCargo.push(cityGood);
    });

    // console.log('Matching cargo in city ' + hex.city.name);
    // console.log(matchingCargo);

    //If there are no matches, don't load
    if (matchingCargo.length === 0) return false;

    // If there is 2 or more spaces on the ship, just load all that matched.
    if (player.cargo.length < 4) {
      // console.log('I have more than 2 spaces in the boat so I load all of it');
      return await loadCargo(matchingCargo);
    }

    // If there is only 1 space left on the ship...
    if (player.cargo.length === 4) {
      // console.log('I have only 1 space left...');
      //first check if we can fill a missing cube.
      if (missingCubes.includes(matchingCargo[0])) {
        // console.log('missingCubes are');
        // console.log(missingCubes);
        // console.log('So I load ' + matchingCargo[0]);
        return await loadCargo([matchingCargo[0]]);
      }

      // In case the above didn't return, we must check if there are two matching cargos
      if (
        matchingCargo.length === 2 &&
        missingCubes.includes(matchingCargo[1])
      ) {
        return await loadCargo([matchingCargo[1]]);
      }

      // At this stage, we know that no missing cubes have been filled but that there is still one cargo space left AND there is matching cargo
      // We fill it in order of color priority
      let foundIndex = -1;
      let index = 0;
      while (foundIndex < 0) {
        foundIndex = matchingCargo.findIndex(
          (cargo) => cargo === cargoPriority[index]
        );
        // debug &&
        //   console.log('Found ' + cargoPriority[index] + ' at ' + foundIndex);
        // debug && (await sleep(500));
        index++;
      }

      return await loadCargo([matchingCargo[foundIndex]]);
    }
  };

  const loadCargo = async (cargoToLoad) => {
    debug &&
      console.log(
        email + ': ' + 'POSTING loadCargo with ' + JSON.stringify(cargoToLoad)
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/loadCargo',
      {
        method: 'POST',
        body: JSON.stringify({ gameUuid: game.uuid, cargo: cargoToLoad }),
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

  const sailTowardsOptimalCity = async () => {
    debug &&
      console.log(
        email + ': ' + 'Executing action to sail to or towards optimal hex'
      );
    if (!game.state.currentRound.movesAvailable.includes('sail')) {
      return false;
    }

    // If no target position exists, problem
    if (!targetPosition) return false;

    // let targetDestination = {};

    // If we have no missing cubes, sail towards the targetPosition
    if (missingCubes.length === 0) {
      debug &&
        console.log('Have all cubes, so heading straight for the target city');
      return await sailTowards(targetPosition);
    }

    // If we have missing cubes, we need to sail to the nearest city that has our cubes
    debug &&
      console.log(
        'Do not have all cubes, so heading for nearest city with a cube I need'
      );
    let cityHexes = getCityHexes();
    let player = getPlayer();
    let hexesPrioritized = [];

    cityHexes.forEach((cityHex) => {
      cityHex.city.goods.forEach((cityCube) => {
        if (missingCubes.includes(cityCube)) {
          hexesPrioritized.push({
            good: cityCube,
            position: {
              column: cityHex.column,
              row: cityHex.row,
            },
            distance: getDistanceBetweenHexes(player.position, {
              column: cityHex.column,
              row: cityHex.row,
            }),
            cityName: cityHex.city.name,
          });
        }
      });
    });

    // Sort by distance
    hexesPrioritized.sort((a, b) => {
      return a.distance - b.distance;
    });

    // console.log(hexesPrioritized);

    // And set to the closest one
    debug &&
      console.log(
        'Found a ' +
          hexesPrioritized[0].good +
          ' cube in ' +
          hexesPrioritized[0].cityName
      );
    return await sailTowards(hexesPrioritized[0].position);
  };

  const sailTowards = async (targetDestination) => {
    let player = getPlayer();
    const inRangeIndex = game.state.currentRound.hexesWithinRange.findIndex(
      (hexInRange) =>
        targetDestination.column === hexInRange.column &&
        targetDestination.row === hexInRange.row
    );

    // Not in range...
    if (inRangeIndex === -1) {
      debug &&
        console.log(
          'The target city is further away than I can go in one move '
        );

      targetDestination = findPositionTowardsPosition(
        player.position,
        targetDestination
      );
    }

    debug &&
      console.log(
        'So, I am sailing to ' + JSON.stringify(targetDestination, null, 2)
      );

    return await sailTo(targetDestination);
  };

  const sailTo = async (targetDestination) => {
    debug &&
      console.log(
        email +
          ': ' +
          'POSTING sailTo with ' +
          JSON.stringify(targetDestination)
      );

    const response = await fetch(
      'http://localhost:4000/gameapi/playing/sailTo',
      {
        method: 'POST',
        body: JSON.stringify({
          gameUuid: game.uuid,
          position: targetDestination,
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

    // debug && (await sleep(1000));
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

    if (debug) {
      console.log('-------- GAME INITIAL STATE -----------');
      console.log(JSON.stringify(game, null, 2));
      console.log('---------------------------------------');
    }

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

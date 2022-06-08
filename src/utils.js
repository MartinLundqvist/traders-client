import { BOARD } from './constants.js';

export const fulfillOneGood = (cargo, player, city) => {
  // First try and fulfill from the city
  if (city.goods.includes(cargo)) return true;

  // Second try and fulfill from the cargo hold
  if (player.cargo.includes(cargo)) {
    let itemIndexToLoad = player.cargo.findIndex((g) => g === cargo);
    player.cargo.splice(itemIndexToLoad, 1);
    return true;
  }

  return false;
};

export const canFulfill = (hex, player) => {
  const contractsToTrade = [];
  const mockPlayer = JSON.parse(JSON.stringify(player));
  const mockHex = JSON.parse(JSON.stringify(hex));

  hex.city.contracts.forEach((contract) => {
    if (
      fulfillOneGood(contract.cargo[0], mockPlayer, mockHex.city) &&
      fulfillOneGood(contract.cargo[1], mockPlayer, mockHex.city)
    ) {
      contractsToTrade.push(contract);
    }
  });

  return contractsToTrade.length > 0;
};

export const sleep = (timeout) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), timeout);
  });
};

export const cargoPriority = [
  'red',
  'gray',
  'blue',
  'green',
  'brown',
  'black',
  'yellow',
];

export const findPositionTowardsPosition = (currentPos, targetPos) => {
  const inRangeHexMap = new Map();

  const addAdjacentMoves = (newPosition) => {
    BOARD.forEach((hex) => {
      let hexPosition = {
        row: hex.row,
        column: hex.column,
        distanceHexToTarget: getDistanceBetweenHexes(hex, targetPos),
        distanceHexToCurrent: getDistanceBetweenHexes(hex, currentPos),
      };
      if (isAdjacent(newPosition, hexPosition))
        inRangeHexMap.set(JSON.stringify(hexPosition), hexPosition);
    });
  };

  // Find adjacent hexes
  addAdjacentMoves(currentPos);

  let array = Array.from(inRangeHexMap.values());

  // Pick the hex with shortest distance to target
  array.sort((a, b) => {
    return a.distanceHexToTarget - b.distanceHexToTarget;
  });

  // console.log(array);

  // We repeat until we can move three steps closer to the target
  while (array[0].distanceHexToCurrent < 3) {
    // console.log('Distance from hex to target ' + array[0].distanceHexToTarget);
    // console.log(
    //   'Distance from hex to current ' + array[0].distanceHexToCurrent
    // );
    // console.log('Repeating the loop');
    Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
      addAdjacentMoves(inRangeHex)
    );

    array = Array.from(inRangeHexMap.values());
    // Pick the hex with shortest distance to target
    array.sort((a, b) => {
      return a.distanceHexToTarget - b.distanceHexToTarget;
    });
  }

  return { column: array[0].column, row: array[0].row };
};

export const getDistanceBetweenHexes = (hexOne, hexTwo) => {
  const inRangeHexMap = new Map();

  const addAdjacentMoves = (newPosition) => {
    BOARD.forEach((hex) => {
      let hexPosition = { row: hex.row, column: hex.column };
      if (isAdjacent(newPosition, hexPosition))
        inRangeHexMap.set(JSON.stringify(hexPosition), hexPosition);
    });
  };

  const hexIsInRange = (hex, hexRange) => {
    let result = false;

    hexRange.forEach((hexInRange) => {
      if (hexInRange.row === hex.row && hexInRange.column === hex.column)
        result = true;
    });

    return result;
  };

  let steps = 1;

  // One step
  addAdjacentMoves(hexOne);
  if (hexIsInRange(hexTwo, inRangeHexMap)) return steps;

  // Else we repeat until we're done
  while (!hexIsInRange(hexTwo, inRangeHexMap)) {
    Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
      addAdjacentMoves(inRangeHex)
    );
    steps++;
  }

  return steps;

  // // Two steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 2;

  // // Three steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 3;

  // // Four steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 4;

  // // Five steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 5;

  // // Six steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 6;

  // // Seven steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 7;

  // // Eight steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 8;

  // // Nine steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 9;

  // // Ten steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 10;

  // // Eleven steps
  // Array.from(inRangeHexMap.values()).forEach((inRangeHex) =>
  //   addAdjacentMoves(inRangeHex)
  // );
  // if (hexIsInRange(hexTwo, inRangeHexMap)) return 11;

  // // All other cases we just return 10
  // return 10;
};

const isAdjacent = (currentPosition, newPosition) => {
  // Remember, even columns contain odd rows and vice versa!!
  // We assume that the incoming positions all exist on the board!!

  // Check if the move is one valid row step in the same column
  if (newPosition.column === currentPosition.column) {
    return (
      newPosition.row === currentPosition.row + 2 ||
      newPosition.row === currentPosition.row - 2
    );
  }

  // Check if the move is one valid column step to an adjacent row
  if (
    newPosition.column === currentPosition.column + 1 ||
    newPosition.column === currentPosition.column - 1
  ) {
    return (
      newPosition.row === currentPosition.row + 1 ||
      newPosition.row === currentPosition.row - 1
    );
  }

  return false;
};

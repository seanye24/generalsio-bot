const { runInThisContext } = require('vm');

// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

// patch diff array into current array
const patch = (old, diff) => {
  let out = [];
  let i = 0;
  while (i < diff.length) {
    // matching
    if (diff[i]) {
      out.push(...old.slice(out.length, out.length + diff[i]));
    }
    ++i;
    // mismatching
    if (i < diff.length && diff[i]) {
      out.push(...diff.slice(i + 1, i + 1 + diff[i]));
    }
    i += 1 + diff[i];
  }
  return out;
};

class GameState {
  constructor(playerIndex) {
    this.playerIndex = playerIndex;
    this.turn = 0;
    this.scores = [];
    this.generals = [];
    this.crown = 0;
    this.cities = [];
    this.map = [];
    this.width = 0;
    this.height = 0;
    this.size = 0;
    this.foundGenerals = [];
    this.armies = [];
    this.terrain = [];
    this.mountains = new Set();
    this.myScore = [];
    this.numOwnedCities = 0;
    this.center = { row: 0, col: 0 };
    this.avgTileSize = 0;
    this.biggestEnemy = -1;
  }

  static get TILE_EMPTY() {
    return TILE_EMPTY;
  }

  static get TILE_MOUNTAIN() {
    return TILE_MOUNTAIN;
  }

  static get TILE_FOG() {
    return TILE_FOG;
  }

  static get TILE_FOG_OBSTACLE() {
    return TILE_FOG_OBSTACLE;
  }

  // calculate euclidean distance between two tiles
  dist = (start, end) =>
    Math.abs(Math.floor(start / this.width) - Math.floor(end / this.width)) +
    Math.abs((start % this.width) - (end % this.width));

  // check if index can be currently reachable
  isReachable = (index) => {
    const minTile = this.cities.indexOf(index) === -1 ? TILE_EMPTY : 0;
    return (
      (this.terrain[index - 1] >= minTile && index !== 0) ||
      (this.terrain[index + 1] >= minTile && index !== this.width - 1) ||
      this.terrain[index - this.width] >= minTile ||
      this.terrain[index + this.width] >= minTile
    );
  };

  // check if move is valid
  isValidMove = (start, end) => {
    const startCol = start % this.width;
    const endRow = Math.floor(end / this.width);
    const endCol = end % this.width;
    return !(
      endRow < 0 ||
      endRow >= this.height ||
      (startCol === 0 && endCol > 1) ||
      (startCol === this.width - 1 && endCol < this.width - 2)
    );
  };

  // update game state
  update(player, data) {
    // game data
    this.turn = data.turn;
    this.scores = data.scores;
    this.generals = data.generals;
    this.crown = this.generals[this.playerIndex];

    // map data
    const newCities = patch(this.cities, data.cities_diff);
    this.map = patch(this.map, data.map_diff);
    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    const prevArmies = [...this.armies];
    const prevTerrain = [...this.terrain];
    this.armies = this.map.slice(2, this.size + 2);
    this.terrain = this.map.slice(this.size + 2, this.size + 2 + this.size);

    // cache cities
    for (const city of newCities) {
      if (this.cities.indexOf(city) === -1) {
        this.cities.push(city);
      }
    }

    // cache mountains
    this.terrain.forEach((tile, index) => {
      if (tile === TILE_MOUNTAIN) {
        this.mountains.add(index);
      }
    });

    // my data
    this.myScore = this.scores.find((score) => score.i === this.playerIndex);
    // number of cities I currently own
    this.numOwnedCities = this.cities.filter(
      (city) => this.terrain[city] === this.playerIndex
      // (city) => player.team.has(this.terrain[city])
    ).length;

    // update located crowns
    this.generals.forEach((gen, pIndex) => {
      if (
        gen !== -1 &&
        gen !== this.crown &&
        !player.team.has(pIndex) &&
        !this.foundGenerals.find((fg) => fg.index === gen)
      ) {
        this.foundGenerals.push({ index: gen, playerIndex: pIndex });
      }
    });

    // remove captured crowns
    this.foundGenerals = this.foundGenerals.filter(
      (fg) => !this.scores.find((score) => score.i === fg.playerIndex).dead
    );

    // calculate army center coordinates
    [this.center.row, this.center.col] = this.terrain
      .reduce(
        (acc, tile, index) => {
          // if (tile === this.playerIndex) {
          if (player.team.has(tile)) {
            const row = Math.floor(index / this.width);
            const col = index % this.width;
            acc[0] += row;
            acc[1] += col;
          }
          return acc;
        },
        [0, 0]
      )
      .map((avg) => avg / this.myScore.tiles);
    this.avgTileSize = this.myScore.total / this.myScore.tiles;

    // let biggestEnemy be the enemy you see the most
    const enemyMap = new Map();
    this.terrain.forEach((tile, index) => {
      // if (tile !== this.playerIndex && tile >= 0 && this.isReachable(index)) {
      if (!player.team.has(tile) && tile >= 0 && this.isReachable(index)) {
        if (enemyMap.has(tile)) {
          enemyMap.set(tile, enemyMap.get(tile) + 1);
        } else {
          enemyMap.set(tile, 1);
        }
      }
    });
    this.biggestEnemy = -1;
    enemyMap.forEach((enemyCount, enemy) => {
      if (this.biggestEnemy === -1) {
        this.biggestEnemy = enemy;
      } else if (enemyCount > enemyMap.get(this.biggestEnemy)) {
        this.biggestEnemy = enemy;
      }
    });
    return [prevArmies, prevTerrain];
  }
}

module.exports = GameState;

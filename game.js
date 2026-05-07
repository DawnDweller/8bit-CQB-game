// 8-Bit Action Game
// Controls: W/A/S/D move, J shoot, K melee, E talk

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 16;
const MAP_COLS = canvas.width / TILE_SIZE;
const MAP_ROWS = canvas.height / TILE_SIZE;

// Tile codes
// 0: floor
// 1: solid wall (blocks movement + bullets)
// 2: breakable wall (needs 5 bullets then melee; blocks movement + bullets until destroyed)
// 3: green door (level exit; locked unless player has key)
// 4: gold tile (win)
// 5,6,7: furniture (different colors; block movement, NOT bullets)

const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_BREAKABLE = 2;
const TILE_DOOR = 3;
const TILE_GOAL = 4;
const TILE_FURNITURE1 = 5;
const TILE_FURNITURE2 = 6;
const TILE_FURNITURE3 = 7;

const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// HUD helpers
const statsDiv = document.getElementById("stats");
const messagesDiv = document.getElementById("messages");

function setMessage(text, duration = 2000) {
  messagesDiv.textContent = text;
  if (text) {
    setTimeout(() => {
      if (messagesDiv.textContent === text) {
        messagesDiv.textContent = "";
      }
    }, duration);
  }
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Game state
let player;
let bullets = [];
let enemies = [];
let civilians = [];
let items = [];
let currentLevelIndex = 0;
let tilemap = [];
// key: "x,y" -> { bulletHits }
let breakableState = {};
let lastTime = 0;
let gameOver = false;
let win = false;

// Entities
function createPlayer(x, y) {
  return {
    x,
    y,
    w: 12,
    h: 12,
    speed: 60,
    bullets: 20,
    health: 100,
    morality: 100,
    hasKey: false,
    facingX: 1,
    facingY: 0,
    meleeTimer: 0,
    shootCooldown: 0
  };
}

function createEnemy(x, y, behavior = "patrol") {
  return {
    x,
    y,
    w: 12,
    h: 12,
    speed: 40,
    bullets: 20,
    state: "shooting",
    fireCooldown: 0.8 + Math.random() * 0.6,
    health: 40,
    alive: true,
    behavior, // "losShooter" or "patrol"
    vx: 0,
    vy: 0,
    moveTimer: 0
  };
}

function createCivilian(x, y, dialog) {
  return {
    x,
    y,
    w: 10,
    h: 10,
    speed: 60, // more frantic
    vx: 0,
    vy: 0,
    alive: true,
    dialog,
    talkTimer: 0,
    changeDirTimer: 0
  };
}

function createItem(x, y, type) {
  return {
    x,
    y,
    w: 10,
    h: 10,
    type,
    active: true
  };
}

function createBullet(x, y, dx, dy, owner) {
  const len = Math.hypot(dx, dy) || 1;
  return {
    x,
    y,
    w: 4,
    h: 4,
    dx: dx / len,
    dy: dy / len,
    speed: 120,
    owner
  };
}

// Level definitions
// Simple 20x11 maps (MAP_COLS=20, MAP_ROWS=11)
const level1 = {
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  map: [
    // 0-19
/*     [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,5,0,0,0,1,0,0,0,0,0,0,2,2,2,0,3,1],
    [1,0,0,5,0,6,0,1,0,0,0,0,0,0,2,2,2,0,0,1],
    [1,0,0,5,0,0,0,1,1,1,1,1,0,0,2,2,2,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,1],
    [1,0,6,0,0,0,1,1,1,0,0,0,0,1,1,1,0,7,0,1],
    [1,0,0,0,0,0,1,0,0,0,6,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,5,0,1,0,0,0,0,0,0,1,0,7,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,2,2,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,2,2,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] */
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,6,0,0,0,1,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,1],
    [1,0,0,6,0,6,0,1,0,0,0,0,0,0,2,2,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,6,0,0,0,1,1,1,1,1,0,0,2,2,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,6,0,0,0,1,1,1,1,5,1,1,1,0,0,0,7,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,5,0,1,7,2,0,0,2,0,1,0,7,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,0,2,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,7,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]

  ],
  // 1 Wall
  // 2 Breakable wall
  // 3 Door to next level
  // 5 Creme Color Furniture
  // 6 Violet Color Furniture
  // 7 Bluish Grey Color Furniture
  civilians: [
    { x: 5 * TILE_SIZE, y: 2 * TILE_SIZE, text: "Please save Jannie, she is been tied and taken to that room by those men. Only she knows how to get out of here." },
    { x: 7 * TILE_SIZE, y: 6 * TILE_SIZE, text: "The door is lock, we must find the rusty key! Then we can get out from the green door." }
  ],
  enemies: [
    { x: 12 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, behavior: "patrol" },
    { x: 7 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 6 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "patrol" },
    { x: 12 * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "losShooter" }
  ],
  items: [
    { x: 4 * TILE_SIZE, y: 5 * TILE_SIZE, type: "health" },
    { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, type: "ammo" },
    { x: 17 * TILE_SIZE, y: 4 * TILE_SIZE, type: "key" }
  ]
};

const level2 = {
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,5,0,0,0,1,0,0,2,2,2,0,0,0,0,0,3,1],
    [1,0,6,5,0,0,0,1,0,0,2,0,2,0,0,7,0,0,0,1],
    [1,0,0,5,0,0,0,1,1,1,2,0,2,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,2,0,2,1,0,0,0,0,0,1],
    [1,0,6,0,0,0,1,1,0,1,2,0,2,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,1,2,2,2,1,0,0,0,0,0,1],
    [1,0,0,0,5,0,1,0,0,1,0,0,0,1,0,7,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,6,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],

  civilians: [
    { x: 6 * TILE_SIZE, y: 3 * TILE_SIZE, text: "You made it this far?" }
  ],
  enemies: [
    { x: 10 * TILE_SIZE, y: 4 * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 6 * TILE_SIZE, behavior: "patrol" },
    { x: 16 * TILE_SIZE, y: 3 * TILE_SIZE, behavior: "patrol" }
  ],
  items: [
    { x: 3 * TILE_SIZE, y: 7 * TILE_SIZE, type: "health" },
    { x: 12 * TILE_SIZE, y: 2 * TILE_SIZE, type: "ammo" }
  ]
};

const level3 = {
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,5,0,0,0,1,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,0,6,5,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,5,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,5,0,0,1,0,0,0,0,0,1],
    [1,0,6,0,0,0,1,1,1,0,0,0,0,1,1,1,0,7,0,1],
    [1,0,0,0,0,0,1,0,0,0,6,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,5,0,1,0,0,0,0,0,0,1,0,7,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,6,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  civilians: [],
  enemies: [
    { x: 12 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 15 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "patrol" }
  ],
  items: [
    { x: 4 * TILE_SIZE, y: 5 * TILE_SIZE, type: "health" },
    { x: 10 * TILE_SIZE, y: 7 * TILE_SIZE, type: "ammo" }
  ]
};

const levels = [level1, level2, level3];

function loadLevel(index) {
  currentLevelIndex = index;
  const lvl = levels[index];
  tilemap = lvl.map.map(row => row.slice());
  breakableState = {};
  bullets = [];

  player = player || createPlayer(lvl.playerStart.x, lvl.playerStart.y);
  player.x = lvl.playerStart.x;
  player.y = lvl.playerStart.y;

  enemies = lvl.enemies.map(e => createEnemy(e.x, e.y, e.behavior));
  civilians = lvl.civilians.map(c =>
    createCivilian(c.x, c.y, c.text)
  );
  items = lvl.items.map(i => createItem(i.x, i.y, i.type));

  setMessage("Level " + (index + 1));
  updateHUD();
}

// Tile helpers
function tileAtPixel(px, py) {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return TILE_WALL;
  return tilemap[ty][tx];
}

function setTile(tx, ty, v) {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return;
  tilemap[ty][tx] = v;
}

function isSolidForMovement(tile) {
  // Door is walkable; still blocks bullets via blocksBullets.
  return (
    tile === TILE_WALL ||
    tile === TILE_BREAKABLE ||
    tile === TILE_FURNITURE1 ||
    tile === TILE_FURNITURE2 ||
    tile === TILE_FURNITURE3
  );
}

function blocksBullets(tile) {
  return (
    tile === TILE_WALL ||
    tile === TILE_BREAKABLE ||
    tile === TILE_DOOR
  );
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

function moveWithCollision(entity, dx, dy) {
  // X axis
  if (dx !== 0) {
    let newX = entity.x + dx;
    const left = newX;
    const right = newX + entity.w;
    const top = entity.y;
    const bottom = entity.y + entity.h;

    const tilesToCheck = [
      { x: left, y: top },
      { x: left, y: bottom - 1 },
      { x: right - 1, y: top },
      { x: right - 1, y: bottom - 1 }
    ];
    let blocked = false;
    for (const p of tilesToCheck) {
      const tile = tileAtPixel(p.x, p.y);
      if (isSolidForMovement(tile)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) entity.x = newX;
  }

  // Y axis
  if (dy !== 0) {
    let newY = entity.y + dy;
    const left = entity.x;
    const right = entity.x + entity.w;
    const top = newY;
    const bottom = newY + entity.h;

    const tilesToCheck = [
      { x: left, y: top },
      { x: left, y: bottom - 1 },
      { x: right - 1, y: top },
      { x: right - 1, y: bottom - 1 }
    ];
    let blocked = false;
    for (const p of tilesToCheck) {
      const tile = tileAtPixel(p.x, p.y);
      if (isSolidForMovement(tile)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) entity.y = newY;
  }
}

function updatePlayer(dt) {
  if (!player) return;
  if (gameOver || win) return;

  let dx = 0;
  let dy = 0;
  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx = (dx / len) * player.speed * dt;
    dy = (dy / len) * player.speed * dt;
    player.facingX = dx / (Math.abs(dx) + Math.abs(dy) || 1);
    player.facingY = dy / (Math.abs(dx) + Math.abs(dy) || 1);
  }

  moveWithCollision(player, dx, dy);

  // Shooting
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (keys["j"] && player.shootCooldown <= 0 && player.bullets > 0) {
    let fx = player.facingX;
    let fy = player.facingY;
    if (fx === 0 && fy === 0) {
      fx = 1;
      fy = 0;
    }
    bullets.push(
      createBullet(
        player.x + player.w / 2,
        player.y + player.h / 2,
        fx,
        fy,
        "player"
      )
    );
    player.bullets--;
    player.shootCooldown = 0.25;
    updateHUD();
  }

  // Melee
  if (keys["k"] && player.meleeTimer <= 0) {
    player.meleeTimer = 0.15;
  }
  if (player.meleeTimer > 0) {
    player.meleeTimer -= dt;
  }

  // Talk (E)
  if (keys["e"]) {
    talkToCivilian();
  }
}

function talkToCivilian() {
  for (const c of civilians) {
    if (!c.alive) continue;
    const dx = c.x - player.x;
    const dy = c.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      c.talkTimer = 1.5;
      setMessage(c.dialog);
      break;
    }
  }
}

function updateCivilians(dt) {
  for (const c of civilians) {
    if (!c.alive) continue;
    c.changeDirTimer -= dt;
    if (c.changeDirTimer <= 0) {
      const dir = Math.random() * Math.PI * 2;
      const panicSpeed = c.speed * (0.7 + Math.random() * 0.6);
      c.vx = Math.cos(dir) * panicSpeed;
      c.vy = Math.sin(dir) * panicSpeed;
      c.changeDirTimer = 0.4 + Math.random() * 0.6;
    }
    moveWithCollision(c, c.vx * dt, c.vy * dt);
    if (c.talkTimer > 0) c.talkTimer -= dt;
  }
}

function hasLineOfSight(ax, ay, bx, by) {
  const steps = 16;
  const dx = (bx - ax) / steps;
  const dy = (by - ay) / steps;
  for (let i = 1; i <= steps; i++) {
    const sx = ax + dx * i;
    const sy = ay + dy * i;
    const tile = tileAtPixel(sx, sy);
    if (
      tile === TILE_WALL ||
      tile === TILE_BREAKABLE ||
      tile === TILE_DOOR ||
      tile === TILE_FURNITURE1 ||
      tile === TILE_FURNITURE2 ||
      tile === TILE_FURNITURE3
    ) {
      return false;
    }
  }
  return true;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Shooting phase while they still have bullets
    if (e.state === "shooting" && e.bullets > 0) {
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;

        let canShoot = true;
        if (e.behavior === "losShooter") {
          canShoot = hasLineOfSight(ex, ey, px, py);
        }

        if (canShoot) {
          const dx = px - ex;
          const dy = py - ey;
          const b = createBullet(ex, ey, dx, dy, "enemy");
          bullets.push(b);
          e.bullets--;
        }

        e.fireCooldown = 0.8 + Math.random() * 0.6;
      }
    }

    // Simple patrol movement for patrol enemies while shooting
    if (e.behavior === "patrol" && e.state === "shooting") {
      e.moveTimer -= dt;
      if (e.moveTimer <= 0) {
        const dir = Math.random() * Math.PI * 2;
        e.vx = Math.cos(dir) * e.speed * 0.5;
        e.vy = Math.sin(dir) * e.speed * 0.5;
        e.moveTimer = 0.6 + Math.random() * 0.8;
      }
      moveWithCollision(e, e.vx * dt, e.vy * dt);
    }

    // Switch to chasing when out of ammo
    if (e.bullets <= 0 && e.state !== "chasing") {
      e.state = "chasing";
    }

    if (e.state === "chasing") {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const vx = (dx / len) * e.speed * dt;
      const vy = (dy / len) * e.speed * dt;
      moveWithCollision(e, vx, vy);

      // Damage player on touch
      if (rectsOverlap(e, player)) {
        player.health -= 30 * dt;
        if (player.health <= 0) {
          player.health = 0;
          triggerGameOver("You are dead...");
        }
        updateHUD();
      }
    }
  }
}

function updateItems(dt) {
  for (const it of items) {
    if (!it.active) continue;
    if (rectsOverlap(it, player)) {
      if (it.type === "health") {
        player.health = clamp(player.health + 30, 0, 100);
        setMessage("Recovered health");
      } else if (it.type === "ammo") {
        player.bullets += 10;
        setMessage("Picked up ammo (+10)");
      } else if (it.type === "key") {
        player.hasKey = true;
        setMessage("Got the key!");
      }
      it.active = false;
      updateHUD();
    }
  }
}

function updateBullets(dt) {
  const newBullets = [];
  for (const b of bullets) {
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;

    // Off-screen
    if (
      b.x < 0 ||
      b.y < 0 ||
      b.x > canvas.width ||
      b.y > canvas.height
    ) {
      continue;
    }

    const centerX = b.x + b.w / 2;
    const centerY = b.y + b.h / 2;
    const tx = Math.floor(centerX / TILE_SIZE);
    const ty = Math.floor(centerY / TILE_SIZE);
    const tile = tileAtPixel(centerX, centerY);

    if (blocksBullets(tile)) {
      if (tile === TILE_BREAKABLE) {
        const key = tx + "," + ty;
        if (!breakableState[key]) {
          breakableState[key] = { bulletHits: 0 };
        }
        breakableState[key].bulletHits++;
        // Do not break here; only mark hits. Melee will break once bulletHits >= 5.
      }
      continue; // bullet destroyed
    }

    // Furniture: bullets pass through, but player bullets destroy furniture
    if (
      (tile === TILE_FURNITURE1 ||
        tile === TILE_FURNITURE2 ||
        tile === TILE_FURNITURE3) &&
      b.owner === "player"
    ) {
      setTile(tx, ty, TILE_FLOOR);
    }

    if (b.owner === "player") {
      // Hit enemies
      let hitEnemy = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(b, e)) {
          e.health -= 25;
          if (e.health <= 0) e.alive = false;
          hitEnemy = true;
          break;
        }
      }
      if (hitEnemy) continue;

      // Hit civilians
      let hitCiv = false;
      for (const c of civilians) {
        if (!c.alive) continue;
        if (rectsOverlap(b, c)) {
          c.alive = false;
          player.morality -= 20;
          setMessage("You've killed a civilian!");
          if (player.morality <= 0) {
            player.morality = 0;
            triggerGameOver("Your morality reached zero.");
          }
          updateHUD();
          hitCiv = true;
          break;
        }
      }
      if (hitCiv) continue;
    } else if (b.owner === "enemy") {
      // Hit player
      if (rectsOverlap(b, player)) {
        player.health -= 20;
        if (player.health <= 0) {
          player.health = 0;
          triggerGameOver("You were shot down!");
        }
        updateHUD();
        continue;
      }
    }

    newBullets.push(b);
  }
  bullets = newBullets;
}

function updateMelee(dt) {
  if (!player) return;
  if (player.meleeTimer <= 0) return;

  const radius = 18;
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;

  // Damage enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = (e.x + e.w / 2) - cx;
    const dy = (e.y + e.h / 2) - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      e.health -= 30;
      if (e.health <= 0) e.alive = false;
    }
  }

  // Damage civilians (same morality effect as bullets)
  for (const c of civilians) {
    if (!c.alive) continue;
    const dx = (c.x + c.w / 2) - cx;
    const dy = (c.y + c.h / 2) - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      c.alive = false;
      player.morality -= 40;
      setMessage("You've killed a civilian!");
      if (player.morality <= 0) {
        player.morality = 0;
        triggerGameOver("You have killed too many innocent lives. You've lost your sanity!");
      }
      updateHUD();
    }
  }

  // Environment interactions (breakable walls + furniture)
  const tilesToCheck = [
    { x: cx - radius, y: cy },
    { x: cx + radius, y: cy },
    { x: cx, y: cy - radius },
    { x: cx, y: cy + radius }
  ];
  for (const p of tilesToCheck) {
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    const tile = tileAtPixel(p.x, p.y);
    if (tile === TILE_BREAKABLE) {
      const key = tx + "," + ty;
      if (!breakableState[key]) {
        breakableState[key] = { bulletHits: 0 };
      }
      const state = breakableState[key];
      // Wall breaks only when it has at least 5 bullet hits and then receives melee
      if (state.bulletHits >= 5) {
        setTile(tx, ty, TILE_FLOOR);
        delete breakableState[key];
      }
    } else if (
      tile === TILE_FURNITURE1 ||
      tile === TILE_FURNITURE2 ||
      tile === TILE_FURNITURE3
    ) {
      // One melee hit destroys furniture immediately
      setTile(tx, ty, TILE_FLOOR);
    }
  }
}

function checkDoorAndGoal() {
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  const tile = tileAtPixel(px, py);

  if (tile === TILE_DOOR) {
    // Level 1: door locked unless player has key
    if (currentLevelIndex === 0) {
      if (player.hasKey) {
        if (currentLevelIndex + 1 < levels.length) {
          loadLevel(currentLevelIndex + 1);
        }
      } else {
        setMessage("Door is locked.");
      }
    } else {
      // Level 2 door/exits, no key needed -> go to next level
      if (currentLevelIndex + 1 < levels.length) {
        loadLevel(currentLevelIndex + 1);
      }
    }
  } else if (tile === TILE_GOAL) {
    win = true;
    updateHUD();
    alert("You win!");
  }
}

function triggerGameOver(reason) {
  if (gameOver) return;
  gameOver = true;
  setMessage(reason);
  alert("Game Over: " + reason);
}

function updateHUD() {
  statsDiv.textContent =
    "Health: " +
    Math.round(player.health) +
    " | Morality: " +
    Math.round(player.morality) +
    " | Ammo: " +
    player.bullets +
    " | Level: " +
    (currentLevelIndex + 1);
}

// Rendering
function drawTile(x, y, t) {
  let color = "#222";
  if (t === TILE_FLOOR) color = "#222";
  else if (t === TILE_WALL) color = "#555";
  else if (t === TILE_BREAKABLE) {
    color = "#884422";
    const tx = x / TILE_SIZE;
    const ty = y / TILE_SIZE;
    const key = tx + "," + ty;
    const state = breakableState[key];
    if (state && state.bulletHits >= 5) {
      // Fractured look after 5+ bullet hits
      color = "#aa6644";
    }
  } else if (t === TILE_DOOR) color = "#00aa00";
  else if (t === TILE_GOAL) color = "#e0c040";
  else if (t === TILE_FURNITURE1) color = "#aa7744";
  else if (t === TILE_FURNITURE2) color = "#884488";
  else if (t === TILE_FURNITURE3) color = "#6688aa";

  ctx.fillStyle = color;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Optional crack overlay for fractured breakable walls
  if (t === TILE_BREAKABLE) {
    const tx = x / TILE_SIZE;
    const ty = y / TILE_SIZE;
    const key = tx + "," + ty;
    const state = breakableState[key];
    if (state && state.bulletHits >= 5) {
      ctx.strokeStyle = "#331100";
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + TILE_SIZE - 2, y + TILE_SIZE - 2);
      ctx.stroke();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Tiles
  const rows = tilemap.length;
  for (let y = 0; y < rows; y++) {
    const row = tilemap[y];
    if (!row) continue;
    const cols = row.length;
    for (let x = 0; x < cols; x++) {
      drawTile(x * TILE_SIZE, y * TILE_SIZE, row[x]);
    }
  }

  // Items
  for (const it of items) {
    if (!it.active) continue;

    if (it.type === "health") ctx.fillStyle = "#55ff55";
    else if (it.type === "ammo") ctx.fillStyle = "#ffff55";
    else if (it.type === "key") ctx.fillStyle = "#b40000";
    ctx.fillRect(it.x, it.y, it.w, it.h);

    // Simple 8-bit style symbols
    ctx.fillStyle = "#000000";
    ctx.font = "8px monospace";
    if (it.type === "health") {
      ctx.fillText("+", it.x + 2, it.y + it.h - 2);
    } else if (it.type === "ammo") {
      ctx.fillText("|", it.x + 3, it.y + it.h - 2);
    }
  }

  // Civilians
  for (const c of civilians) {
    if (!c.alive) continue;
    ctx.fillStyle = "#f1bae8";
    ctx.fillRect(c.x, c.y, c.w, c.h);
    if (c.talkTimer > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "6px monospace";
      ctx.fillText("!!!", c.x - 2, c.y - 4);
    }
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = "#ff0808";
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  // Player
  if (player) {
    ctx.fillStyle = "#44aaff";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    // Melee circle (visual)
    if (player.meleeTimer > 0) {
      ctx.strokeStyle = "rgba(71, 154, 181, 0.6)";
      ctx.beginPath();
      ctx.arc(
        player.x + player.w / 2,
        player.y + player.h / 2,
        18,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  // Bullets
  ctx.fillStyle = "#ffffaa";
  for (const b of bullets) {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
}

// Main loop
function update(dt) {
  if (!player) return;
  if (gameOver || win) return;

  updatePlayer(dt);
  updateCivilians(dt);
  updateEnemies(dt);
  updateItems(dt);
  updateMelee(dt);
  updateBullets(dt);
  checkDoorAndGoal();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  if (!gameOver && !win) {
    requestAnimationFrame(gameLoop);
  }
}

// Start game
loadLevel(0);
requestAnimationFrame(gameLoop);

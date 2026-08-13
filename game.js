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
const TILE_FURNITURE4 = 8;
const TILE_SECRET_DOOR = 9;
const TILE_PASSDOOR = 10;
const TILE_WATER = 11;
const TILE_LIGHT = 12;

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
let oracles = [];
let items = [];
let currentLevelIndex = 0;
let tilemap = [];
let levelUsesLighting = false;
// key: "x,y" -> { bulletHits }
let breakableState = {};
let secretCode = null; // generated when shooter goes neutral
let lastTime = 0;
let waveTime = 0;
let gameOver = false;
let win = false;

// Entities
function createPlayer(x, y) {
  return {
    x,
    y,
    w: 12,
    h: 12,
    speed: 80,
    bullets: 500,//0,
    health: 500,//100,
    morality: 140,//140,
    hasKey: false,
    hasMelee: false,
    facingX: 1,
    facingY: 0,
    armor: 0,
    breath: 8,
    meleeTimer: 0,
    meleeSeed: 0,
    parryTimer: 0,
    parrySeed: 0,
    shootCooldown: 0,
    talkCooldown: 0
  };
}

function createEnemy(x, y, behavior = "patrol", opts = {}) {
  // Defaults overridden per type
  let base = {
    x,
    y,
    w: 12,
    h: 12,
    speed: 80,
    bullets: 10,
    state: "shooting",
    fireCooldown: 0.8 + Math.random() * 0.6,
    health: 40,
    alive: true,
    behavior, // "losShooter", "patrol", etc
    vx: 0,
    vy: 0,
    moveTimer: 0,
    hasSeenPlayer: false,      // for losPatrol, kicker, boss
    isNeutral: false,          // for shooter after ammo gone / neutral boss
    isBoss: false,             // for boss attack
    oneShotAttack: false,      // used by boss behaviour
    dialog: null,              // for shooter/boss post-ammo
    talkTimer: 0               // for !!! marker on talkables
  };

  // Behavior-specific overrides!
  if (behavior === "kicker") {
    base.speed = 160; // Patrol speed doubled
    base.bullets = 0; // Only melee 
  }
  if (behavior === "boss") {
    base.health = 160;
    base.isBoss = true;
    base.oneShotAttack = true;
    base.bullets = 1;
    base.speed = 90; // Slightly faster than patrol
  }
  if (behavior === "shooter") {
    base.bullets = 50; // Fewer bullets for new shooter
  }
  if (behavior === "shotShooter") {
    base.bullets = 30;
    base.fireCooldown = 1.2 + Math.random() * 0.6;
  }
  // Allow custom values from opts
  for (const k in opts) base[k] = opts[k];
  return base;
}

function createCivilian(x, y, dialog, gender = "male") {
  return {
    x,
    y,
    w: 11,
    h: 11,
    speed: 90, // more frantic
    vx: 0,
    vy: 0,
    alive: true,
    dialog,
    gender,
    talkTimer: 0,
    changeDirTimer: 0
  };
}

function createOracle(x, y) {
  return {
    x,
    y,
    w: 11,
    h: 11,
    alive: true,
    talkTimer: 0,
    answered: false,   // true once player has responded
    accepted: false    // true if player said yes
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
    speed: 120, // bulletspeed
    owner
  };
}

// Level definitions
// Simple 20x11 maps (MAP_COLS=20, MAP_ROWS=11)
// Secret password:  One sword keeps another in the sheath. Sometimes the threat of violence alone is a deterrent. 
const level1 = {
  useLighting: false,
  playerStart: { x: 52 * TILE_SIZE, y: 22 * TILE_SIZE },
  map: [      // map size x = 69 tile  y = 31 tile
  // 1 Wall
  // 2 Breakable wall
  // 3 Door to next level
  // 4 End Game
  // 5 Creme Color Furniture
  // 6 Violet Color Furniture
  // 7 Bluish Grey Color Furniture (Door)
  // 8 Brownish Green Color Furniture
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,11,11,11,11,11,11,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,11,11,11,11,11,11,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,11,11,11,11,11,11,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,11,11,11,11,11,11,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1],
    [1,9,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,10,11,11,1,2,8,8,8,8,8,8,8,8,8,8,8,1,11,11,11,11,11,1,11,1,0,0,0,0,0,1],
    [1,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,11,1,11,1,2,8,11,11,11,11,11,11,11,11,11,11,1,11,0,0,0,11,9,11,1,0,0,0,0,0,1],
    [1,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,11,1,11,1,2,8,11,11,11,11,11,11,11,11,11,11,1,11,0,0,0,11,1,11,1,0,0,0,0,0,1],
    [1,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,1,11,1,11,1,2,8,11,11,0,0,0,0,0,0,0,0,1,11,0,0,0,11,1,11,1,0,0,0,0,0,1],
    [1,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,11,1,11,1,2,8,11,11,0,0,0,0,0,0,0,0,1,11,11,11,11,1,1,11,1,0,0,0,0,0,1],
    [1,9,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,11,1,11,1,2,8,11,11,0,0,0,0,0,0,0,0,1,1,1,1,1,9,9,11,1,0,0,0,0,0,1],
    [1,9,9,9,1,1,9,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,1,0,0,1,11,1,11,1,2,8,11,11,0,0,0,0,0,0,0,0,1,11,11,11,9,11,1,11,1,0,0,0,0,0,1],
    [1,0,1,0,0,0,9,0,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,3,1,0,0,0,1,0,0,1,11,1,11,11,2,8,11,11,0,0,0,0,0,0,2,0,1,9,1,1,1,1,1,11,1,0,0,0,0,0,1],
    [1,9,1,9,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,2,1,0,0,0,1,0,0,1,11,1,11,11,2,8,11,11,0,0,0,0,0,0,0,0,1,11,11,11,9,11,1,1,1,0,0,0,0,0,1],
    [1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,1,0,0,0,0,0,1,0,0,1,11,1,11,11,2,8,11,11,0,0,0,0,0,0,0,0,1,1,1,1,11,11,9,11,1,0,0,0,0,0,1],
    [1,1,1,0,1,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,1,11,1,11,11,2,8,11,11,0,0,0,0,0,0,0,0,1,11,11,11,1,1,1,11,1,0,0,0,0,0,1],
    [1,0,9,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,7,1,1,1,1,1,1,1,1,0,0,1,11,11,1,11,5,8,11,11,0,0,0,0,0,0,0,0,9,11,1,11,1,11,11,11,1,0,0,0,0,0,1],
    [1,9,1,1,1,0,0,0,5,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,11,11,11,1,1,8,11,11,11,11,11,11,11,11,11,11,1,11,1,11,11,1,1,9,1,0,0,0,0,0,1],
    [1,0,1,0,2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,11,11,11,11,1,8,11,11,11,11,11,11,11,11,11,11,1,11,11,11,1,11,1,11,1,0,0,0,0,0,1],
    [1,9,1,1,1,0,0,0,5,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,11,11,11,11,1,8,8,8,8,8,8,8,8,8,8,8,1,11,1,11,9,11,11,11,1,0,0,0,0,0,1],
    [1,0,9,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,11,11,11,11,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1],
    [1,1,1,9,1,0,0,0,5,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,9,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,9,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,7,6,7,0,0,0,0,1],
    [1,0,0,0,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,2,7,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,7,6,7,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
/*
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,5,5,0,1,2,0,0,0,2,1,0,7,6,1,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,6,0,2,2,2,0,6,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,5,0,0,1,0,0,0,3,1],
    [1,2,2,2,0,5,0,1,0,0,2,0,0,1,0,1,0,1,0,1,0,0,8,7,5,2,6,7,8,0,0,4,2,0,0,1,0,0,0,0,0,0,0,1,0,0,4,0,2,0,0,1,0,0,1,0,0,0,0,0,0,5,0,0,1,0,0,0,0,1],
    [1,2,2,2,5,5,0,1,1,1,1,1,0,1,5,1,6,1,0,1,0,0,0,0,0,0,0,0,0,0,0,4,2,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,0,0,0,7,0,0,1,1,1,1,1,1,2,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,5,0,0,1,5,1,0,1,0,1,0,0,2,2,2,2,2,2,2,2,0,4,2,0,0,7,0,0,1,0,1,0,0,1,0,0,1,0,1,0,8,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,6,0,0,0,1,1,1,1,7,1,2,1,0,1,2,1,0,1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,1,0,0,1,0,1,0,0,7,0,0,1,0,1,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,0,0,0,1,2,1,6,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,7,1,1,1,1,1,1,1,1,1,1,1,1,7,7,1,1,1,2,0,0,0,1],
    [1,0,0,0,5,0,1,5,2,0,0,2,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,5,5,0,5,5,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,5,0,0,0,1],
    [1,0,0,0,0,0,1,0,2,2,0,2,0,1,2,1,6,1,0,1,0,0,0,0,0,0,0,0,0,2,5,5,0,5,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,5,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,2,1,0,7,0,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,8,8,0,8,0,6,6,6,6,6,6,6,6,6,6,0,1,0,0,0,0,0,0,0,0,1,0,5,0,0,0,1],
    [1,7,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,8,8,8,8,6,0,6,0,6,0,6,0,6,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,6,2,6,6,6,2,6,6,6,2,6,6,6,6,2,6,6,1,0,0,0,0,0,0,0,0,1,6,0,0,0,8,8,8,0,8,8,0,0,8,0,6,6,6,6,6,6,6,6,6,6,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,6,0,6,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,1,0,1,0,5,5,5,5,5,5,5,0,0,8,8,6,0,6,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,0,1,0,0,0,0,0,0,1,2,2,6,1,0,5,0,0,0,0,0,5,0,0,8,0,6,6,6,0,1,1,7,1,1,1,1,1,0,0,0,2,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,7,1,1,2,0,2,0,0,5,0,2,2,2,5,5,0,0,8,8,6,0,6,0,1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,2,2,2,0,0,5,0,2,2,2,0,5,0,0,8,0,6,6,6,0,1,0,0,0,0,0,0,1,1,7,1,1,1,1,7,1,1,1,7,1,1,2,1],
    [1,0,0,0,2,0,0,0,0,2,2,0,2,0,2,1,1,1,1,1,0,2,0,1,0,1,0,0,0,1,0,0,5,0,2,2,2,5,5,0,0,8,8,6,0,6,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,8,1],
    [1,0,0,0,0,0,2,2,0,0,0,0,0,0,0,1,6,7,7,2,0,2,0,1,0,1,0,1,0,0,0,0,5,0,0,0,0,0,5,0,0,8,0,6,6,6,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1],
    [1,0,0,0,0,0,0,0,0,2,0,0,2,0,0,1,1,1,1,1,0,2,0,1,0,1,0,0,0,0,0,0,5,5,5,5,5,5,5,0,0,8,8,6,0,6,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,8,1],
    [1,0,0,0,0,2,0,2,0,0,2,0,0,0,0,0,0,0,0,1,0,0,0,7,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,6,6,6,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1],
    [1,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,7,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,8,6,0,6,0,1,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,5,8,1],
    [1,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,6,0,1,0,0,0,0,0,0,2,0,0,6,2,6,0,0,6,0,0,0,0,5,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,0,0,0,0,0,1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,6,2,6,0,0,6,0,0,0,0,5,8,1],
    [1,0,0,0,2,2,0,0,0,0,6,6,0,0,0,0,0,0,1,0,0,0,6,0,0,1,0,0,0,0,0,0,1,0,1,0,0,0,0,0,2,2,2,2,0,0,0,1,0,0,0,0,0,0,2,0,0,6,2,6,0,0,6,0,0,0,0,5,0,1],
    [1,0,5,0,0,0,0,5,5,0,0,0,0,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0,0,0,0,2,0,0,0,5,1,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,5,8,1],
    [1,0,0,0,6,6,0,0,0,0,0,6,0,1,0,0,0,1,0,0,0,0,6,0,0,0,1,0,0,0,0,0,1,0,1,0,1,1,1,0,0,0,2,0,0,5,2,1,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1],
    [1,0,0,0,0,0,0,1,1,0,1,0,1,1,0,1,1,1,0,0,0,0,6,0,0,1,1,1,0,1,0,1,1,0,1,0,0,0,0,0,0,0,2,2,5,2,2,2,0,5,0,0,0,0,2,2,2,0,0,0,2,2,2,2,0,0,0,5,8,1],
    [1,1,1,1,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,1,0,1,1,0,0,0,0,0,5,2,1,8,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1],
    [1,0,0,1,0,6,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,0,6,0,1,0,0,0,1,1,1,0,1,0,1,0,0,0,0,1,0,0,0,0,2,2,2,1,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,8,1],
    [1,0,2,1,0,6,0,1,0,1,1,0,0,0,0,7,0,0,0,6,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,2,2,2,1,8,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,0,1],
    [1,0,7,0,0,0,0,0,0,0,0,0,0,2,2,7,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,2,1,0,8,0,8,0,8,0,8,0,8,0,8,0,8,0,8,0,8,0,8,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
*/
  ],
  civilians: [


    /*
    { x: 8 * TILE_SIZE, y: 2 * TILE_SIZE, text: "Please save Jannie, she is been tied and taken to that room by those men. Only she knows how to get out of here.", gender: "male" },
    { x: 7 * TILE_SIZE, y: 6 * TILE_SIZE, text: "Jannie: The door is lock, we must find the rusty key! Then we can get out from the green door.", gender: "female" },
    { x: 17 * TILE_SIZE, y: 17 * TILE_SIZE, text: "Doctor: I was stuck. Thanks for saving me. There are ammo and some medkit in the purple box behind me.", gender: "male" },
    { x: 14 * TILE_SIZE, y: 7 * TILE_SIZE, text: "Father: All I wanted to get my little girl out of here!", gender: "male" },
    { x: 14 * TILE_SIZE, y: 7 * TILE_SIZE, text: "Daughter: *Crying* Daddy!!! I wanna go home!.", gender: "female" },
    { x: 40 * TILE_SIZE, y: 6 * TILE_SIZE, text: "*Nervous* Hey! You are the famous χ!", gender: "male" },
    { x: 50 * TILE_SIZE, y: 20 * TILE_SIZE, text: "I heard that λ defeated you once... Is that true?", gender: "male" },
    { x: 29 * TILE_SIZE, y: 12 * TILE_SIZE, text: "Oh my gosh! 🥹 Thank you!!", gender: "female" },
    { x: 28 * TILE_SIZE, y: 14 * TILE_SIZE, text: "Thanks dude. 😎 You're so cool.", gender: "male" },
    { x: 3 * TILE_SIZE, y: 2 * TILE_SIZE, text: "Alpha α : It was a trap, buddy! He wants you dead and he knows the only way to do is to hide behind me. When you have the chance just finish him through me. At least one of us should make it! Tell my wife I still love her. I am happy to know that I die beside you! 🥲 _____Chi χ : I'll make sure your death will not be in vein, old friend. 😌", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Help!..", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Help me!..", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "No! Please...", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "I don't wanna die!", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Don't hurt me.", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Don't shoot!", gender: "male" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Please spare me!", gender: "female" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "I wanna go home!", gender: "female" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "We're all gonna die here!!!", gender: "female" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Please, someone...", gender: "female" },
    { x: 26 * TILE_SIZE, y: 9 * TILE_SIZE, text: "Help me!!!", gender: "female" },
    { x: 34 * TILE_SIZE, y: 8 * TILE_SIZE, text: "Thank you 🥹 so much! The secret password is '...enO'.", gender: "female" },
    { x: 47 * TILE_SIZE, y: 5 * TILE_SIZE, text: "I was a goner. 🥲 Thanks.", gender: "male" }
    */
{ x: 1 * TILE_SIZE, y: 21 * TILE_SIZE, text: "She is tied down and never talks. They keep her in that secret room.", gender: "male" },
{ x: 1 * TILE_SIZE, y: 23 * TILE_SIZE, text: "She wants you dead. You have to kill her!  χ(Chi): I just can't.", gender: "female" },
{ x: 7 * TILE_SIZE, y: 15 * TILE_SIZE, text: "Thank you. That was claustrophobic. There are others. Please help them!", gender: "female" }
  ],
  oracles: [
    { x: 53.15 * TILE_SIZE, y: 15.15 * TILE_SIZE }
  ],
  enemies: [
    /*
    { x: 12 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 9 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losPatrol" },
    { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, behavior: "losPatrol" },
    { x: 7 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 6 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "patrol" },
    { x: 12 * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 7 * TILE_SIZE, behavior: "patrol" },
    { x: 14 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losShooter" },
    { x: 2 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 3 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 4 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 5 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 6 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 7 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 8 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 9 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 10 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 11 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 13 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 15 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 16 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 17 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losShooter" },
    { x: 18 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "patrol" },
    { x: 2 * TILE_SIZE, y: 11 * TILE_SIZE, behavior: "losShooter" },
    { x: 37 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losShooter" },
    { x: 35 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losShooter" },
    { x: 33 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losShooter" },
    { x: 37 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 35 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 33 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 37 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losShooter" },
    { x: 33 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losShooter" },
    { x: 37 * TILE_SIZE, y: 17 * TILE_SIZE, behavior: "losShooter" },
    { x: 33 * TILE_SIZE, y: 17 * TILE_SIZE, behavior: "losShooter" },

    { x: 4 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "patrol" }, // First Enemy

    { x: 17 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 15 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 12 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 3 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 17 * TILE_SIZE, behavior: "losShooter" },
    { x: 13 * TILE_SIZE, y: 17 * TILE_SIZE, behavior: "losShooter" },
    { x: 2 * TILE_SIZE, y: 17 * TILE_SIZE, behavior: "losShooter" },
    { x: 1 * TILE_SIZE, y: 22 * TILE_SIZE, behavior: "losShooter" },
    { x: 1 * TILE_SIZE, y: 26 * TILE_SIZE, behavior: "losShooter" },
    { x: 5 * TILE_SIZE, y: 26 * TILE_SIZE, behavior: "losShooter" },
    { x: 4 * TILE_SIZE, y: 30 * TILE_SIZE, behavior: "losShooter" },
    { x: 4 * TILE_SIZE, y: 30 * TILE_SIZE, behavior: "losShooter" },
    { x: 6 * TILE_SIZE, y: 30 * TILE_SIZE, behavior: "losShooter" },
    { x: 8 * TILE_SIZE, y: 30 * TILE_SIZE, behavior: "losShooter" },
    { x: 11 * TILE_SIZE, y: 30 * TILE_SIZE, behavior: "losShooter" },
    { x: 9 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losShooter" },
  
    { x: 60 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 58 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 56 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 64 * TILE_SIZE, y: 22 * TILE_SIZE, behavior: "losShooter" },
    { x: 64 * TILE_SIZE, y: 24 * TILE_SIZE, behavior: "losShooter" },
    { x: 63 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losPatrol" },
    { x: 66 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losPatrol" },
    { x: 59 * TILE_SIZE, y: 24 * TILE_SIZE, behavior: "losPatrol" },
    { x: 57 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losPatrol" },
    { x: 68 * TILE_SIZE, y: 29 * TILE_SIZE, behavior: "losPatrol" },
  
    { x: 67 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "losShooter" },
    { x: 68 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 67 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 68 * TILE_SIZE, y: 4 * TILE_SIZE, behavior: "losShooter" },
    { x: 66 * TILE_SIZE, y: 4 * TILE_SIZE, behavior: "losShooter" },
    { x: 68 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losPatrol" },
    { x: 60 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losPatrol" },
    { x: 57 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losPatrol" },
    { x: 60 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losShooter" },
    { x: 60 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "losShooter" },
    { x: 63 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "patrol" },
    { x: 44 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "losShooter" },
    { x: 49 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losShooter" },
    { x: 44 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losShooter" },

    { x: 23 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "losPatrol" },
    { x: 28 * TILE_SIZE, y: 1 * TILE_SIZE, behavior: "losPatrol" },
    { x: 24 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losPatrol" },
    { x: 26 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losPatrol" },
    { x: 21 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losPatrol" },
   
    { x: 42 * TILE_SIZE, y: 6 * TILE_SIZE, behavior: "losShooter" },
    { x: 37 * TILE_SIZE, y: 6 * TILE_SIZE, behavior: "losPatrol" },

    { x: 37 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losPatrol" },
    { x: 36 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losPatrol" },
    { x: 30 * TILE_SIZE, y: 27 * TILE_SIZE, behavior: "losPatrol" },
    { x: 33 * TILE_SIZE, y: 26 * TILE_SIZE, behavior: "losPatrol" },
    { x: 27 * TILE_SIZE, y: 24 * TILE_SIZE, behavior: "losPatrol" },
    { x: 38 * TILE_SIZE, y: 23 * TILE_SIZE, behavior: "losPatrol" },
    { x: 26 * TILE_SIZE, y: 28 * TILE_SIZE, behavior: "losPatrol" },

    { x: 34 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losPatrol" },
    { x: 22 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losPatrol" },
    { x: 26 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losPatrol" },

    { x: 44 * TILE_SIZE, y: 14 * TILE_SIZE, behavior: "losPatrol" },
    { x: 44 * TILE_SIZE, y: 10 * TILE_SIZE, behavior: "losPatrol" },
    { x: 44 * TILE_SIZE, y: 12 * TILE_SIZE, behavior: "losPatrol" },
    { x: 42 * TILE_SIZE, y: 15 * TILE_SIZE, behavior: "losPatrol" },
    { x: 42 * TILE_SIZE, y: 19 * TILE_SIZE, behavior: "losPatrol" } */

    //{ x: 1 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "boss" }      
    //{ x: 1 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "shooter" }   
    //{ x: 1 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losPatrol" } 
    //{ x: 1 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "kicker" }    


{ x: 6 * TILE_SIZE, y: 28.5 * TILE_SIZE, behavior: "shooter" },  
{ x: 51 * TILE_SIZE, y: 14 * TILE_SIZE, behavior: "kicker" } ,
{ x: 51 * TILE_SIZE, y: 16 * TILE_SIZE, behavior: "kicker" } ,


{ x: 47 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losPatrol" } , 
{ x: 48 * TILE_SIZE, y: 11 * TILE_SIZE, behavior: "losPatrol" } , 
{ x: 54 * TILE_SIZE, y: 11 * TILE_SIZE, behavior: "losPatrol" } , 
{ x: 52 * TILE_SIZE, y: 11 * TILE_SIZE, behavior: "losPatrol" } , 
{ x: 50 * TILE_SIZE, y: 11 * TILE_SIZE, behavior: "losPatrol" } , 

{ x: 47 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losPatrol" } ,

{ x: 48 * TILE_SIZE, y: 19 * TILE_SIZE, behavior: "losPatrol" } ,
{ x: 50 * TILE_SIZE, y: 19 * TILE_SIZE, behavior: "losPatrol" } ,
{ x: 52 * TILE_SIZE, y: 19 * TILE_SIZE, behavior: "losPatrol" } ,
{ x: 54 * TILE_SIZE, y: 19 * TILE_SIZE, behavior: "losPatrol" } ,


{ x: 5 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "shotShooter" , dialog: "σ(Sigma): Out of shells... you got me." }



  ],
  items: [



    /*
    { x: 4 * TILE_SIZE, y: 5 * TILE_SIZE, type: "health" },
    { x: 8 * TILE_SIZE, y: 2 * TILE_SIZE, type: "ammo" },
    { x: 16 * TILE_SIZE, y: 17 * TILE_SIZE, type: "health" },
    { x: 28 * TILE_SIZE, y: 14 * TILE_SIZE, type: "health" },
    { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, type: "ammo" },
    { x: 16 * TILE_SIZE, y: 17 * TILE_SIZE, type: "ammo" },
    { x: 36 * TILE_SIZE, y: 15 * TILE_SIZE, type: "ammo" },
    { x: 4 * TILE_SIZE, y: 2 * TILE_SIZE, type: "ammo" },
    { x: 1 * TILE_SIZE, y: 28 * TILE_SIZE, type: "health" },
    { x: 2 * TILE_SIZE, y: 28 * TILE_SIZE, type: "ammo" },
    { x: 14 * TILE_SIZE, y: 10 * TILE_SIZE, type: "key" },
    { x: 6 * TILE_SIZE, y: 15 * TILE_SIZE, type: "health" },
    { x: 32 * TILE_SIZE, y: 7 * TILE_SIZE, type: "health" },
    { x: 50 * TILE_SIZE, y: 15 * TILE_SIZE, type: "ammo" },
    { x: 56 * TILE_SIZE, y: 12 * TILE_SIZE, type: "ammo" },
    { x: 44 * TILE_SIZE, y: 12 * TILE_SIZE, type: "health" },
    { x: 42 * TILE_SIZE, y: 11 * TILE_SIZE, type: "ammo" }
    */
     { x: 11 * TILE_SIZE, y: 30 * TILE_SIZE, type: "ammo" },
     { x: 11 * TILE_SIZE, y: 27 * TILE_SIZE, type: "health" },
    // since oracle character added this is not needed anymore { x: 30 * TILE_SIZE, y: 5 * TILE_SIZE, type: "scroll" },
     { x: 18 * TILE_SIZE, y: 3 * TILE_SIZE, type: "vest" },
     { x: 31 * TILE_SIZE, y: 18 * TILE_SIZE, type: "key" },
  ]
};

const level2 = {
  useLighting: false,
  playerStart: { x: 2 * TILE_SIZE, y: 27 * TILE_SIZE },
  
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  civilians: [
    { x: 6 * TILE_SIZE, y: 3 * TILE_SIZE, text: "You made it this far?", gender: "male" }
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
  useLighting: true,
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  // Dark facility — tile 12 = light source (destroyable lantern)
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,3,0,0,0,0,1,0,0,12,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,12,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,12,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,0,12,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  civilians: [
    { x: 30 * TILE_SIZE, y: 4 * TILE_SIZE, text: "It's pitch black in here... shoot the lanterns to create shadows you can hide in.", gender: "male" }
  ],
  enemies: [
    { x: 15 * TILE_SIZE, y: 2 * TILE_SIZE, behavior: "losPatrol" },
    { x: 28 * TILE_SIZE, y: 5 * TILE_SIZE, behavior: "losShooter" },
    { x: 6  * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "patrol" },
    { x: 20 * TILE_SIZE, y: 9 * TILE_SIZE, behavior: "losShooter" },
    { x: 33 * TILE_SIZE, y: 8 * TILE_SIZE, behavior: "losPatrol" },
    { x: 10 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losShooter" },
    { x: 25 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losPatrol" },
    { x: 36 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losShooter" }
  ],
  items: [
    { x: 4  * TILE_SIZE, y: 2 * TILE_SIZE, type: "health" },
    { x: 17 * TILE_SIZE, y: 9 * TILE_SIZE, type: "ammo" },
    { x: 32 * TILE_SIZE, y: 13 * TILE_SIZE, type: "health" }
  ]
};

const level4 = {
  useLighting: false,
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  // Urban compound — multiple interconnected rooms, breakable walls, shotgunners
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,5,0,0,0,0,1,0,0,0,5,0,0,0,0,0,1,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,6,0,0,0,0,0,6,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,7,0,0,0,7,0,0,0,7,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,5,0,0,0,5,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  civilians: [
    { x: 38 * TILE_SIZE, y: 2 * TILE_SIZE, text: "There's a room sealed by breakable walls up ahead. Shoot through them!", gender: "male" },
    { x: 4  * TILE_SIZE, y: 19 * TILE_SIZE, text: "I heard the exit is guarded by the shotgunner. Be careful!", gender: "female" }
  ],
  enemies: [
    { x: 6  * TILE_SIZE, y: 2  * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 2  * TILE_SIZE, behavior: "losShooter" },
    { x: 25 * TILE_SIZE, y: 4  * TILE_SIZE, behavior: "patrol" },
    { x: 5  * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losPatrol" },
    { x: 15 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losPatrol" },
    { x: 40 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losShooter" },
    { x: 8  * TILE_SIZE, y: 14 * TILE_SIZE, behavior: "losShooter" },
    { x: 20 * TILE_SIZE, y: 14 * TILE_SIZE, behavior: "patrol" },
    { x: 45 * TILE_SIZE, y: 14 * TILE_SIZE, behavior: "shotShooter" },
    { x: 10 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losPatrol" },
    { x: 25 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" },
    { x: 38 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "kicker" },
    { x: 44 * TILE_SIZE, y: 20 * TILE_SIZE, behavior: "losShooter" }
  ],
  items: [
    { x: 2  * TILE_SIZE, y: 19 * TILE_SIZE, type: "health" },
    { x: 12 * TILE_SIZE, y: 19 * TILE_SIZE, type: "ammo" },
    { x: 35 * TILE_SIZE, y: 8  * TILE_SIZE, type: "ammo" },
    { x: 47 * TILE_SIZE, y: 14 * TILE_SIZE, type: "health" }
  ]
};

const level5 = {
  useLighting: false,
  playerStart: { x: 2 * TILE_SIZE, y: 2 * TILE_SIZE },
  // Final stronghold — dense rooms, boss, goal tile
  map: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,4,1,0,0,0,5,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,6,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,7,0,0,0,7,0,0,0,7,0,0,0,7,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,5,0,0,5,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  civilians: [
    { x: 42 * TILE_SIZE, y: 2  * TILE_SIZE, text: "He's in the deepest room. Don't let your guard down.", gender: "male" },
    { x: 5  * TILE_SIZE, y: 18 * TILE_SIZE, text: "χ(Chi): I didn't come this far to fail now.", gender: "female" }
  ],
  enemies: [
    { x: 5  * TILE_SIZE, y: 2  * TILE_SIZE, behavior: "losShooter" },
    { x: 14 * TILE_SIZE, y: 2  * TILE_SIZE, behavior: "losShooter" },
    { x: 24 * TILE_SIZE, y: 3  * TILE_SIZE, behavior: "patrol" },
    { x: 36 * TILE_SIZE, y: 2  * TILE_SIZE, behavior: "losShooter" },
    { x: 6  * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losPatrol" },
    { x: 16 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losPatrol" },
    { x: 28 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losShooter" },
    { x: 40 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "shotShooter" },
    { x: 50 * TILE_SIZE, y: 8  * TILE_SIZE, behavior: "losShooter" },
    { x: 5  * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "kicker" },
    { x: 15 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losShooter" },
    { x: 27 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "losPatrol" },
    { x: 38 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "shotShooter" },
    { x: 50 * TILE_SIZE, y: 13 * TILE_SIZE, behavior: "kicker" },
    { x: 8  * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 20 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losPatrol" },
    { x: 32 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "losShooter" },
    { x: 45 * TILE_SIZE, y: 18 * TILE_SIZE, behavior: "boss" }
  ],
  items: [
    { x: 2  * TILE_SIZE, y: 7  * TILE_SIZE, type: "health" },
    { x: 2  * TILE_SIZE, y: 12 * TILE_SIZE, type: "ammo" },
    { x: 30 * TILE_SIZE, y: 7  * TILE_SIZE, type: "health" },
    { x: 30 * TILE_SIZE, y: 18 * TILE_SIZE, type: "ammo" },
    { x: 50 * TILE_SIZE, y: 18 * TILE_SIZE, type: "health" },
    { x: 42 * TILE_SIZE, y: 18 * TILE_SIZE, type: "vest" }
  ]
};

const levels = [level1, level2, level3, level4, level5];

function loadLevel(index) {
  currentLevelIndex = index;
  const lvl = levels[index];
  tilemap = lvl.map.map(row => row.slice());
  levelUsesLighting = lvl.useLighting || false;
  breakableState = {};
  bullets = [];

  player = player || createPlayer(lvl.playerStart.x, lvl.playerStart.y);
  player.x = lvl.playerStart.x;
  player.y = lvl.playerStart.y;

  enemies = lvl.enemies.map(e => createEnemy(e.x, e.y, e.behavior, e));
  civilians = lvl.civilians.map(c =>
    createCivilian(c.x, c.y, c.text, c.gender)
  );
  oracles = (lvl.oracles || []).map(o => createOracle(o.x, o.y));
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
    tile === TILE_FURNITURE3 ||
    tile === TILE_FURNITURE4 ||
    tile === TILE_SECRET_DOOR ||
    tile === TILE_PASSDOOR ||
    tile === TILE_LIGHT
  );
}

function isWaterTile(px, py) {
  return tileAtPixel(px, py) === TILE_WATER;
}

function entityInWater(e) {
  return isWaterTile(e.x + e.w / 2, e.y + e.h / 2);
}

function blocksBullets(tile) {
  return (
    tile === TILE_WALL ||
    tile === TILE_BREAKABLE ||
    tile === TILE_DOOR
  );
}

function damagePlayer(amount) {
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  if (amount > 0) {
    player.health -= amount;
    if (player.health < 0) player.health = 0;
  }
  updateHUD();
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

function isTouchingPlayer(entity) {
  // Small padding so the player must be directly adjacent/overlapping, not just nearby
  const pad = 1.5;
  const a = { x: player.x - pad, y: player.y - pad, w: player.w + pad * 2, h: player.h + pad * 2 };
  return rectsOverlap(a, entity);
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

let passDoorPromptCooldown = 0;

// Returns true if movement was blocked by a password door prompt
function checkPasswordDoor(mdx, mdy) {
  if (passDoorPromptCooldown > 0) return false;
  if (!mdx && !mdy) return false;

  // Check tile in the direction the player is trying to move
  const cx = player.x + player.w / 2 + (mdx > 0 ? player.w / 2 + 2 : mdx < 0 ? -player.w / 2 - 2 : 0);
  const cy = player.y + player.h / 2 + (mdy > 0 ? player.h / 2 + 2 : mdy < 0 ? -player.h / 2 - 2 : 0);
  const tile = tileAtPixel(cx, cy);
  if (tile !== TILE_PASSDOOR) return false;

  passDoorPromptCooldown = 2;
  const answer = prompt("LOCKED TERMINAL — Enter access code:");
  // Reset lastTime so the paused prompt time doesn't cause a dt spike
  lastTime = 0;
  // Clear held keys so player doesn't lurch after dismissing
  for (const k in keys) keys[k] = false;
  if (answer !== null && secretCode && answer.trim() === secretCode) {
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);
    setTile(tx, ty, TILE_FLOOR);
    setMessage("Access granted.", 2000);
  } else {
    setMessage("Wrong code. Access denied.", 2000);
  }
  return true;
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
    player.facingX = dx / len;
    player.facingY = dy / len;
    const inWater = entityInWater(player);
    const speedMult = inWater ? 0.4 : 1;
    dx = (dx / len) * player.speed * speedMult * dt;
    dy = (dy / len) * player.speed * speedMult * dt;
  }

  // Block movement into password door and show prompt instead
  if (checkPasswordDoor(dx, dy)) return;
  moveWithCollision(player, dx, dy);

  // Breath mechanic
  if (entityInWater(player)) {
    player.breath -= dt;
    if (player.breath <= 0) {
      player.breath = 0;
      triggerGameOver("You drowned!");
    }
    updateHUD();
  } else if (player.breath < 8) {
    player.breath = 8;
    updateHUD();
  }

  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (keys["j"] && player.shootCooldown <= 0 && player.bullets > 0 && !entityInWater(player)) {
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

  // Melee (allowed in water)
  if (keys["k"] && player.meleeTimer <= 0) {
    player.meleeTimer = 0.15;
    player.meleeSeed = Math.random() * 100000;
  }
  if (player.meleeTimer > 0) {
    player.meleeTimer -= dt;
  }

  // Parry — allowed in water if scroll acquired
  if (player.hasMelee && keys["l"] && player.parryTimer <= 0) {
    player.parryTimer = 0.15;
    player.parrySeed = Math.random() * 100000;
  }
  if (player.parryTimer > 0) {
    player.parryTimer -= dt;
  }

  // Talk (E)
  if (player.talkCooldown > 0) player.talkCooldown -= dt;
  if (keys["e"] && player.talkCooldown <= 0) {
    player.talkCooldown = 0.4;
    talkToCivilian();
  }
}

function talkToCivilian() {
  // Talk to civilians
  for (const c of civilians) {
    if (!c.alive) continue;
    if (isTouchingPlayer(c)) {
      c.talkTimer = 1.5;
      setMessage(c.dialog);
      break;
    }
  }
  // Talk to oracles
  for (const o of oracles) {
    if (!o.alive) continue;
    if (o.answered) continue;
    if (isTouchingPlayer(o)) {
      o.talkTimer = 1.5;
      setMessage("??? : ζ(Zeta): I do not fight unless I have to. All I seek is wisdom. I am standing near death.", 3000);
      // Defer prompt slightly so message renders first
      setTimeout(() => {
        lastTime = 0;
        for (const k in keys) keys[k] = false;
        const answer = confirm(" ζ(Zeta): I do not fight unless I have to. Yet I am standing near death. All I seek is wisdom.\nWould you give me a part of your life?\n\n(You will lose all of your health.)");
        lastTime = 0;
        for (const k in keys) keys[k] = false;
        o.answered = true;
        if (answer) {
          o.accepted = true;
          player.health = 1;// Math.max(1, Math.floor(player.health / 3));
          updateHUD();
          // Spawn a scroll at the oracle's feet
          items.push(createItem(o.x + 5 * TILE_SIZE, o.y - 5 * TILE_SIZE, "scroll"));
          setMessage("??? : ... Take it.", 3000);
        } else {
          setMessage("??? : I was expecting better than that.", 3000);
        }
      }, 80);
      break;
    }
  }
  // Talk to neutral shooters and neutral boss
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!e.isNeutral) continue;
    if (e.behavior !== "shooter" && e.behavior !== "shotShooter" && e.behavior !== "boss") continue;
    if (isTouchingPlayer(e)) {
      e.talkTimer = 1.5; // similar to civilians
      const defaultMsg =
        e.behavior === "boss"
          ? "α(Alpha): You have bested me... Let us talk."
          : "α(Alpha): I'm out of ammo... Let's talk.";
      setMessage(e.dialog || defaultMsg);
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

function updateOracles(dt) {
  for (const o of oracles) {
    if (!o.alive) continue;
    if (o.talkTimer > 0) o.talkTimer -= dt;
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
      tile === TILE_FURNITURE3 ||
      tile === TILE_FURNITURE4 ||
      tile === TILE_SECRET_DOOR ||
      tile === TILE_WATER
    ) {
      return false;
    }
  }
  return true;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;

    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    let seesPlayer =
      !entityInWater(player) &&
      !entityInWater(e) &&
      hasLineOfSight(ex, ey, px, py) &&
      Math.abs(player.x - e.x) < 200 &&
      Math.abs(player.y - e.y) < 200;

    // --- LOS PATROL (dark red) ---
    if (e.behavior === "losPatrol") {
      if (!e.hasSeenPlayer && seesPlayer) e.hasSeenPlayer = true;
      if (!e.hasSeenPlayer) continue;

      // While ammo > 0: move like patrol AND shoot
      if (e.bullets > 0) {
        // Patrol-like random movement
        e.moveTimer -= dt;
        if (e.moveTimer <= 0) {
          const dir = Math.random() * Math.PI * 2;
          e.vx = Math.cos(dir) * e.speed * 0.6;
          e.vy = Math.sin(dir) * e.speed * 0.6;
          e.moveTimer = 0.6 + Math.random() * 0.8;
        }
        moveWithCollision(e, e.vx * dt, e.vy * dt);

        // Shooting
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0) {
          if (hasLineOfSight(ex, ey, px, py)) {
            const dx = px - ex;
            const dy = py - ey;
            bullets.push(createBullet(ex, ey, dx, dy, "enemy"));
            e.bullets--;
          }
          e.fireCooldown = 0.8 + Math.random() * 0.6;
        }
      } else {
        // After ammo 0 → chase like patrol
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        moveWithCollision(e, (dx / len) * e.speed * dt, (dy / len) * e.speed * dt);

        if (rectsOverlap(e, player)) {
          damagePlayer(30 * dt);
          if (player.health <= 0) triggerGameOver("You are dead...");
        }
      }
      if (e.talkTimer > 0) e.talkTimer -= dt;
      continue;
    }

    // --- KICKER (yellow) ---
    if (e.behavior === "kicker") {
      if (!e.hasSeenPlayer && seesPlayer) e.hasSeenPlayer = true;
      if (!e.hasSeenPlayer) continue;

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const vx = (dx / len) * e.speed * dt;
      const vy = (dy / len) * e.speed * dt;
      moveWithCollision(e, vx, vy);

      if (rectsOverlap(e, player)) {
        damagePlayer(60 * dt);
        if (player.health <= 0) triggerGameOver("You were kicked to death!");
      }
      continue;
    }

    // --- BOSS (black / neutral later) ---
    if (e.behavior === "boss") {
      if (!e.hasSeenPlayer && seesPlayer) e.hasSeenPlayer = true;
      if (!e.hasSeenPlayer) continue;

      // Neutral boss: idle & talkable only
      if (e.isNeutral) {
        if (e.talkTimer > 0) e.talkTimer -= dt;
        continue;
      }

      if (e.bullets > 0) {
        // Move while shooting (similar to losPatrol)
        e.moveTimer -= dt;
        if (e.moveTimer <= 0) {
          const dir = Math.random() * Math.PI * 2;
          e.vx = Math.cos(dir) * e.speed * 0.6;
          e.vy = Math.sin(dir) * e.speed * 0.6;
          e.moveTimer = 0.6 + Math.random() * 0.8;
        }
        moveWithCollision(e, e.vx * dt, e.vy * dt);

        // Shoot while ammo available
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0) {
          if (hasLineOfSight(ex, ey, px, py)) {
            bullets.push(createBullet(ex, ey, px - ex, py - ey, "enemy"));
            e.bullets--;
          }
          e.fireCooldown = 0.7 + Math.random() * 0.3;
        }
      } else {
        // After ammo 0 → aggressively chase
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        moveWithCollision(e, (dx / len) * e.speed * dt, (dy / len) * e.speed * dt);
      }

      if (rectsOverlap(e, player)) {
        player.armor = 0;
        player.health = 0;
        triggerGameOver("The boss has killed you instantly!");
        updateHUD();
      }
      if (e.talkTimer > 0) e.talkTimer -= dt;
      continue;
    }

    // --- SHOT SHOOTER (orange), shotgun scatter, CIVILIAN-LIKE after ammo ---
    if (e.behavior === "shotShooter") {
      if (e.isNeutral) {
        if (e.talkTimer > 0) e.talkTimer -= dt;
        continue;
      }

      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.bullets > 0) {
        if (hasLineOfSight(ex, ey, px, py)) {
          const baseDx = px - ex;
          const baseDy = py - ey;
          const baseAngle = Math.atan2(baseDy, baseDx);
          const pellets = 5;
          const spread = Math.PI / 6;
          for (let i = 0; i < pellets; i++) {
            const angle = baseAngle + (i - (pellets - 1) / 2) * (spread / (pellets - 1));
            bullets.push(createBullet(ex, ey, Math.cos(angle), Math.sin(angle), "enemy"));
          }
          e.bullets -= pellets;
          if (e.bullets < 0) e.bullets = 0;
        }
        e.fireCooldown = 1.2 + Math.random() * 0.6;
      }
      if (e.bullets <= 0) {
        e.isNeutral = true;
        if (!e.dialog) e.dialog = "...";
      }
      continue;
    }

    // --- SHOOTER (purple), CIVILIAN-LIKE after ammo ---
    if (e.behavior === "shooter") {
      if (e.isNeutral) {
        if (e.talkTimer > 0) e.talkTimer -= dt;
        continue;
      }

      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.bullets > 0) {
        if (hasLineOfSight(ex, ey, px, py)) {
          const dx = px - ex;
          const dy = py - ey;
          const b = createBullet(ex, ey, dx, dy, "enemy");
          bullets.push(b);
          e.bullets--;
        }
        e.fireCooldown = 0.2 + Math.random() * 0.1;
      }
      if (e.bullets <= 0) {
        e.isNeutral = true;
        if (!secretCode) {
          secretCode = String(Math.floor(10000 + Math.random() * 90000));
        }
        e.dialog = "η(Eta): Can you really kill me?   χ(Chi): I will if I have to...  η(Eta): I've stopped believing you a long time ago.  χ(Chi):....  η(Eta): You expecting a kiss?  χ(Chi): I'm expecting the code.  η(Eta): It's '" + secretCode + "'.";
      }
      continue;
    }

    // --- DEFAULTS: patrol / losShooter ---
    if (e.state === "shooting" && e.bullets > 0) {
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
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

      if (rectsOverlap(e, player)) {
        damagePlayer(30 * dt);
        if (player.health <= 0) triggerGameOver("You are dead...");
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
      } else if (it.type === "scroll") {
        player.hasMelee = true;
        setMessage("You learned the Parry Technique! Press L to parry incoming projectiles.", 4000);
      } else if (it.type === "vest") {
        player.armor = clamp(player.armor + 200, 0, 200);
        setMessage("Armor vest equipped! +200 armor", 2000);
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

      // Bullets dissolve in water
    if (tileAtPixel(b.x + b.w / 2, b.y + b.h / 2) === TILE_WATER) continue;

    if (blocksBullets(tile)) {
      if (tile === TILE_BREAKABLE) {
        const key = tx + "," + ty;
        if (!breakableState[key]) {
          breakableState[key] = { bulletHits: 0 };
        }
        breakableState[key].bulletHits++;
      }
      continue;
    }

    if (
      (tile === TILE_FURNITURE1 ||
        tile === TILE_FURNITURE2 ||
        tile === TILE_FURNITURE3 ||
        tile === TILE_FURNITURE4 ||
        tile === TILE_SECRET_DOOR ||
        tile === TILE_LIGHT) &&
      b.owner === "player"
    ) {
      setTile(tx, ty, TILE_FLOOR);
    }

    if (b.owner === "player") {
      let hitEnemy = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(b, e)) {
          e.health -= 25;
          if (e.health <= 0) {
            if (e.behavior === "boss") {
              e.health = 0;
              e.isNeutral = true;
              e.dialog = e.dialog || "You’ve defeated me... Let’s talk.";
            } else {
              if (e.isNeutral && (e.behavior === "shooter" || e.behavior === "shotShooter")) {
                player.morality -= 33;
                setMessage("You killed an unarmed enemy!");
                if (player.morality <= 0) {
                  player.morality = 0;
                  triggerGameOver("Your morality reached zero.");
                }
                updateHUD();
              }
              e.alive = false;
            }
          }
          hitEnemy = true;
          break;
        }
      }
      if (hitEnemy) continue;

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
      // Bullets dissolve when entering water
      if (isWaterTile(b.x + b.w / 2, b.y + b.h / 2)) continue;
      if (rectsOverlap(b, player)) {
        if (entityInWater(player)) continue;
        damagePlayer(20);
        if (player.health <= 0) triggerGameOver("You were shot down!");
        continue;
      }
    }

    newBullets.push(b);
  }
  bullets = newBullets;
}

function inMeleeArc(cx, cy, tx, ty) {
  const radius = 18;
  const halfArc = Math.PI / 8; // 22.5 degrees each side = 45 degree arc (1/8 circle)
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.hypot(dx, dy);
  if (dist >= radius) return false;
  // Facing angle from facingX/facingY (default right if never moved)
  const fx = (player.facingX === 0 && player.facingY === 0) ? 1 : player.facingX;
  const fy = (player.facingX === 0 && player.facingY === 0) ? 0 : player.facingY;
  const facingAngle = Math.atan2(fy, fx);
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - facingAngle;
  // Normalize diff to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfArc;
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
    if (inMeleeArc(cx, cy, e.x + e.w / 2, e.y + e.h / 2)) {
      e.health -= 30;
      if (e.health <= 0) {
        if (e.behavior === "boss") {
          e.health = 0;
          e.isNeutral = true;
          e.dialog = e.dialog || "You’ve defeated me... Let’s talk.";
        } else {
          if (e.isNeutral && (e.behavior === "shooter" || e.behavior === "shotShooter")) {
            player.morality -= 33;
            setMessage("You killed an unarmed enemy!");
            if (player.morality <= 0) {
              player.morality = 0;
              triggerGameOver("Your morality reached zero.");
            }
            updateHUD();
          }
          e.alive = false;
        }
      }
    }
  }

  // Damage civilians
  for (const c of civilians) {
    if (!c.alive) continue;
    if (inMeleeArc(cx, cy, c.x + c.w / 2, c.y + c.h / 2)) {
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

  // Environment interactions — only in the facing direction
  const fx = (player.facingX === 0 && player.facingY === 0) ? 1 : player.facingX;
  const fy = (player.facingX === 0 && player.facingY === 0) ? 0 : player.facingY;
  const tilesToCheck = [
    { x: cx, y: cy },
    { x: cx + fx * radius, y: cy + fy * radius }
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
      if (state.bulletHits >= 5) {
        setTile(tx, ty, TILE_FLOOR);
        delete breakableState[key];
      }
    } else if (
      tile === TILE_FURNITURE1 ||
      tile === TILE_FURNITURE2 ||
      tile === TILE_FURNITURE3 ||
      tile === TILE_FURNITURE4 ||
      tile === TILE_SECRET_DOOR ||
      tile === TILE_LIGHT
    ) {
      setTile(tx, ty, TILE_FLOOR);
    }
  }
}

function updateParry(dt) {
  if (!player) return;
  if (player.parryTimer <= 0) return;

  const radius = 18;
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const fx = (player.facingX === 0 && player.facingY === 0) ? 1 : player.facingX;
  const fy = (player.facingX === 0 && player.facingY === 0) ? 0 : player.facingY;
  const facingAngle = Math.atan2(fy, fx);
  const halfArc = Math.PI / 8;

  // Deflect angle: 33 degrees converted to radians, sideways-backward
  const deflect = 33 * (Math.PI / 180);

  for (const b of bullets) {
    if (b.owner !== "enemy") continue;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const ddx = bx - cx;
    const ddy = by - cy;
    const dist = Math.hypot(ddx, ddy);
    if (dist >= radius) continue;

    // Check if bullet is within the parry arc
    const bulletAngle = Math.atan2(ddy, ddx);
    let diff = bulletAngle - facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > halfArc) continue;

    // Deflect: bullet coming from front gets split sideways-backward
    // Determine which side (left vs right) based on bullet's lateral offset
    const perpAngle = facingAngle + Math.PI / 2; // left perpendicular
    const lateralDot = ddx * Math.cos(perpAngle) + ddy * Math.sin(perpAngle);
    // Deflect to the side the bullet is closer to, angled 33° backward from perpendicular
    const side = lateralDot >= 0 ? 1 : -1;
    const newAngle = facingAngle + side * (Math.PI / 2 + deflect);
    b.dx = Math.cos(newAngle);
    b.dy = Math.sin(newAngle);
    b.owner = "player"; // deflected bullets can now harm enemies
  }
}

function checkDoorAndGoal() {
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  const tile = tileAtPixel(px, py);

  if (tile === TILE_DOOR) {
    if (currentLevelIndex === 0) {
      if (player.hasKey) {
        if (currentLevelIndex + 1 < levels.length) {
          loadLevel(currentLevelIndex + 1);
        }
      } else {
        setMessage("Door is locked.");
      }
    } else {
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
  const breathStr = entityInWater(player)
    ? " | 🫧 " + Math.ceil(player.breath) + "s"
    : "";
  statsDiv.textContent =
    "Health: " +
    Math.round(player.health) +
    (player.armor > 0 ? " | Armor: " + Math.round(player.armor) : "") +
    " | Morality: " +
    Math.round(player.morality) +
    " | Ammo: " +
    player.bullets +
    (player.hasMelee ? " | ⚔ Parry" : "") +
    breathStr +
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
      color = "#aa6644";
    }
  } else if (t === TILE_DOOR) color = "#00aa00";
  else if (t === TILE_GOAL) color = "#e0c040";
  else if (t === TILE_FURNITURE1) color = "#aa7744";
  else if (t === TILE_FURNITURE2) color = "#6a346a";
  else if (t === TILE_FURNITURE3) color = "#6688aa";
  else if (t === TILE_FURNITURE4) color = "#3f5a26";
  else if (t === TILE_SECRET_DOOR) color = "#555";
  else if (t === TILE_PASSDOOR) color = "#8B0000";
  else if (t === TILE_WATER) color = "#1a4fa0";
  else if (t === TILE_LIGHT) color = "#2a2010";

  ctx.fillStyle = color;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  if (t === TILE_WALL || t === TILE_SECRET_DOOR) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.clip();

    // Pseudo-random seed from tile position for deterministic noise
    const seed = (x * 7 + y * 13) & 0xffff;
    const rng = (n) => ((seed * 1664525 + n * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;

    // Subtle aggregate speckles
    for (let i = 0; i < 6; i++) {
      const sx = x + rng(i * 3)     * TILE_SIZE;
      const sy = y + rng(i * 3 + 1) * TILE_SIZE;
      const sr = 0.5 + rng(i * 3 + 2) * 1.2;
      const bright = rng(i) > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = bright;
      ctx.fill();
    }

    // Mortar lines — horizontal block seam every 8px, offset every other column
    const colEven = Math.floor(x / TILE_SIZE) % 2 === 0;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 0.75;
    // Horizontal seam
    const seamY = y + (colEven ? 5 : 10);
    ctx.beginPath();
    ctx.moveTo(x, seamY);
    ctx.lineTo(x + TILE_SIZE, seamY);
    ctx.stroke();
    // Vertical half-seam (brick offset)
    const seamX = x + (colEven ? TILE_SIZE / 2 : TILE_SIZE / 4);
    ctx.beginPath();
    ctx.moveTo(seamX, y);
    ctx.lineTo(seamX, seamY);
    ctx.stroke();

    // Edge highlight (top/left) and shadow (bottom/right) for depth
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + TILE_SIZE);
    ctx.lineTo(x, y);
    ctx.lineTo(x + TILE_SIZE, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE, y);
    ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
    ctx.lineTo(x, y + TILE_SIZE);
    ctx.stroke();

    ctx.restore();
  }

  if (t === TILE_WATER) {
    // Animated wavy lines
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.clip();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.55)";
    ctx.lineWidth = 1;
    const waveRows = 3;
    for (let r = 0; r < waveRows; r++) {
      const wy = y + 3 + r * 5;
      const phase = waveTime * 2.5 + x * 0.4 + r * 1.2;
      ctx.beginPath();
      for (let wx = x; wx <= x + TILE_SIZE; wx += 2) {
        const sy2 = wy + Math.sin((wx - x) * 0.8 + phase) * 1.5;
        if (wx === x) ctx.moveTo(wx, sy2);
        else ctx.lineTo(wx, sy2);
      }
      ctx.stroke();
    }
    // Subtle shimmer overlay
    const shimmer = 0.08 + 0.06 * Math.sin(waveTime * 3 + x * 0.3 + y * 0.3);
    ctx.fillStyle = `rgba(140, 210, 255, ${shimmer})`;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  if (t === TILE_BREAKABLE) {
    const tx = x / TILE_SIZE;
    const ty = y / TILE_SIZE;
    const key = tx + "," + ty;
    const state = breakableState[key];
    const damaged = state && state.bulletHits >= 5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.clip();

    // Wood grain lines — horizontal planks
    const grainColor = damaged ? "#7a4422" : "#6b3318";
    const grainLight = damaged ? "#c08855" : "#a05c30";
    ctx.strokeStyle = grainColor;
    ctx.lineWidth = 1;
    // Three horizontal plank lines
    for (let i = 1; i <= 3; i++) {
      const gy = y + Math.floor(TILE_SIZE * i / 4);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + TILE_SIZE, gy);
      ctx.stroke();
    }
    // Subtle vertical grain streaks
    ctx.strokeStyle = grainLight;
    ctx.lineWidth = 0.5;
    const grainOffsets = [2, 5, 9, 13];
    for (const gx of grainOffsets) {
      ctx.beginPath();
      ctx.moveTo(x + gx, y);
      ctx.lineTo(x + gx + 1, y + TILE_SIZE);
      ctx.stroke();
    }
    // Knot
    ctx.strokeStyle = grainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 6, 2, 1.5, 0.3, 0, Math.PI * 2);
    ctx.stroke();

    if (damaged) {
      // Crack lines when ready to break
      ctx.strokeStyle = "#1a0800";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + 7, y + 9);
      ctx.lineTo(x + 5, y + TILE_SIZE - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + TILE_SIZE - 3, y + 3);
      ctx.lineTo(x + TILE_SIZE - 6, y + 8);
      ctx.stroke();
    }

    ctx.restore();
  }
  if (t === TILE_FURNITURE4) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.clip();

    // Pseudo-random seed from tile position for deterministic camo pattern
    const seed = (x * 11 + y * 17) & 0xffff;
    const rng = (n) => ((seed * 1664525 + n * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;
    const camoColors = ["#3d5c22", "#2d4a1a", "#5a7a36", "#22331a"];

    // Irregular camo blotches, each built from a few overlapping ellipses
    for (let i = 0; i < 6; i++) {
      const bx = x + rng(i * 13) * TILE_SIZE;
      const by = y + rng(i * 13 + 1) * TILE_SIZE;
      const baseR = 2.5 + rng(i * 13 + 2) * 2.5;
      const angle = rng(i * 13 + 3) * Math.PI;
      ctx.fillStyle = camoColors[Math.floor(rng(i * 13 + 4) * camoColors.length)];
      for (let j = 0; j < 3; j++) {
        const jx = bx + (rng(i * 13 + j * 3 + 5) - 0.5) * baseR;
        const jy = by + (rng(i * 13 + j * 3 + 6) - 0.5) * baseR;
        const rx = baseR * (0.6 + rng(i * 13 + j * 3 + 7) * 0.5);
        const ry = rx * (0.5 + rng(i * 13 + j * 3 + 8) * 0.4);
        ctx.beginPath();
        ctx.ellipse(jx, jy, rx, ry, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fine speckle for texture noise
    for (let i = 0; i < 25; i++) {
      const px = x + rng(i * 6 + 100) * TILE_SIZE;
      const py = y + rng(i * 6 + 101) * TILE_SIZE;
      ctx.fillStyle = rng(i * 6 + 102) > 0.5 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(px, py, 0.7, 0.7);
    }

    ctx.restore();
  }
  if (t === TILE_PASSDOOR) {
    ctx.strokeStyle = "#ff4444";
    ctx.font = "7px monospace";
    ctx.fillStyle = "#ffaaaa";
    ctx.fillText("🔒", x + 3, y + TILE_SIZE - 5);
  }
  if (t === TILE_LIGHT) {
    // Lantern body
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const flicker = 0.7 + 0.3 * Math.sin(waveTime * 8 + cx * 0.3 + cy * 0.3);
    // Outer glow halo on tile
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_SIZE * 0.7);
    grad.addColorStop(0, `rgba(255, 220, 80, ${0.8 * flicker})`);
    grad.addColorStop(0.4, `rgba(255, 140, 20, ${0.4 * flicker})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    // Lantern icon dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 245, 180, ${flicker})`;
    ctx.fill();
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

    if (isWaterTile(it.x + it.w / 2, it.y + it.h / 2)) {
      ctx.save();
      ctx.filter = "blur(1.5px)";
      ctx.fillStyle = "rgba(0,20,60,0.82)";
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.restore();
      continue;
    }

    if (it.type === "health") ctx.fillStyle = "#55ff5500";
    else if (it.type === "ammo") ctx.fillStyle = "#ffff5500";
    else if (it.type === "key") ctx.fillStyle = "#b4000000";
    else if (it.type === "scroll") ctx.fillStyle = "rgba(180, 140, 60, 0.5)";
    else if (it.type === "vest") ctx.fillStyle = "rgba(80, 160, 80, 0.6)";
    ctx.fillRect(it.x, it.y, it.w, it.h);

    ctx.fillStyle = "#000000";
    ctx.font = "8px monospace";
    if (it.type === "health") {
      ctx.fillText("➕", it.x + 2, it.y + it.h - 2);
    } else if (it.type === "ammo") {
      ctx.fillText("💥", it.x + 3, it.y + it.h - 2);
    } else if (it.type === "key") {
      ctx.fillText("🔑", it.x, it.y + it.h - 2);
    } else if (it.type === "scroll") {
      ctx.fillStyle = "#ffe090";
      ctx.fillText("📜", it.x, it.y + it.h - 2);
    } else if (it.type === "vest") {
      ctx.fillStyle = "#ffffff";
      ctx.fillText("🦺", it.x, it.y + it.h - 2);
    }
  }

  // Civilians
  for (const c of civilians) {
    if (!c.alive) continue;
    if (entityInWater(c)) {
      ctx.save();
      ctx.filter = "blur(1.5px)";
      ctx.fillStyle = "rgba(0,20,60,0.82)";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.restore();
    } else {
      ctx.fillStyle = c.gender === "female" ? "#ff9aee" : "#97a7cc";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      if (c.talkTimer > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "6px monospace";
        ctx.fillText("!!!", c.x - 2, c.y - 4);
      }
    }
  }

  // Oracles
  for (const o of oracles) {
    if (!o.alive) continue;
    const pulse = 0.7 + 0.3 * Math.sin(waveTime * 4);
    ctx.fillStyle = `rgba(255, 230, 0, ${pulse})`;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#000";
    ctx.font = "8px monospace";
    ctx.fillText("ζ", o.x + 3, o.y + o.h - 3);
    if (!o.answered) {
      ctx.fillStyle = "#fffb00";
      ctx.font = "6px monospace";
      ctx.fillText("", o.x + 0, o.y - 3);
    }
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;

    if (entityInWater(e)) {
      ctx.save();
      ctx.filter = "blur(1.5px)";
      ctx.fillStyle = "rgba(0,20,60,0.82)";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.restore();
    } else {
      let color = "#c71a1a";
      if (e.behavior === "patrol") color = "#ff2222";
      else if (e.behavior === "losPatrol") color = "#800000";
      else if (e.behavior === "kicker") color = "#ffe258";
      else if (e.behavior === "boss") color = e.isNeutral ? "#6d6d6d" : "#b2b2b2";
      else if (e.behavior === "shooter") color = e.isNeutral ? "#834b83" : "#800080";
      else if (e.behavior === "shotShooter") color = e.isNeutral ? "#c47a00" : "#ff8c00";

      ctx.fillStyle = color;
      ctx.fillRect(e.x, e.y, e.w, e.h);

      if (e.behavior === "boss")
        ctx.fillStyle = "#ff0000";
      ctx.font = "8px monospace";
      ctx.fillText("α", e.x + 4, e.y + e.h - 4.5);

      if (e.behavior === "shooter")
        ctx.fillStyle = "#dbcc00";
      ctx.font = "8px monospace";
      ctx.fillText("η", e.x + 4, e.y + e.h - 4.5);

      if (e.behavior === "shotShooter")
        ctx.fillStyle = "#000000";
      ctx.font = "8px monospace";
      ctx.fillText("σ", e.x + 4, e.y + e.h - 4.5);

      if (e.talkTimer > 0 && e.isNeutral && (e.behavior === "shooter" || e.behavior === "shotShooter" || e.behavior === "boss")) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "6px monospace";
        ctx.fillText("!!!", e.x - 2, e.y - 4);
      }
    }
  }

  // Player
  if (player) {
    if (entityInWater(player)) {
      ctx.save();
      ctx.filter = "blur(1.5px)";
      ctx.fillStyle = "rgba(0,20,60,0.82)";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#436fff";
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = player.hasMelee ? "#ffd700" : "#000000";
      ctx.font = "8px monospace";
      ctx.fillText("χ", player.x + 4, player.y + player.h - 5);

    if (player.hasMelee) {
      const c = 3;
      const x = player.x, y = player.y, w = player.w, h = player.h;
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
      ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
      ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
      ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    }

    if (player.meleeTimer > 0 || player.parryTimer > 0) {
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const fx = (player.facingX === 0 && player.facingY === 0) ? 1 : player.facingX;
      const fy = (player.facingX === 0 && player.facingY === 0) ? 0 : player.facingY;
      const facingAngle = Math.atan2(fy, fx);
      const halfArc = Math.PI / 8;
      if (player.meleeTimer > 0) {
        const seed = player.meleeSeed || 0;
        const rng = (n) => ((seed * 1664525 + n * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;
        const progress = Math.max(0, Math.min(1, player.meleeTimer / 0.15));
        const yellowShades = ["#fff35c", "#ffe066", "#ffd700", "#ffb300"];
        const strikeCount = 4;
        for (let i = 0; i < strikeCount; i++) {
          const angle = facingAngle + (rng(i * 3) - 0.5) * halfArc * 2.2;
          const dist = 6 + rng(i * 3 + 1) * 7;
          const len = 5 + rng(i * 3 + 2) * 7;
          const mx = cx + Math.cos(angle) * dist;
          const my = cy + Math.sin(angle) * dist;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const nearX = mx - dx * len / 2, nearY = my - dy * len / 2;
          const farX = mx + dx * len / 2, farY = my + dy * len / 2;
          const px = -dy, py = dx;
          const thin = 0.4, thick = 1.8;
          ctx.fillStyle = yellowShades[i % yellowShades.length];
          ctx.globalAlpha = 0.5 + 0.5 * progress;
          ctx.beginPath();
          ctx.moveTo(nearX - px * thin, nearY - py * thin);
          ctx.lineTo(nearX + px * thin, nearY + py * thin);
          ctx.lineTo(farX + px * thick, farY + py * thick);
          ctx.lineTo(farX - px * thick, farY - py * thick);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (player.parryTimer > 0) {
        const seed = player.parrySeed || 0;
        const rng = (n) => ((seed * 1664525 + n * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;
        const progress = Math.max(0, Math.min(1, player.parryTimer / 0.15));
        const blueShades = ["#8fd6f0", "#5cb8e0", "#479ab5", "#2f7a94"];
        const strikeCount = 4;
        for (let i = 0; i < strikeCount; i++) {
          const angle = facingAngle + (rng(i * 3) - 0.5) * halfArc * 2.2;
          const dist = 6 + rng(i * 3 + 1) * 7;
          const len = 5 + rng(i * 3 + 2) * 7;
          const mx = cx + Math.cos(angle) * dist;
          const my = cy + Math.sin(angle) * dist;
          const lineAngle = angle + Math.PI / 2;
          const dx = Math.cos(lineAngle);
          const dy = Math.sin(lineAngle);
          const nearX = mx - dx * len / 2, nearY = my - dy * len / 2;
          const farX = mx + dx * len / 2, farY = my + dy * len / 2;
          const px = -dy, py = dx;
          const thin = 0.4, thick = 1.8;
          ctx.fillStyle = blueShades[i % blueShades.length];
          ctx.globalAlpha = 0.5 + 0.5 * progress;
          ctx.beginPath();
          ctx.moveTo(nearX - px * thin, nearY - py * thin);
          ctx.lineTo(nearX + px * thin, nearY + py * thin);
          ctx.lineTo(farX + px * thick, farY + py * thick);
          ctx.lineTo(farX - px * thick, farY - py * thick);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // Bullets
  ctx.fillStyle = "#ffffaa";
  for (const b of bullets) {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // Lighting overlay — darken everything, punch holes for light tiles and player
  if (levelUsesLighting) drawLightingOverlay();
}

function drawLightingOverlay() {
  // Collect all active light sources
  const sources = [];

  // Light tiles
  const rows = tilemap.length;
  for (let ty = 0; ty < rows; ty++) {
    const row = tilemap[ty];
    if (!row) continue;
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] === TILE_LIGHT) {
        const flicker = 0.85 + 0.15 * Math.sin(waveTime * 9 + tx * 0.7 + ty * 1.1);
        sources.push({
          x: tx * TILE_SIZE + TILE_SIZE / 2,
          y: ty * TILE_SIZE + TILE_SIZE / 2,
          r: 68 * flicker,
          color: "rgba(255, 200, 60,"
        });
      }
    }
  }

  // Player always has a small ambient glow so they can see themselves
  if (player) {
    sources.push({
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
      r: 40,
      color: "rgba(120, 160, 255,"
    });
  }

  if (sources.length === 0) return;

  // Build the overlay using destination-out compositing to cut holes in the dark layer
  const offscreen = document.createElement("canvas");
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const oc = offscreen.getContext("2d");

  // Fill with darkness
  oc.fillStyle = "rgba(0, 0, 0, 0.72)";
  oc.fillRect(0, 0, offscreen.width, offscreen.height);

  // Punch transparent radial holes for each light source
  oc.globalCompositeOperation = "destination-out";
  for (const src of sources) {
    const grad = oc.createRadialGradient(src.x, src.y, 0, src.x, src.y, src.r);
    grad.addColorStop(0, src.color + "1)");
    grad.addColorStop(0.35, src.color + "0.85)");
    grad.addColorStop(0.7, src.color + "0.3)");
    grad.addColorStop(1, src.color + "0)");
    oc.fillStyle = grad;
    oc.beginPath();
    oc.arc(src.x, src.y, src.r, 0, Math.PI * 2);
    oc.fill();
  }

  // Stamp the overlay onto the main canvas
  ctx.drawImage(offscreen, 0, 0);
}

// Main loop
function update(dt) {
  if (!player) return;
  if (gameOver || win) return;

  if (passDoorPromptCooldown > 0) passDoorPromptCooldown -= dt;
  waveTime += dt;
  updatePlayer(dt);
  updateCivilians(dt);
  updateOracles(dt);
  updateEnemies(dt);
  updateItems(dt);
  updateMelee(dt);
  updateParry(dt);
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

// ═══════════════════════════════════════════════════════════
// Iron Bastion — Tower Defense MVP
// Main game module
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';

// ── CONSTANTS ──
const GRID_W = 14, GRID_H = 10;
const HALF_W = GRID_W / 2, HALF_H = GRID_H / 2;
const MAX_LIVES = 20;
const BASE_COST = 50;

const PATH_POINTS = [
  [0, 5], [3, 5], [3, 2], [7, 2], [7, 7], [10, 7], [10, 3], [13, 3]
];

// Level stats: each level adds a barrel, grows 15%, costs double
function getLevelStats(level) {
  const dmg = [5, 8, 12, 18, 28];
  const rate = [2.5, 3.5, 5, 7.5, 13];
  const range = [3.2, 3.4, 3.6, 3.9, 4.3];
  const names = ['Cañón Simple', 'Cañón Doble', 'Triple Cañón', 'Quad Cañón', 'Gatling'];
  let upgradeCost = BASE_COST;
  for (let i = 0; i < level; i++) upgradeCost *= 2;
  return {
    dmg: dmg[level], rate: rate[level], range: range[level],
    name: 'MG-7 VULCAN', sub: names[level],
    upCost: upgradeCost, scale: 1 + level * 0.15
  };
}

const ENEMY_DEF = { hp: 40, armor: 2, speed: 1.8, reward: 12 };
const WAVES = [
  [5, 1.2], [8, 1], [10, 0.9], [13, 0.8], [16, 0.7],
  [19, 0.65], [22, 0.6], [26, 0.55], [30, 0.5], [35, 0.42]
];

// ── GAME STATE ──
let grid = [];
let state;

function initState() {
  grid = [];
  for (let y = 0; y < GRID_H; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_W; x++) grid[y][x] = 0;
  }
  // Mark path
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [x0, y0] = PATH_POINTS[i];
    const [x1, y1] = PATH_POINTS[i + 1];
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let cx = x0, cy = y0;
    while (cx !== x1 || cy !== y1) {
      grid[cy][cx] = 1;
      cx += dx; cy += dy;
    }
    grid[y1][x1] = 1;
  }
  state = {
    credits: 250, lives: MAX_LIVES,
    wave: 0, waveActive: false,
    towers: [], enemies: [], projectiles: [], particles: [],
    spawnQueue: [], spawnTimer: 0,
    gameOver: false,
    creditsSaved: 250, livesSaved: MAX_LIVES,
    selected: null
  };
}
initState();

// Build world-space path
const pathWorld = PATH_POINTS.map(([gx, gy]) =>
  new THREE.Vector3(gx - HALF_W + 0.5, 0.01, gy - HALF_H + 0.5)
);

// ── MATERIALS ──
const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 }),
  road: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }),
  roadEdge: new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 }),
  roadLine: new THREE.MeshStandardMaterial({ color: 0xCCCC55, roughness: 0.6 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x777766, roughness: 0.95 }),
  base: new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.55, metalness: 0.5 }),
  baseDark: new THREE.MeshStandardMaterial({ color: 0x42474d, roughness: 0.45, metalness: 0.6 }),
  hull: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.35 }),
  hullDark: new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.45, metalness: 0.4 }),
  barrel: new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.25, metalness: 0.8 }),
  barrelDark: new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.2, metalness: 0.85 }),
  bolt: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3, metalness: 0.7 }),
  enemyBody: new THREE.MeshStandardMaterial({ color: 0x8B5A30, roughness: 0.45, metalness: 0.25 }),
  enemyDark: new THREE.MeshStandardMaterial({ color: 0x4a2a15, roughness: 0.4, metalness: 0.3 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.3, metalness: 0.7 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.1, transparent: true, opacity: 0.6 }),
  hover: new THREE.MeshStandardMaterial({ color: 0x55aa55, roughness: 0.6, transparent: true, opacity: 0.7 }),
  invalid: new THREE.MeshStandardMaterial({ color: 0xaa3333, roughness: 0.6, transparent: true, opacity: 0.5 }),
  selected: new THREE.MeshStandardMaterial({ color: 0x4488aa, roughness: 0.6, transparent: true, opacity: 0.6 }),
};

function mk(geo, mat) { return new THREE.Mesh(geo, mat); }

// ═══════════════════════════════════════════════
// TOWER BUILDER — CIWS with progressive barrels
// ═══════════════════════════════════════════════
function buildTower(level) {
  const stats = getLevelStats(level);
  const s = 0.65 * stats.scale;
  const group = new THREE.Group();

  // Pedestal
  const p1 = mk(new THREE.CylinderGeometry(0.23 * s, 0.26 * s, 0.05 * s, 16), MAT.baseDark);
  p1.position.y = 0.025 * s; p1.castShadow = true; group.add(p1);
  const p2 = mk(new THREE.CylinderGeometry(0.20 * s, 0.23 * s, 0.06 * s, 16), MAT.base);
  p2.position.y = 0.08 * s; p2.castShadow = true; group.add(p2);
  const p3 = mk(new THREE.CylinderGeometry(0.16 * s, 0.20 * s, 0.07 * s, 16), MAT.base);
  p3.position.y = 0.15 * s; p3.castShadow = true; group.add(p3);

  // Turret (rotates)
  const turret = new THREE.Group();
  turret.position.y = 0.19 * s;

  // Hull
  const tb = mk(new THREE.BoxGeometry(0.30 * s, 0.02 * s, 0.32 * s), MAT.hullDark);
  tb.castShadow = true; turret.add(tb);
  const t2 = mk(new THREE.BoxGeometry(0.28 * s, 0.14 * s, 0.28 * s), MAT.hull);
  t2.position.y = 0.09 * s; t2.castShadow = true; turret.add(t2);
  const t3 = mk(new THREE.BoxGeometry(0.25 * s, 0.11 * s, 0.25 * s), MAT.hull);
  t3.position.y = 0.21 * s; t3.castShadow = true; turret.add(t3);
  const t4 = mk(new THREE.BoxGeometry(0.23 * s, 0.015 * s, 0.23 * s), MAT.hullDark);
  t4.position.y = 0.27 * s; turret.add(t4);

  // Front slope
  const fslope = mk(new THREE.BoxGeometry(0.25 * s, 0.09 * s, 0.025 * s), MAT.hullDark);
  fslope.position.set(0, 0.1 * s, 0.15 * s); fslope.rotation.x = -0.3; turret.add(fslope);

  // Barrel assembly
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.1 * s, 0.15 * s);
  const barrelData = [];
  const bRadius = 0.014 * s;

  if (level < 4) {
    // Levels 0-3: 1 to 4 barrels
    const numBarrels = level + 1;
    const spacing = 0.04 * s;
    let positions = [];

    if (numBarrels === 1) positions = [[0, 0]];
    else if (numBarrels === 2) positions = [[-spacing * 0.6, spacing * 0.4], [spacing * 0.6, -spacing * 0.4]];
    else if (numBarrels === 3) positions = [[0, spacing * 0.65], [-spacing * 0.65, -spacing * 0.3], [spacing * 0.65, -spacing * 0.3]];
    else positions = [[-spacing * 0.6, spacing * 0.55], [spacing * 0.6, spacing * 0.55], [-spacing * 0.6, -spacing * 0.55], [spacing * 0.6, -spacing * 0.55]];

    // Mantlet
    const mw = (0.07 + numBarrels * 0.025) * s;
    const mh = (0.06 + numBarrels * 0.02) * s;
    barrelGroup.add(mk(new THREE.BoxGeometry(mw, mh, 0.05 * s), MAT.hullDark));

    const barrelLen = (0.32 + level * 0.05) * s;

    for (const [bx, by] of positions) {
      // Barrel
      const brl = mk(new THREE.CylinderGeometry(bRadius * 0.85, bRadius, barrelLen, 8), MAT.barrel);
      brl.rotation.x = Math.PI / 2; brl.position.set(bx, by, barrelLen / 2 + 0.025 * s);
      brl.castShadow = true; barrelGroup.add(brl);

      // Sleeve
      const slv = mk(new THREE.CylinderGeometry(bRadius * 1.4, bRadius * 1.5, 0.03 * s, 8), MAT.barrelDark);
      slv.rotation.x = Math.PI / 2; slv.position.set(bx, by, 0.03 * s);
      barrelGroup.add(slv);

      // Muzzle
      const muz = mk(new THREE.CylinderGeometry(bRadius * 1.2, bRadius * 0.8, 0.022 * s, 8), MAT.barrelDark);
      muz.rotation.x = Math.PI / 2; muz.position.set(bx, by, barrelLen + 0.03 * s);
      barrelGroup.add(muz);

      barrelData.push({ ox: bx, oy: by, tipZ: barrelLen + 0.035 * s });
    }
  } else {
    // Level 4: Gatling (6 rotating barrels)
    const numGat = 6, gatCircle = 0.045 * s, gatLen = 0.48 * s, gatRad = 0.013 * s;

    const mantlet = mk(new THREE.CylinderGeometry(0.055 * s, 0.07 * s, 0.065 * s, 12), MAT.hullDark);
    mantlet.rotation.x = Math.PI / 2; barrelGroup.add(mantlet);

    const gatGroup = new THREE.Group();
    gatGroup.position.z = 0.033 * s;

    // Spindle
    const spindle = mk(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, gatLen + 0.03 * s, 8), MAT.barrelDark);
    spindle.rotation.x = Math.PI / 2; spindle.position.z = gatLen / 2;
    gatGroup.add(spindle);

    for (let i = 0; i < numGat; i++) {
      const angle = (i / numGat) * Math.PI * 2;
      const bx = Math.cos(angle) * gatCircle;
      const by = Math.sin(angle) * gatCircle;

      const brl = mk(new THREE.CylinderGeometry(gatRad * 0.85, gatRad, gatLen, 8), MAT.barrel);
      brl.rotation.x = Math.PI / 2; brl.position.set(bx, by, gatLen / 2);
      brl.castShadow = true; gatGroup.add(brl);

      const muz = mk(new THREE.CylinderGeometry(gatRad * 1.2, gatRad * 0.7, 0.018 * s, 8), MAT.barrelDark);
      muz.rotation.x = Math.PI / 2; muz.position.set(bx, by, gatLen + 0.006 * s);
      gatGroup.add(muz);

      barrelData.push({ ox: bx, oy: by, tipZ: gatLen + 0.012 * s });
    }

    // Ring clamps
    for (let ri = 0; ri < 3; ri++) {
      const ring = mk(new THREE.TorusGeometry(gatCircle + 0.012 * s, 0.005 * s, 6, 12), MAT.bolt);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = gatLen * (0.25 + ri * 0.25);
      gatGroup.add(ring);
    }

    barrelGroup.add(gatGroup);
    turret.userData.gatlingGroup = gatGroup;
  }

  turret.add(barrelGroup);
  turret.userData.barrelData = barrelData;

  // LED indicator
  const led = mk(
    new THREE.SphereGeometry(0.005 * s, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0x44aa44, emissive: 0x22aa22, emissiveIntensity: 0.5 })
  );
  led.position.set(-0.04 * s, 0.31 * s, 0.04 * s);
  turret.add(led);
  turret.userData.led = led;

  // Level indicator dots
  const levelColors = [0x44ff44, 0x66ff44, 0xffff44, 0xffaa22, 0xff4444];
  for (let i = 0; i <= level; i++) {
    const dot = mk(
      new THREE.SphereGeometry(0.005 * s, 4, 4),
      new THREE.MeshStandardMaterial({ color: levelColors[i], emissive: levelColors[i], emissiveIntensity: 0.5 })
    );
    dot.position.set(-0.15 * s, 0.065 * s + i * 0.025 * s, 0.09 * s);
    turret.add(dot);
  }

  group.add(turret);
  group.userData.turret = turret;
  return group;
}

// ═══════════════════════════════════════════════
// ENEMY BUILDER — Armored Buggy (front = +Z)
// ═══════════════════════════════════════════════
function buildEnemy() {
  const group = new THREE.Group();

  // Chassis
  const chassis = mk(new THREE.BoxGeometry(0.28, 0.07, 0.46), MAT.enemyDark);
  chassis.position.y = 0.1; chassis.castShadow = true; group.add(chassis);

  // Hull
  const hull = mk(new THREE.BoxGeometry(0.26, 0.09, 0.38), MAT.enemyBody);
  hull.position.y = 0.17; hull.castShadow = true; group.add(hull);

  // Cabin
  const cabin = mk(new THREE.BoxGeometry(0.22, 0.08, 0.14), MAT.enemyDark);
  cabin.position.set(0, 0.26, 0.08); cabin.castShadow = true; group.add(cabin);

  // Windshield
  group.add(mk(new THREE.BoxGeometry(0.18, 0.06, 0.01), MAT.glass));
  group.children[group.children.length - 1].position.set(0, 0.26, 0.155);

  // Bumper
  group.add(mk(new THREE.BoxGeometry(0.27, 0.05, 0.03), MAT.steelDark));
  group.children[group.children.length - 1].position.set(0, 0.12, 0.23);

  // Headlights & taillights
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffff66, emissiveIntensity: 0.5 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.3 });
  for (const side of [-1, 1]) {
    const hl = mk(new THREE.BoxGeometry(0.04, 0.025, 0.02), headlightMat);
    hl.position.set(side * 0.09, 0.135, 0.24); group.add(hl);
    const tl = mk(new THREE.BoxGeometry(0.035, 0.025, 0.01), taillightMat);
    tl.position.set(side * 0.09, 0.19, -0.225); group.add(tl);
  }

  // Wheels
  const wheelPositions = [[-0.15, 0.055, 0.13], [0.15, 0.055, 0.13], [-0.15, 0.055, -0.13], [0.15, 0.055, -0.13]];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = mk(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 10), MAT.tire);
    tire.rotation.z = Math.PI / 2; tire.position.set(wx, wy, wz); group.add(tire);
  }

  // HP bar
  const hpGroup = new THREE.Group();
  hpGroup.position.y = 0.52;
  hpGroup.add(mk(new THREE.PlaneGeometry(0.42, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
  const hpFill = mk(new THREE.PlaneGeometry(0.38, 0.035), new THREE.MeshBasicMaterial({ color: 0x44dd44, side: THREE.DoubleSide }));
  hpFill.position.z = 0.001;
  hpGroup.add(hpFill);
  group.add(hpGroup);

  group.userData.hpFill = hpFill;
  group.userData.hpGroup = hpGroup;
  return group;
}

// ═══════════════════════════════════════════════
// SVG ICONS for UI
// ═══════════════════════════════════════════════
const ICONS = {
  damage: '<svg viewBox="0 0 16 16" fill="none" stroke="#FB7185" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="15"/><line x1="1" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="15" y2="8"/></svg>',
  rate: '<svg viewBox="0 0 16 16" fill="none" stroke="#FACC15" stroke-width="1.5"><polyline points="2,12 5,6 8,9 11,3 14,7"/></svg>',
  range: '<svg viewBox="0 0 16 16" fill="none" stroke="#60A5FA" stroke-width="1.5"><circle cx="8" cy="8" r="6" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="2"/></svg>',
  scale: '<svg viewBox="0 0 16 16" fill="none" stroke="#4ADE80" stroke-width="1.5"><rect x="3" y="3" width="10" height="10" rx="1"/><polyline points="7,3 7,1 13,1 13,7"/></svg>',
  kill: '<svg viewBox="0 0 14 14" fill="#FACC15" stroke="#EAB308" stroke-width=".7"><path d="M7 1L8.5 5H13L9.5 7.5L10.5 12L7 9.5L3.5 12L4.5 7.5L1 5H5.5Z"/></svg>',
  arrowUp: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="5,14 10,5 15,14"/></svg>',
  arrowUpSmall: '<svg viewBox="0 0 8 8" fill="none" stroke="#4ADE80" stroke-width="1.8" stroke-linecap="round"><polyline points="1.5,5.5 4,2.5 6.5,5.5"/></svg>',
  coins: '<svg viewBox="0 0 20 20"><ellipse cx="7" cy="14" rx="5" ry="2.8" fill="#B8882A" stroke="#DAA520" stroke-width=".8"/><ellipse cx="7" cy="12.5" rx="5" ry="2.8" fill="#D4A030" stroke="#F0C040" stroke-width=".7"/><ellipse cx="12" cy="10" rx="5" ry="2.8" fill="#C49528" stroke="#E8B830" stroke-width=".8"/><ellipse cx="12" cy="8.5" rx="5" ry="2.8" fill="#E8C840" stroke="#FFE860" stroke-width=".7"/></svg>',
  star: '<svg viewBox="0 0 18 18" fill="#A78BFA" stroke="#7C3AED" stroke-width="1"><path d="M9 1L11 6.5H17L12 10L13.5 16L9 12.5L4.5 16L6 10L1 6.5H7Z"/></svg>',
};

// ═══════════════════════════════════════════════
// THREE.JS SETUP
// ═══════════════════════════════════════════════
const viewportEl = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x78B8E0);
scene.fog = new THREE.FogExp2(0x78B8E0, 0.014);

let camSize = 6.5;
const vpRect = viewportEl.getBoundingClientRect();
const aspect = vpRect.width / vpRect.height;
const camera = new THREE.OrthographicCamera(-camSize * aspect, camSize * aspect, camSize, -camSize, 0.1, 200);
let cameraAngle = Math.PI / 4;
const cameraElevation = Math.atan(1 / Math.sqrt(2));

function updateCamera() {
  camera.position.set(
    Math.cos(cameraAngle) * Math.cos(cameraElevation) * 40,
    Math.sin(cameraElevation) * 40,
    Math.sin(cameraAngle) * Math.cos(cameraElevation) * 40
  );
  camera.lookAt(0, 0, 0);
  camera.left = -camSize * aspect; camera.right = camSize * aspect;
  camera.top = camSize; camera.bottom = -camSize;
  camera.updateProjectionMatrix();
}
updateCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(vpRect.width, vpRect.height);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewportEl.insertBefore(renderer.domElement, viewportEl.firstChild);

// Lighting
scene.add(new THREE.AmbientLight(0x99aabb, 0.45));
const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.9);
sunLight.position.set(10, 18, 8);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -14; sunLight.shadow.camera.right = 14;
sunLight.shadow.camera.top = 14; sunLight.shadow.camera.bottom = -14;
sunLight.shadow.mapSize.set(1024, 1024);
scene.add(sunLight);
scene.add(new THREE.DirectionalLight(0xaaccff, 0.25).position.set(-8, 10, -6));

// ── Mini Preview Scene ──
const miniScene = new THREE.Scene();
miniScene.background = new THREE.Color(0x0f1e30);
const miniCamera = new THREE.PerspectiveCamera(28, 180 / 200, 0.1, 50);
miniCamera.position.set(2, 1.5, 2);
miniCamera.lookAt(0, 0.2, 0);
miniScene.add(new THREE.AmbientLight(0xaabbcc, 0.55));
miniScene.add(new THREE.DirectionalLight(0xffffff, 1).position.set(3, 6, 3));
miniScene.add(new THREE.DirectionalLight(0x88aacc, 0.4).position.set(-2, 3, -2));
miniScene.add(new THREE.DirectionalLight(0x4466aa, 0.3).position.set(-1, 2, -3));

// Green pedestal
const miniFloor = mk(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x2a5a28, roughness: 0.8 }));
miniFloor.position.y = -0.025; miniScene.add(miniFloor);
const miniTop = mk(new THREE.CylinderGeometry(0.65, 0.65, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x3a7a35, roughness: 0.75 }));
miniTop.position.y = 0; miniScene.add(miniTop);
const miniRing = mk(new THREE.TorusGeometry(0.66, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: 0x55cc44, roughness: 0.4, metalness: 0.3, emissive: 0x228822, emissiveIntensity: 0.3 }));
miniRing.rotation.x = -Math.PI / 2; miniRing.position.y = 0.015; miniScene.add(miniRing);

const miniRenderer = new THREE.WebGLRenderer({ antialias: true });
miniRenderer.setSize(180, 200);
miniRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('preview-3d').insertBefore(miniRenderer.domElement, document.getElementById('preview-3d').firstChild);

let miniPreviewMesh = null;
function setMiniPreview(level) {
  if (miniPreviewMesh) miniScene.remove(miniPreviewMesh);
  miniPreviewMesh = buildTower(level);
  miniScene.add(miniPreviewMesh);
}

// ═══════════════════════════════════════════════
// BUILD WORLD
// ═══════════════════════════════════════════════
// Ground
const ground = mk(new THREE.BoxGeometry(GRID_W + 6, 0.12, GRID_H + 6), MAT.grass);
ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
const subGround = mk(new THREE.BoxGeometry(GRID_W + 8, 0.3, GRID_H + 8), new THREE.MeshStandardMaterial({ color: 0x3d6630 }));
subGround.position.y = -0.25; scene.add(subGround);

// Grid cells
const cells = [];
for (let y = 0; y < GRID_H; y++) {
  for (let x = 0; x < GRID_W; x++) {
    const isPath = grid[y][x] === 1;
    const mat = isPath ? MAT.road.clone() : MAT.grass.clone();
    if (!isPath) {
      const v = 0.9 + Math.random() * 0.2;
      mat.color.setRGB(0.29 * v, 0.48 * v, 0.23 * v);
    }
    const h = isPath ? 0.08 : 0.04;
    const tile = mk(new THREE.BoxGeometry(0.96, h, 0.96), mat);
    tile.position.set(x - HALF_W + 0.5, h / 2, y - HALF_H + 0.5);
    tile.receiveShadow = true;
    tile.userData = { gx: x, gy: y };
    scene.add(tile);
    cells.push(tile);

    // Curbs
    if (isPath) {
      const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H || grid[ny][nx] !== 1) {
          const cw = dx ? 0.06 : 0.96, cd = dy ? 0.06 : 0.96;
          const curb = mk(new THREE.BoxGeometry(cw, 0.1, cd), MAT.roadEdge);
          curb.position.set(x - HALF_W + 0.5 + dx * 0.48, 0.06, y - HALF_H + 0.5 + dy * 0.48);
          curb.receiveShadow = true; scene.add(curb);
        }
      }
    }
  }
}

// Road dashes
for (let i = 0; i < PATH_POINTS.length - 1; i++) {
  const dx = Math.sign(PATH_POINTS[i + 1][0] - PATH_POINTS[i][0]);
  const dy = Math.sign(PATH_POINTS[i + 1][1] - PATH_POINTS[i][1]);
  let xx = PATH_POINTS[i][0], yy = PATH_POINTS[i][1], count = 0;
  while (xx !== PATH_POINTS[i + 1][0] || yy !== PATH_POINTS[i + 1][1]) {
    if (count % 2 === 0) {
      const dash = mk(new THREE.BoxGeometry(dx ? 0.3 : 0.06, 0.01, dy ? 0.3 : 0.06), MAT.roadLine);
      dash.position.set(xx - HALF_W + 0.5, 0.085, yy - HALF_H + 0.5);
      scene.add(dash);
    }
    xx += dx; yy += dy; count++;
  }
}

// Decorative rocks
for (let i = 0; i < 12; i++) {
  const rx = Math.random() * GRID_W - HALF_W, rz = Math.random() * GRID_H - HALF_H;
  const gx = Math.floor(rx + HALF_W), gy = Math.floor(rz + HALF_H);
  if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H && grid[gy][gx] === 0) {
    const sz = 0.07 + Math.random() * 0.1;
    const rock = mk(new THREE.DodecahedronGeometry(sz, 0), MAT.rock);
    rock.position.set(rx + 0.5, sz / 2, rz + 0.5);
    rock.rotation.set(Math.random() * 2, Math.random() * 3, 0);
    rock.castShadow = true; scene.add(rock);
  }
}

// Spawn & Base markers
const spawnMarker = mk(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xaa3333 }));
spawnMarker.position.set(PATH_POINTS[0][0] - HALF_W + 0.5, 0.06, PATH_POINTS[0][1] - HALF_H + 0.5);
scene.add(spawnMarker);

const baseMarker = mk(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x2a7a2a }));
const bp = PATH_POINTS[PATH_POINTS.length - 1];
baseMarker.position.set(bp[0] - HALF_W + 0.5, 0.06, bp[1] - HALF_H + 0.5);
scene.add(baseMarker);
const baseBuilding = mk(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x556655 }));
baseBuilding.position.set(bp[0] - HALF_W + 0.5, 0.25, bp[1] - HALF_H + 0.5);
baseBuilding.castShadow = true; scene.add(baseBuilding);

// Range indicator
const rangeIndicator = mk(new THREE.RingGeometry(0, 1, 48), new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
rangeIndicator.rotation.x = -Math.PI / 2;
rangeIndicator.position.y = 0.05;
rangeIndicator.visible = false;
scene.add(rangeIndicator);

// ═══════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════
function placeTower(gx, gy) {
  if (state.credits < BASE_COST || grid[gy][gx] !== 0) return;
  state.credits -= BASE_COST;
  grid[gy][gx] = 2;
  const mesh = buildTower(0);
  mesh.position.set(gx - HALF_W + 0.5, 0, gy - HALF_H + 0.5);
  scene.add(mesh);
  state.towers.push({
    mesh, turret: mesh.userData.turret,
    gx, gy, wx: gx - HALF_W + 0.5, wz: gy - HALF_H + 0.5,
    level: 0, cooldown: 0, kills: 0, fireIndex: 0,
    invested: BASE_COST
  });
  updateHUD();
}

function upgradeTower(tower) {
  if (tower.level >= 4) return;
  const stats = getLevelStats(tower.level);
  if (state.credits < stats.upCost) return;
  state.credits -= stats.upCost;
  tower.invested += stats.upCost;
  tower.level++;
  scene.remove(tower.mesh);
  const mesh = buildTower(tower.level);
  mesh.position.set(tower.wx, 0, tower.wz);
  scene.add(mesh);
  tower.mesh = mesh;
  tower.turret = mesh.userData.turret;
  updateHUD();
  showPanel(tower);
}

function doSellTower(tower) {
  state.credits += Math.floor(tower.invested * 0.6);
  grid[tower.gy][tower.gx] = 0;
  scene.remove(tower.mesh);
  state.towers = state.towers.filter(t => t !== tower);
  state.selected = null;
  hidePanel();
  updateHUD();
}

function spawnEnemy() {
  const mesh = buildEnemy();
  const startPos = pathWorld[0].clone();
  mesh.position.copy(startPos);
  scene.add(mesh);
  state.enemies.push({
    mesh, hpFill: mesh.userData.hpFill, hpGroup: mesh.userData.hpGroup,
    hp: ENEMY_DEF.hp, maxHp: ENEMY_DEF.hp, speed: ENEMY_DEF.speed,
    pathIndex: 0, progress: 0, alive: true,
    pos: startPos.clone(), prevAngle: 0
  });
}

function fireProjectile(tower, target) {
  const stats = getLevelStats(tower.level);
  const group = new THREE.Group();
  const size = 0.02 + tower.level * 0.004;
  group.add(mk(new THREE.SphereGeometry(size, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffee44 })));
  const trail = mk(new THREE.CylinderGeometry(0.008, 0.003, 0.08, 4), new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.5 }));
  trail.rotation.x = Math.PI / 2; trail.position.z = -0.04;
  group.add(trail);
  group.position.set(tower.wx, 0.35, tower.wz);
  scene.add(group);
  state.projectiles.push({ mesh: group, target, speed: 14, dmg: stats.dmg, tower, alive: true });

  // Muzzle flash
  const barrelData = tower.turret.userData.barrelData;
  if (barrelData && barrelData.length > 0) {
    const idx = tower.fireIndex % barrelData.length;
    tower.fireIndex++;
    const flash = mk(new THREE.SphereGeometry(0.02, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
    flash.position.set(barrelData[idx].ox, barrelData[idx].oy, barrelData[idx].tipZ + 0.12);
    tower.turret.add(flash);
    setTimeout(() => { try { tower.turret.remove(flash); } catch (e) { } }, 35);
  }
}

function hitEffect(pos, color, count) {
  for (let i = 0; i < count; i++) {
    const sz = 0.015 + Math.random() * 0.02;
    const mesh = mk(new THREE.BoxGeometry(sz, sz, sz), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(pos); scene.add(mesh);
    state.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 1.5,
      vz: (Math.random() - 0.5) * 3,
      life: 0.25 + Math.random() * 0.15
    });
  }
}

function clearDynamic() {
  state.enemies.forEach(e => { if (e.alive) scene.remove(e.mesh); });
  state.projectiles.forEach(p => { if (p.alive) scene.remove(p.mesh); });
  state.particles.forEach(p => scene.remove(p.mesh));
  state.enemies = []; state.projectiles = []; state.particles = [];
  state.spawnQueue = []; state.spawnTimer = 0;
}

// ── Global functions for HTML buttons ──
window.resetWave = function () {
  clearDynamic();
  state.gameOver = false; state.waveActive = false;
  document.getElementById('overlay').classList.remove('show');
  if (state.wave > 0) state.wave--;
  state.credits = state.creditsSaved;
  state.lives = state.livesSaved;
  state.selected = null; hidePanel(); updateHUD();
};

window.resetAll = function () {
  clearDynamic();
  state.towers.forEach(t => scene.remove(t.mesh));
  state.towers = [];
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      if (grid[y][x] === 2) grid[y][x] = 0;
  state.credits = 250; state.lives = MAX_LIVES;
  state.wave = 0; state.waveActive = false; state.gameOver = false;
  state.creditsSaved = 250; state.livesSaved = MAX_LIVES;
  state.selected = null; hidePanel();
  document.getElementById('overlay').classList.remove('show');
  updateHUD();
};

window.startWave = function () {
  if (state.waveActive || state.gameOver || state.wave >= WAVES.length) return;
  state.creditsSaved = state.credits;
  state.livesSaved = state.lives;
  const [count, interval] = WAVES[state.wave];
  state.wave++; state.waveActive = true;
  state.spawnQueue = [];
  for (let i = 0; i < count; i++) state.spawnQueue.push(interval);
  state.spawnTimer = 0.4;
  updateHUD();
};

window.doUpgrade = function () { if (state.selected) upgradeTower(state.selected); };

let pendingSell = null;
window.askSell = function () {
  if (!state.selected) return;
  pendingSell = state.selected;
  const stats = getLevelStats(state.selected.level);
  document.getElementById('confirm-title').textContent = 'Vender ' + stats.name + '?';
  document.getElementById('confirm-text').innerHTML = 'Nivel ' + (state.selected.level + 1) + ' · ' + stats.sub + ' · ' + state.selected.kills + ' kills';
  document.getElementById('confirm-amount').textContent = '+ $' + Math.floor(state.selected.invested * 0.6);
  document.getElementById('confirm-dialog').classList.add('show');
};
window.confirmSell = function () {
  if (pendingSell) { doSellTower(pendingSell); pendingSell = null; }
  document.getElementById('confirm-dialog').classList.remove('show');
};
window.cancelSell = function () {
  pendingSell = null;
  document.getElementById('confirm-dialog').classList.remove('show');
};

// ═══════════════════════════════════════════════
// PANEL UI
// ═══════════════════════════════════════════════
function makeStatCard(icon, title, titleClass, bgClass, borderClass, value, max, barColor, next) {
  const pct = Math.round(typeof value === 'number' ? value / max * 100 : parseFloat(value) / max * 100);
  const nextHtml = next
    ? `<div class="stat-next">${ICONS.arrowUpSmall} Próximo: <b>${next}</b></div>`
    : '';
  return `<div class="stat-card ${borderClass}">
    <div class="stat-icon ${bgClass}">${icon}</div>
    <div class="stat-body">
      <div class="stat-title ${titleClass}">${title}</div>
      <div class="stat-current">Actual: <b>${value}</b></div>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      ${nextHtml}
    </div>
  </div>`;
}

function showPanel(tower) {
  state.selected = tower;
  const stats = getLevelStats(tower.level);
  const panel = document.getElementById('panel');
  panel.classList.remove('panel-empty');
  document.getElementById('preview-3d').style.display = '';
  document.getElementById('stats-section').style.display = '';
  document.getElementById('actions-section').style.display = '';
  setMiniPreview(tower.level);

  const next = tower.level < 4 ? getLevelStats(tower.level + 1) : null;

  document.getElementById('stats-section').innerHTML =
    `<div class="tower-header">
      <span class="tower-kills">${ICONS.kill} ${tower.kills}</span>
      <div class="tower-name">${stats.name}</div>
      <div class="tower-subtitle">Nivel Actual: ${tower.level + 1} — ${stats.sub}</div>
    </div>
    <div class="stat-grid">
      ${makeStatCard(ICONS.damage, 'DAÑO', 'text-red', 'bg-red', 'border-red', stats.dmg, 28, '#FB7185', next ? next.dmg : null)}
      ${makeStatCard(ICONS.rate, 'CADENCIA', 'text-yellow', 'bg-yellow', 'border-yellow', stats.rate + '/s', 13, '#FACC15', next ? next.rate + '/s' : null)}
      ${makeStatCard(ICONS.range, 'RANGO', 'text-blue', 'bg-blue', 'border-blue', stats.range + 'u', 4.3, '#60A5FA', next ? next.range + 'u' : null)}
      ${makeStatCard(ICONS.scale, 'ESCALA', 'text-green', 'bg-green', 'border-green', Math.round(stats.scale * 100) + '%', 160, '#4ADE80', next ? Math.round(next.scale * 100) + '%' : null)}
    </div>`;

  let actionsHtml = '';
  if (tower.level < 4) {
    const canUpgrade = state.credits >= stats.upCost;
    actionsHtml += `<button class="btn-upgrade" onclick="window.doUpgrade()" ${canUpgrade ? '' : 'disabled'}>
      ${ICONS.arrowUp}
      <span class="btn-label">MEJORAR</span>
      <span class="btn-price">$${stats.upCost}</span>
    </button>`;
  } else {
    actionsHtml += `<button class="btn-maxlevel">
      ${ICONS.star}
      <span class="btn-label">GATLING</span>
      <span class="btn-price">MAX</span>
    </button>`;
  }
  actionsHtml += `<button class="btn-sell" onclick="window.askSell()">
    ${ICONS.coins}
    <span class="btn-label">VENDER</span>
    <span class="btn-price">$${Math.floor(tower.invested * 0.6)}</span>
  </button>`;
  document.getElementById('actions-section').innerHTML = actionsHtml;
}

function hidePanel() {
  document.getElementById('panel').classList.add('panel-empty');
  if (miniPreviewMesh) { miniScene.remove(miniPreviewMesh); miniPreviewMesh = null; }
}

function updateHUD() {
  document.getElementById('credits').textContent = state.credits;
  document.getElementById('wave').textContent = state.wave;
  document.getElementById('enemy-count').textContent = state.enemies.filter(e => e.alive).length;

  const ratio = Math.max(0, state.lives / MAX_LIVES);
  const fill = document.getElementById('life-bar-fill');
  fill.style.width = (ratio * 100) + '%';
  fill.style.background = ratio > 0.5 ? '#22C55E' : ratio > 0.25 ? '#EAB308' : '#EF4444';

  const btn = document.getElementById('wave-btn');
  if (state.waveActive) { btn.disabled = true; btn.textContent = 'Oleada ' + state.wave + '...'; }
  else if (state.wave >= WAVES.length) { btn.disabled = true; btn.textContent = 'Victoria'; }
  else { btn.disabled = false; btn.textContent = '▶ Oleada ' + (state.wave + 1); }

  if (state.selected) showPanel(state.selected);
}

// ═══════════════════════════════════════════════
// MOUSE INTERACTION
// ═══════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
let hoveredCell = null, dragging = false, didDrag = false, lastMouseX = 0;

function getGridCell(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, point)) return null;
  const gx = Math.floor(point.x + HALF_W), gy = Math.floor(point.z + HALF_H);
  if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return null;
  return { gx, gy };
}

renderer.domElement.addEventListener('mousemove', (e) => {
  if (dragging) {
    const dx = e.clientX - lastMouseX;
    if (Math.abs(dx) > 2) didDrag = true;
    lastMouseX = e.clientX;
    cameraAngle += dx * 0.006;
    updateCamera();
    return;
  }
  if (hoveredCell) {
    const i = hoveredCell.gy * GRID_W + hoveredCell.gx;
    cells[i].material = grid[hoveredCell.gy][hoveredCell.gx] === 1 ? MAT.road.clone() : MAT.grass.clone();
  }
  hoveredCell = getGridCell(e);
  rangeIndicator.visible = false;
  if (hoveredCell) {
    const i = hoveredCell.gy * GRID_W + hoveredCell.gx;
    const cellValue = grid[hoveredCell.gy][hoveredCell.gx];
    cells[i].material = cellValue === 0 ? MAT.hover : cellValue === 2 ? MAT.selected : MAT.invalid;
    if (cellValue === 0) {
      rangeIndicator.visible = true;
      rangeIndicator.scale.setScalar(getLevelStats(0).range);
      rangeIndicator.position.set(hoveredCell.gx - HALF_W + 0.5, 0.05, hoveredCell.gy - HALF_H + 0.5);
    } else if (cellValue === 2) {
      const tower = state.towers.find(t => t.gx === hoveredCell.gx && t.gy === hoveredCell.gy);
      if (tower) {
        rangeIndicator.visible = true;
        rangeIndicator.scale.setScalar(getLevelStats(tower.level).range);
        rangeIndicator.position.set(tower.wx, 0.05, tower.wz);
      }
    }
  }
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 2) { dragging = true; didDrag = false; lastMouseX = e.clientX; renderer.domElement.style.cursor = 'grabbing'; }
});
window.addEventListener('mouseup', () => { dragging = false; renderer.domElement.style.cursor = ''; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('click', (e) => {
  if (didDrag) { didDrag = false; return; }
  if (state.gameOver) return;
  if (!hoveredCell) { state.selected = null; hidePanel(); return; }
  const cellValue = grid[hoveredCell.gy][hoveredCell.gx];
  if (cellValue === 0) placeTower(hoveredCell.gx, hoveredCell.gy);
  else if (cellValue === 2) {
    const tower = state.towers.find(t => t.gx === hoveredCell.gx && t.gy === hoveredCell.gy);
    if (tower) showPanel(tower);
  } else { state.selected = null; hidePanel(); }
});

renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  camSize = Math.max(3, Math.min(10, camSize + e.deltaY * 0.004));
  updateCamera();
}, { passive: false });

// ═══════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════
const clock = new THREE.Clock();
let time = 0;

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (!state.gameOver) {
    // Spawn enemies
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnQueue.shift();
        spawnEnemy();
        state.spawnTimer = state.spawnQueue.length > 0 ? WAVES[state.wave - 1][1] : 0.5;
      }
    }

    // Update enemies
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (enemy.pathIndex < pathWorld.length - 1) {
        const from = pathWorld[enemy.pathIndex], to = pathWorld[enemy.pathIndex + 1];
        enemy.progress += (enemy.speed * dt) / from.distanceTo(to);
        if (enemy.progress >= 1) {
          enemy.progress = 0; enemy.pathIndex++;
          if (enemy.pathIndex >= pathWorld.length - 1) {
            enemy.alive = false; scene.remove(enemy.mesh); state.lives--;
            if (state.lives <= 0) {
              state.gameOver = true;
              document.getElementById('overlay').classList.add('show');
              document.getElementById('overlay-title').textContent = 'Game Over';
              document.getElementById('overlay-title').style.color = '#EF4444';
              document.getElementById('overlay-text').textContent = 'Oleada ' + state.wave;
            }
            continue;
          }
        }
        const f2 = pathWorld[enemy.pathIndex], t2 = pathWorld[enemy.pathIndex + 1];
        enemy.pos.lerpVectors(f2, t2, enemy.progress);
        enemy.mesh.position.copy(enemy.pos);
        const dir = new THREE.Vector3().subVectors(t2, f2).normalize();
        const targetAngle = Math.atan2(dir.x, dir.z);
        let diff = targetAngle - enemy.prevAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        enemy.prevAngle += diff * Math.min(1, dt * 8);
        enemy.mesh.rotation.y = enemy.prevAngle;
        enemy.mesh.position.y = 0.01 + Math.sin(time * 12 + enemy.pathIndex * 2) * 0.003;
      }
      const hpRatio = enemy.hp / enemy.maxHp;
      enemy.hpFill.scale.x = Math.max(0.01, hpRatio);
      enemy.hpFill.position.x = -(1 - hpRatio) * 0.19;
      enemy.hpFill.material.color.setHex(hpRatio < 0.3 ? 0xdd4444 : hpRatio < 0.6 ? 0xddaa44 : 0x44dd44);
      if (enemy.hpGroup) enemy.hpGroup.rotation.y = -enemy.mesh.rotation.y + cameraAngle;
    }

    // Update towers
    for (const tower of state.towers) {
      const stats = getLevelStats(tower.level);
      tower.cooldown -= dt;
      let nearest = null, nearestDist = Infinity;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.pos.x - tower.wx, enemy.pos.z - tower.wz);
        if (dist <= stats.range && dist < nearestDist) { nearest = enemy; nearestDist = dist; }
      }
      if (nearest) {
        tower.turret.rotation.y = Math.atan2(nearest.pos.x - tower.wx, nearest.pos.z - tower.wz);
        if (tower.cooldown <= 0) { tower.cooldown = 1 / stats.rate; fireProjectile(tower, nearest); }
      }
      // Gatling spin
      if (tower.level === 4 && tower.turret.userData.gatlingGroup) {
        tower.turret.userData.gatlingGroup.rotation.z += dt * (nearest ? 45 : 2);
      }
      // LED pulse
      if (tower.turret.userData.led) {
        tower.turret.userData.led.material.emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.3;
      }
    }

    // Update projectiles
    for (const proj of state.projectiles) {
      if (!proj.alive) continue;
      if (!proj.target.alive) { proj.alive = false; scene.remove(proj.mesh); continue; }
      const dir = new THREE.Vector3().subVectors(proj.target.pos, proj.mesh.position);
      if (dir.length() < 0.12) {
        const dmg = Math.max(0, proj.dmg - ENEMY_DEF.armor);
        proj.target.hp -= dmg;
        hitEffect(proj.mesh.position.clone(), 0xffcc22, 3);
        if (proj.target.hp <= 0) {
          proj.target.alive = false; scene.remove(proj.target.mesh);
          state.credits += ENEMY_DEF.reward; proj.tower.kills++;
          hitEffect(proj.target.pos.clone(), 0xff4400, 6);
        }
        proj.alive = false; scene.remove(proj.mesh);
      } else {
        dir.normalize();
        proj.mesh.position.addScaledVector(dir, 14 * dt);
        proj.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }

    // Update particles
    for (const p of state.particles) {
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); continue; }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = Math.max(0, p.life / 0.35);
      p.mesh.material.transparent = true;
    }

    // Cleanup
    state.enemies = state.enemies.filter(e => e.alive);
    state.projectiles = state.projectiles.filter(p => p.alive);
    state.particles = state.particles.filter(p => p.life > 0);

    // Wave complete check
    if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      if (state.wave >= WAVES.length && state.lives > 0) {
        state.gameOver = true;
        document.getElementById('overlay').classList.add('show');
        document.getElementById('overlay-title').textContent = '¡Victoria!';
        document.getElementById('overlay-title').style.color = '#22C55E';
        document.getElementById('overlay-text').textContent = 'Base defendida · ' + state.lives + ' vidas · $' + state.credits;
      }
    }

    updateHUD();
  }

  // Animate markers
  spawnMarker.rotation.y = time * 1.5;
  baseMarker.rotation.y = -time * 1.5;

  // Mini preview rotation
  if (miniPreviewMesh) miniPreviewMesh.rotation.y = time * 0.6;

  // Render
  renderer.render(scene, camera);
  if (miniPreviewMesh) miniRenderer.render(miniScene, miniCamera);
}

// Start
updateHUD();
gameLoop();

console.log('🏰 Iron Bastion v0.2 loaded');
console.log('📋 Click green cells to place MG-7 towers ($50)');
console.log('📋 Click towers to upgrade/sell');
console.log('📋 Right-click drag to rotate, scroll to zoom');

#!/usr/bin/env node
/**
 * Authored, deterministic campaign geometry for Astral Forge.
 * Run from anywhere: node tools/generate-levels.cjs
 *
 * Positions are grid cells; the game renders square bricks. Negative space is
 * deliberate: every dense structure has shot lanes and breakable entrances.
 * Most bricks have one HP, so intricate silhouettes produce satisfying chains
 * instead of requiring players to chip away at several solid high-HP walls.
 */
const fs = require('node:fs');
const path = require('node:path');

const CYAN = ['#45b9df', '#61e0ed', '#b4fcf3'];
const VIOLET = ['#7760d9', '#aa8cf3', '#e3cbff'];
const ROSE = ['#cd629b', '#f294c7', '#ffe0f3'];
const GOLD = ['#d89848', '#f3c16f', '#fff1ba'];
const BLUE = ['#427fcf', '#79b0f3', '#c2e5ff'];
const MINT = ['#44b59b', '#72dfbd', '#c6ffe1'];
const IRON = '#bacbdf';
const TAU = Math.PI * 2;

function level(index, title, width, height, ballSpeed, paddleWidth, lives) {
  const bricks = new Map();
  const result = {
    name: `关卡${index} - ${title}`,
    gridWidth: width, gridHeight: height, ballSpeed, paddleWidth, lives,
  };
  const api = {
    width, height,
    add(col, row, palette = CYAN, hp = 1, overwrite = true) {
      col = Math.round(col); row = Math.round(row);
      if (col < 0 || col >= width || row < 0 || row >= height) return;
      const key = `${row},${col}`;
      if (!overwrite && bricks.has(key)) return;
      bricks.set(key, {
        row, col, hp,
        color: hp >= 10 ? IRON : palette[Math.min(hp - 1, 2)],
      });
    },
    paint(predicate, palette = CYAN, hp = 1, overwrite = true) {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (!predicate(col, row)) continue;
          const strength = typeof hp === 'function' ? hp(col, row) : hp;
          const shades = typeof palette === 'function' ? palette(col, row) : palette;
          api.add(col, row, shades, strength, overwrite);
        }
      }
    },
    cut(predicate) {
      for (const [key, brick] of bricks) {
        if (predicate(brick.col, brick.row)) bricks.delete(key);
      }
    },
    finish() {
      result.bricks = [...bricks.values()].sort((a, b) => a.row - b.row || a.col - b.col);
      return result;
    },
  };
  return api;
}

function ring(x, y, cx, cy, rx, ry, thickness = 0.13) {
  const distance = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return distance >= 1 - thickness && distance <= 1 + thickness;
}

function diamond(x, y, cx, cy, radius) {
  return Math.abs(x - cx) + Math.abs(y - cy) <= radius;
}

function diamondRing(x, y, cx, cy, radius, thickness = 1) {
  return Math.abs(Math.abs(x - cx) + Math.abs(y - cy) - radius) <= thickness;
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function line(l, ax, ay, bx, by, palette, width = 0.7, hp = 1) {
  l.paint((x, y) => segmentDistance(x, y, ax, ay, bx, by) <= width, palette, hp);
}

function star(l, cx, cy, radius, palette, hp = 1) {
  l.paint((x, y) => {
    const dx = Math.abs(x - cx); const dy = Math.abs(y - cy);
    return (dx + dy <= radius && Math.min(dx, dy) <= radius / 3);
  }, palette, (x, y) => x === cx && y === cy ? Math.min(hp + 1, 3) : hp);
}

const campaign = [];

// 01: Open orbital arcs welcome ricochets; two vertical light wells reach the core.
{
  const l = level(1, '星环启航', 28, 24, 295, 112, 5);
  l.paint((x, y) => ring(x, y, 13.5, 11, 12, 9, 0.085), VIOLET);
  l.paint((x, y) => ring(x, y, 13.5, 11, 7.7, 5.8, 0.12), CYAN,
    (x, y) => (x + y) % 4 === 0 ? 2 : 1);
  l.paint((x, y) => diamond(x, y, 13.5, 10.5, 3), GOLD,
    (x, y) => Math.abs(x - 13.5) < 1 ? 3 : 1);
  for (const [x, y] of [[2, 2], [25, 2], [3, 21], [24, 21]]) star(l, x, y, 2, CYAN);
  l.cut((x, y) => (x === 8 || x === 19) && y >= 14);
  l.cut((x, y) => x >= 13 && x <= 14 && y >= 15);
  campaign.push(l.finish());
}

// 02: Six petals are separated by open radial sectors and flower into long chains.
{
  const l = level(2, '光子花园', 30, 26, 300, 110, 5);
  const cx = 14.5; const cy = 12;
  for (let petal = 0; petal < 6; petal++) {
    const angle = petal * TAU / 6;
    l.paint((x, y) => {
      const dx = x - cx; const dy = y - cy;
      const u = dx * Math.cos(angle) + dy * Math.sin(angle);
      const v = -dx * Math.sin(angle) + dy * Math.cos(angle);
      return ring(u, v, 7, 0, 5.4, 3.15, 0.25) && u > 3;
    }, petal % 2 ? ROSE : CYAN,
    (x, y) => (x * 3 + y) % 7 === 0 ? 2 : 1);
  }
  l.paint((x, y) => diamond(x, y, cx, cy, 3.5), GOLD,
    (x, y) => Math.abs(x - cx) + Math.abs(y - cy) < 1.6 ? 3 : 1);
  for (const [x, y] of [[2, 2], [27, 2], [2, 23], [27, 23]]) star(l, x, y, 2, VIOLET);
  l.cut((x, y) => (x === 14 || x === 15) && y >= 17);
  campaign.push(l.finish());
}

// 03: Separate chambers can be entered from the center channel or their lower gates.
{
  const l = level(3, '双子脉冲', 30, 26, 310, 108, 4);
  for (const [cx, palette] of [[7, CYAN], [22, ROSE]]) {
    l.paint((x, y) => ring(x, y, cx, 12, 6.5, 9.1, 0.12), palette);
    l.paint((x, y) => ring(x, y, cx, 12, 3.3, 5.4, 0.23), VIOLET,
      (x, y) => y % 3 === 0 ? 2 : 1);
    l.paint((x, y) => diamond(x, y, cx, 11, 2), GOLD, 2);
    l.cut((x, y) => Math.abs(x - cx) <= 1 && y >= 17);
  }
  line(l, 3, 1, 11, 1, BLUE);
  line(l, 18, 1, 26, 1, VIOLET);
  line(l, 3, 24, 10, 22, CYAN);
  line(l, 19, 22, 26, 24, ROSE);
  l.cut((x) => x === 14 || x === 15);
  campaign.push(l.finish());
}

// 04: Staggered chevrons make a navigable zigzag corridor rather than a solid wall.
{
  const l = level(4, '棱镜航道', 28, 24, 315, 106, 4);
  const colors = [VIOLET, BLUE, CYAN, MINT, GOLD];
  for (let band = 0; band < 5; band++) {
    const y0 = 1 + band * 4;
    const direction = band % 2 ? -1 : 1;
    l.paint((x, y) => {
      const centerline = y0 + Math.abs(x - 13.5) * 0.33 * direction + (direction < 0 ? 4.5 : 0);
      return x >= 2 && x <= 25 && Math.abs(y - centerline) <= 0.95;
    }, colors[band], (x, y) => (x + band) % 6 === 0 ? 2 : 1);
    l.cut((x, y) => {
      const centerline = y0 + Math.abs(x - 13.5) * 0.33 * direction + (direction < 0 ? 4.5 : 0);
      const gate = band % 2 ? 7 : 20;
      return Math.abs(x - gate) <= 1 && Math.abs(y - centerline) <= 1.1;
    });
  }
  for (const x of [0, 27]) {
    for (const y of [2, 8, 14, 20]) l.add(x, y, GOLD, 2);
  }
  campaign.push(l.finish());
}

// 05: Five pairs of swept feathers funnel shots into a luminous central spine.
{
  const l = level(5, '天穹之翼', 32, 27, 320, 104, 4);
  for (const side of [-1, 1]) {
    for (let feather = 0; feather < 5; feather++) {
      const x0 = 15.5 + side * 2.5;
      const y0 = 6 + feather * 3.5;
      const x1 = 15.5 + side * (15 - feather * 1.4);
      const y1 = 2 + feather * 3.9;
      line(l, x0, y0, x1, y1, feather % 2 ? BLUE : CYAN, 1.05,
        (x, y) => (x + y) % 7 === 0 ? 2 : 1);
    }
  }
  l.paint((x, y) => diamondRing(x, y, 15.5, 8, 6, 1.2), VIOLET);
  l.paint((x, y) => diamond(x, y, 15.5, 8, 2.5), GOLD, 2);
  l.paint((x, y) => Math.abs(x - 15.5) <= 0.5 && y >= 15 && y <= 24, ROSE);
  l.cut((x, y) => (x === 11 || x === 20) && y >= 12 && y <= 22);
  star(l, 15.5, 25, 2, GOLD);
  campaign.push(l.finish());
}

// 06: Nine open reactor pods reward hopping between chambers through wide alleys.
{
  const l = level(6, '回声矩阵', 30, 26, 325, 104, 4);
  const palettes = [CYAN, VIOLET, ROSE];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = 4.5 + col * 10; const cy = 4 + row * 8;
      l.paint((x, y) => {
        const dx = Math.abs(x - cx); const dy = Math.abs(y - cy);
        return dx <= 3.5 && dy <= 3 && (dx >= 2.5 || dy >= 2);
      }, palettes[(row + col) % 3], (x, y) => (x + 2 * y) % 9 === 0 ? 2 : 1);
      l.cut((x, y) => Math.abs(x - cx) <= 1.5 && y === cy + 3);
      l.paint((x, y) => Math.abs(x - cx) <= 0.5 && y === cy, GOLD, 2);
    }
  }
  for (const x of [4, 14, 24]) star(l, x, 25, 1, MINT);
  campaign.push(l.finish());
}

// 07: Interleaved eight-point shells, with diagonal vents reaching a soft core.
{
  const l = level(7, '超新星冠', 32, 27, 330, 102, 4);
  const cx = 15.5; const cy = 12.5;
  l.paint((x, y) => {
    const dx = x - cx; const dy = y - cy;
    const angle = Math.atan2(dy, dx);
    const edge = 10.8 + 2.4 * Math.cos(8 * angle);
    return Math.abs(Math.hypot(dx, dy) - edge) < 1.15;
  }, (x, y) => (x < cx) === (y < cy) ? ROSE : VIOLET);
  l.paint((x, y) => diamondRing(x, y, cx, cy, 9.5, 1.3), GOLD,
    (x, y) => (x + y) % 5 === 0 ? 2 : 1);
  l.paint((x, y) => ring(x, y, cx, cy, 4.4, 4.4, 0.25), CYAN, 2);
  l.paint((x, y) => diamond(x, y, cx, cy, 1.5), GOLD, 3);
  l.cut((x, y) => y > cy && Math.abs(Math.abs(x - cx) - (y - cy)) <= 0.8);
  for (const x of [1, 30]) for (const y of [2, 23]) star(l, x, y, 1, CYAN);
  campaign.push(l.finish());
}

// 08: Three spiral arms leave continuous curved channels rather than sealed rings.
{
  const l = level(8, '引力涡旋', 32, 27, 335, 102, 4);
  const cx = 15.5; const cy = 12.5;
  l.paint((x, y) => {
    const dx = x - cx; const dy = (y - cy) * 1.1;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    return radius > 2 && radius < 13.7 && Math.cos(3 * angle - radius * 0.71) > 0.08;
  }, (x, y) => {
    const radius = Math.hypot(x - cx, (y - cy) * 1.1);
    return radius > 10 ? VIOLET : radius > 6 ? BLUE : CYAN;
  }, (x, y) => (x * 5 + y * 3) % 11 < 2 ? 2 : 1);
  l.paint((x, y) => diamond(x, y, cx, cy, 1.5), GOLD, 3);
  for (const [x, y] of [[2, 2], [29, 3], [3, 23], [28, 24]]) star(l, x, y, 1, ROSE);
  campaign.push(l.finish());
}

// 09: Recursive division makes a real open maze with three-cell-wide doorways.
{
  const l = level(9, '霓虹迷城', 32, 27, 340, 100, 4);
  function room(x0, y0, x1, y1, depth, vertical) {
    if (depth === 0 || x1 - x0 < 7 || y1 - y0 < 6) return;
    const palette = [CYAN, VIOLET, ROSE, BLUE][depth % 4];
    if (vertical) {
      const x = Math.round((x0 + x1) / 2);
      const gap = Math.round(y0 + (y1 - y0) * (depth % 2 ? 0.3 : 0.7));
      line(l, x, y0, x, y1, palette, 0.8);
      l.cut((cx, cy) => cx === x && Math.abs(cy - gap) <= 1);
      room(x0, y0, x - 1, y1, depth - 1, false);
      room(x + 1, y0, x1, y1, depth - 1, false);
    } else {
      const y = Math.round((y0 + y1) / 2);
      const gap = Math.round(x0 + (x1 - x0) * (depth % 2 ? 0.3 : 0.7));
      line(l, x0, y, x1, y, palette, 0.8);
      l.cut((cx, cy) => cy === y && Math.abs(cx - gap) <= 1);
      room(x0, y0, x1, y - 1, depth - 1, true);
      room(x0, y + 1, x1, y1, depth - 1, true);
    }
  }
  l.paint((x, y) => x >= 1 && x <= 30 && y >= 1 && y <= 24
    && (x <= 2 || x >= 29 || y <= 2 || y >= 23), BLUE,
  (x, y) => (x + y) % 7 === 0 ? 2 : 1);
  room(3, 3, 28, 22, 4, true);
  l.cut((x, y) => (x >= 14 && x <= 17 && (y <= 2 || y >= 23))
    || (y >= 11 && y <= 13 && (x <= 2 || x >= 29)));
  for (const [x, y] of [[6, 6], [25, 6], [6, 19], [25, 19]]) star(l, x, y, 2, GOLD, 2);
  campaign.push(l.finish());
}

// 10: Soft nebula islands linked by broken constellation lines; aim for clusters.
{
  const l = level(10, '星云群岛', 34, 29, 345, 100, 4);
  const nodes = [[6, 6, 4.3, CYAN], [19, 4, 3.2, ROSE], [28, 11, 4.1, VIOLET],
    [15, 14, 4.5, BLUE], [5, 22, 4.1, MINT], [26, 23, 3.9, ROSE]];
  for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 4], [3, 5], [2, 5]]) {
    line(l, nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], VIOLET, 0.4);
  }
  for (const [cx, cy, radius, palette] of nodes) {
    l.paint((x, y) => {
      const dx = x - cx; const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      return distance <= radius + 0.65 * Math.cos(angle * 5)
        && !(distance > 1.8 && Math.abs(dx - dy) < 0.6);
    }, palette, (x, y) => (x * 7 + y) % 9 === 0 ? 2 : 1);
    star(l, cx, cy, 1, GOLD, 2);
  }
  // Break the linking lines into actual star trails; the ball can pass between them.
  l.cut((x, y) => x % 3 === 0 && !nodes.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + 1));
  campaign.push(l.finish());
}

// 11: A branching crystal cathedral, with diamonds connected through open trusses.
{
  const l = level(11, '分形圣殿', 34, 29, 350, 98, 4);
  const nodes = [[16.5, 13, 10.5], [5.5, 6, 4.5], [27.5, 6, 4.5],
    [5.5, 22, 4.5], [27.5, 22, 4.5]];
  for (const [cx, cy, radius] of nodes) {
    l.paint((x, y) => diamondRing(x, y, cx, cy, radius, 1.0), VIOLET);
    l.paint((x, y) => diamondRing(x, y, cx, cy, radius * 0.54, 0.65), CYAN,
      (x, y) => (x + y) % 4 === 0 ? 2 : 1);
  }
  for (const side of [-1, 1]) {
    line(l, 16.5, 2, 16.5 + side * 13, 15, BLUE, 0.75);
    line(l, 16.5, 25, 16.5 + side * 13, 12, ROSE, 0.75);
  }
  l.paint((x, y) => diamond(x, y, 16.5, 13, 2.5), GOLD, 2);
  l.cut((x, y) => x >= 16 && x <= 17 && y >= 18);
  l.cut((x, y) => (x === 7 || x === 26) && y >= 14 && y <= 21);
  campaign.push(l.finish());
}

// 12: A turbine with eight radial blades and interrupted rings. Four iron hubs only.
{
  const l = level(12, '恒星熔炉', 34, 29, 355, 96, 4);
  const cx = 16.5; const cy = 13.5;
  l.paint((x, y) => {
    const dx = x - cx; const dy = y - cy;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    return radius >= 7 && radius <= 14 && Math.cos(8 * angle - radius * 0.28) > 0.12;
  }, (x, y) => y < cy ? GOLD : ROSE, (x, y) => (x + 3 * y) % 8 === 0 ? 2 : 1);
  l.paint((x, y) => ring(x, y, cx, cy, 6, 6, 0.21), CYAN,
    (x, y) => (x + y) % 3 === 0 ? 2 : 1);
  l.paint((x, y) => diamond(x, y, cx, cy, 3), VIOLET, 2);
  l.cut((x, y) => x >= 16 && x <= 17 && y >= 17);
  l.cut((x, y) => y >= 13 && y <= 14 && Math.abs(x - cx) > 3);
  for (const [x, y] of [[5, 5], [28, 5], [5, 22], [28, 22]]) l.add(x, y, CYAN, 10);
  campaign.push(l.finish());
}

// 13: A complete Dyson megastructure: segmented collectors, an equatorial
// ring and a bright stellar core. Huge appearance, several broad entry routes.
{
  const l = level(13, '戴森天幕', 36, 30, 365, 94, 5);
  const cx = 17.5; const cy = 13.5;
  l.paint((x, y) => ring(x, y, cx, cy, 16, 12.8, 0.105), VIOLET,
    (x, y) => (x + 3 * y) % 8 === 0 ? 2 : 1);
  l.paint((x, y) => ring(x, y, cx, cy, 10.5, 10.4, 0.12), CYAN,
    (x, y) => (x + y) % 5 === 0 ? 2 : 1);
  l.paint((x, y) => ring(x, y, cx, cy, 16.2, 4.5, 0.2), GOLD,
    (x, y) => (x + y) % 6 === 0 ? 2 : 1);
  l.paint((x, y) => diamond(x, y, cx, cy, 4.5), ROSE,
    (x, y) => Math.abs(x - cx) + Math.abs(y - cy) < 2 ? 3 : 1);
  for (const side of [-1, 1]) {
    line(l, cx + side * 3, 2, cx + side * 14, 8, BLUE, 0.8);
    line(l, cx + side * 3, 26, cx + side * 14, 20, BLUE, 0.8);
  }
  // Open collector seams, lower docking gates, and a route through the equator.
  l.cut((x, y) => (x === 8 || x === 27) && (y < 8 || y > 19));
  l.cut((x, y) => x >= 16 && x <= 19 && y >= 19);
  l.cut((x, y) => y >= 13 && y <= 14 && (x < 9 || x > 26));
  for (const [x, y] of [[3, 7], [32, 7], [3, 21], [32, 21]]) l.add(x, y, VIOLET, 10);
  for (const [x, y] of [[2, 28], [33, 28]]) star(l, x, y, 1, CYAN);
  campaign.push(l.finish());
}

const outputDirectory = path.join(__dirname, '..', 'levels');
for (const [index, stage] of campaign.entries()) {
  const positions = new Set();
  let hp = 0;
  const pitch = 357 / stage.gridWidth;
  for (const brick of stage.bricks) {
    const key = `${brick.row},${brick.col}`;
    if (positions.has(key)) throw new Error(`${stage.name}: duplicate ${key}`);
    positions.add(key);
    if (brick.row < 0 || brick.row >= stage.gridHeight || brick.col < 0 || brick.col >= stage.gridWidth) {
      throw new Error(`${stage.name}: out-of-bounds brick ${key}`);
    }
    if (![1, 2, 3, 10].includes(brick.hp)) throw new Error(`${stage.name}: invalid HP`);
    if (!/^#[a-f0-9]{6}$/i.test(brick.color)) throw new Error(`${stage.name}: invalid color`);
    if (90 + (brick.row + 1) * pitch - 2 > 400) throw new Error(`${stage.name}: brick field too low`);
    hp += brick.hp;
  }
  if (hp / stage.bricks.length > 1.65) throw new Error(`${stage.name}: too much HP`);
  if (stage.bricks.length < 180 || stage.bricks.length > 550) throw new Error(`${stage.name}: inappropriate brick count`);
  if (stage.bricks.filter((brick) => brick.hp === 10).length / stage.bricks.length > 0.03) {
    throw new Error(`${stage.name}: too many iron bricks`);
  }
  const filename = `level-${String(index + 1).padStart(2, '0')}.json`;
  const header = JSON.stringify({ ...stage, bricks: undefined }, null, 2).slice(0, -2);
  const encodedBricks = stage.bricks.map((brick) => `    ${JSON.stringify(brick)}`).join(',\n');
  fs.writeFileSync(path.join(outputDirectory, filename), `${header},\n  "bricks": [\n${encodedBricks}\n  ]\n}\n`);
}

console.table(campaign.map((stage) => ({
  name: stage.name,
  grid: `${stage.gridWidth}×${stage.gridHeight}`,
  bricks: stage.bricks.length,
  hp: stage.bricks.reduce((sum, brick) => sum + brick.hp, 0),
  averageHP: +(stage.bricks.reduce((sum, brick) => sum + brick.hp, 0) / stage.bricks.length).toFixed(2),
  iron: stage.bricks.filter((brick) => brick.hp === 10).length,
  speed: stage.ballSpeed,
  paddle: stage.paddleWidth,
  lives: stage.lives,
})));

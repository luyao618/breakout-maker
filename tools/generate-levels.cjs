#!/usr/bin/env node
/**
 * Deterministic tactical campaign for Astral Forge.
 * Every silhouette has intentional shot lanes; difficulty comes from angle
 * control, guarded entrances and accelerator returns, never immortal bricks.
 * Run: node tools/generate-levels.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const CYAN = '#61dce9';
const VIOLET = '#aa8cf3';
const ROSE = '#ee8bc1';
const BLUE = '#79b0f3';
const GOLD = '#ffc971';
const MINT = '#80efc8';
const ARMOR = '#b8ccf4';
const KIND_HP = { normal: 1, armor: 2, reactor: 2, accelerator: 1 };

function level(index, title, difficulty, briefing, ballSpeed, paddleWidth, width = 24, height = 20) {
  const bricks = new Map();
  const api = {
    width, height,
    add(col, row, color = CYAN, kind = 'normal', hp = KIND_HP[kind]) {
      col = Math.round(col); row = Math.round(row);
      if (col < 0 || col >= width || row < 0 || row >= height) return;
      bricks.set(`${row},${col}`, { row, col, hp, color: kind === 'armor' ? ARMOR : kind === 'reactor' ? GOLD : kind === 'accelerator' ? MINT : color, kind });
    },
    paint(predicate, color = CYAN, kind = 'normal', hp) {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (predicate(x, y)) api.add(x, y, typeof color === 'function' ? color(x, y) : color,
          typeof kind === 'function' ? kind(x, y) : kind, typeof hp === 'function' ? hp(x, y) : hp);
      }
    },
    cut(predicate) {
      for (const [key, brick] of bricks) if (predicate(brick.col, brick.row)) bricks.delete(key);
    },
    role(predicate, kind, hp = KIND_HP[kind]) {
      for (const brick of [...bricks.values()]) if (predicate(brick.col, brick.row)) api.add(brick.col, brick.row, brick.color, kind, hp);
    },
    finish() {
      return { name: `关卡${index} - ${title}`, difficulty, briefing, gridWidth: width, gridHeight: height,
        ballSpeed, paddleWidth, lives: 3,
        bricks: [...bricks.values()].sort((a, b) => a.row - b.row || a.col - b.col) };
    },
  };
  return api;
}

function ring(x, y, cx, cy, rx, ry, thickness = 0.12) {
  return Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) <= thickness;
}
function diamondRing(x, y, cx, cy, radius, thickness = 0.6) {
  return Math.abs(Math.abs(x - cx) + Math.abs(y - cy) - radius) <= thickness;
}
function rect(l, x0, y0, x1, y1, color = CYAN, kind = 'normal', hp) {
  l.paint((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, color, kind, hp);
}
function line(l, ax, ay, bx, by, color = CYAN, thickness = 0.55, kind = 'normal') {
  const dx = bx - ax; const dy = by - ay;
  l.paint((x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= thickness;
  }, color, kind);
}
function reactor(l, x, y, color = CYAN, surround = true) {
  if (surround) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) l.add(x + dx, y + dy, color);
  l.add(x, y, GOLD, 'reactor');
}
function chamber(l, x0, y0, x1, y1, color, gate = 'bottom') {
  l.paint((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x === x0 || x === x1 || y === y0 || y === y1), color);
  l.role((x, y) => y === y1 && x >= x0 && x <= x1, 'armor');
  const cx = Math.floor((x0 + x1) / 2); const cy = Math.floor((y0 + y1) / 2);
  if (gate === 'bottom') l.cut((x, y) => y === y1 && x >= cx && x <= cx + 1);
  if (gate === 'left') l.cut((x, y) => x === x0 && y >= cy && y <= cy + 1);
  if (gate === 'right') l.cut((x, y) => x === x1 && y >= cy && y <= cy + 1);
}

const campaign = [];

// 01: Armored lower arcs reject brute force. Two open flanks lead to the soft backs.
{
  const l = level(1, '星环启航', 1, '从星环两侧切入，绕到银色装甲背后；挡板边缘能打出更斜的回球。', 325, 96);
  l.paint((x, y) => ring(x, y, 11.5, 8, 10, 7.2, 0.10), VIOLET);
  l.paint((x, y) => ring(x, y, 11.5, 8, 5.8, 4.3, 0.15), CYAN);
  l.role((x, y) => y >= 9, 'armor');
  l.cut((x, y) => (x <= 3 || x >= 20) && y >= 7 && y <= 9);
  rect(l, 10, 6, 13, 9, ROSE);
  for (const [x, y] of [[1, 1], [20, 1], [1, 17], [20, 17]]) rect(l, x, y, x + 2, y + 1, BLUE);
  campaign.push(l.finish());
}

// 02: Four petals teach deliberate reactor shots. The bounded burst damages the eight neighboring cells.
{
  const l = level(2, '光子花园', 1, '金色反应芯需要两次命中；优先击破它，周围冲击会拆掉邻砖。', 332, 94);
  for (const [x0, y0, color, gate] of [[1, 1, CYAN, 'right'], [15, 1, ROSE, 'left'], [1, 11, ROSE, 'right'], [15, 11, CYAN, 'left']]) {
    chamber(l, x0, y0, x0 + 7, y0 + 6, color, gate);
    l.role((x, y) => x >= x0 && x <= x0 + 7 && y === y0, 'armor');
    reactor(l, x0 + 3, y0 + 3, color);
    l.add(x0 + 4, y0 + 3, color, 'armor');
  }
  rect(l, 11, 4, 12, 6, VIOLET);
  rect(l, 11, 13, 12, 15, VIOLET);
  campaign.push(l.finish());
}

// 03: Opposite open gates, staggered shelves and two cores create a left/right commitment.
{
  const l = level(3, '双子脉冲', 2, '先清一座反应塔；中央通道便于转场，超新星留给塔底的装甲横梁。', 339, 92);
  for (const [x0, color, gate] of [[1, CYAN, 'right'], [14, ROSE, 'left']]) {
    chamber(l, x0, 1, x0 + 8, 18, color, gate);
    for (const y of [5, 10, 15]) {
      rect(l, x0 + 2, y, x0 + 6, y, VIOLET);
      l.role((x, row) => row === y && x >= x0 + 2 && x <= x0 + 6, 'armor');
      l.cut((x, row) => row === y && x === x0 + (y === 10 ? 2 : 6));
    }
    reactor(l, x0 + 4, 3, color);
    reactor(l, x0 + 4, 13, color);
    l.role((x, y) => x === x0 + (gate === 'left' ? 8 : 0) && y >= 5 && y <= 14, 'armor');
  }
  campaign.push(l.finish());
}

// 04: Alternating three-cell apertures require repeated angle changes.
{
  const l = level(4, '棱镜航道', 2, '缺口左右交错；薄荷色加速砖会催快回球，过弯后先准备接球。', 346, 90);
  for (let band = 0; band < 6; band++) {
    const y = 1 + band * 3; const gate = band % 2 ? 16 : 5;
    rect(l, 1, y, 22, y, band % 2 ? VIOLET : CYAN);
    rect(l, band % 2 ? 1 : 15, y + 1, band % 2 ? 8 : 22, y + 1, BLUE, 'armor');
    l.cut((x, row) => row >= y && row <= y + 1 && x >= gate && x <= gate + 2);
    l.add(gate - 1, y, MINT, 'accelerator');
    l.add(gate + 3, y, BLUE, 'armor');
    if (band === 1 || band === 4) reactor(l, band % 2 ? 4 : 19, y, VIOLET, false);
  }
  campaign.push(l.finish());
}

// 05: Swept wings push the ball outward; the central rib rewards a precise vertical entry.
{
  const l = level(5, '天穹之翼', 2, '从翼片之间切入中央反应芯；外缘加速砖会把快球送向两侧。', 353, 88);
  for (const side of [-1, 1]) for (let feather = 0; feather < 4; feather++) {
    const x0 = 11.5 + side * 2.5, y0 = 4 + feather * 4;
    const x1 = 11.5 + side * (10.5 - feather), y1 = 1 + feather * 4;
    line(l, x0, y0, x1, y1, feather % 2 ? BLUE : CYAN, 0.9);
    l.role((x, y) => y >= y0 - 1 && y <= y0 && Math.abs(x - x0) <= 3, 'armor');
    l.add(x1, y1, MINT, 'accelerator');
  }
  chamber(l, 9, 2, 14, 10, VIOLET, 'bottom');
  reactor(l, 11, 5, ROSE);
  reactor(l, 12, 8, ROSE);
  rect(l, 10, 13, 13, 17, ROSE, 'armor');
  l.cut((x, y) => x === 11 && y >= 14);
  campaign.push(l.finish());
}

// 06: Nine chambers rotate their entrances. Reactor crosses soften the nearest face.
{
  const l = level(6, '回声矩阵', 3, '九座反应舱的入口朝向不同；先打通一列，再利用横向通道逐舱拆解。', 360, 86, 26, 22);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const x0 = 1 + col * 8, y0 = 1 + row * 7;
    chamber(l, x0, y0, x0 + 4, y0 + 4, [CYAN, VIOLET, ROSE][(col + row) % 3], ['bottom', 'right', 'left'][(row + col) % 3]);
    reactor(l, x0 + 2, y0 + 2, CYAN);
    l.role((x, y) => y === y0 && x >= x0 && x <= x0 + 4, 'armor');
    if (row === 1 && col !== 1) l.add(x0 + 4, y0 + 1, MINT, 'accelerator');
  }
  campaign.push(l.finish());
}

// 07: Three interrupted diamonds funnel the player toward the defended stellar cross.
{
  const l = level(7, '超新星冠', 3, '星冠的斜向裂口通向内层；先破四枚金色弱点，再处理三层装甲尖端。', 367, 84, 26, 22);
  for (const [radius, color] of [[11, VIOLET], [7, CYAN], [3, ROSE]]) {
    l.paint((x, y) => diamondRing(x, y, 12.5, 10, radius, 0.65), color);
    l.role((x, y) => diamondRing(x, y, 12.5, 10, radius, 0.65) && y > 10, 'armor');
  }
  l.cut((x, y) => (x === 8 || x === 17) && y >= 12 && y <= 16);
  for (const [x, y] of [[12, 3], [6, 10], [19, 10], [12, 17]]) reactor(l, x, y, ROSE);
  for (const [x, y] of [[2, 3], [22, 3], [2, 17], [22, 17]]) rect(l, x, y, x + 1, y + 1, BLUE, 'armor');
  l.add(12, 20, ARMOR, 'armor', 3); l.add(13, 20, ARMOR, 'armor', 3);
  campaign.push(l.finish());
}

// 08: Sparse pinwheel blades create long changing shot corridors.
{
  const l = level(8, '引力涡旋', 3, '顺着三条旋臂的空隙深入；加速点集中在臂尖，留出回板时间。', 374, 84, 26, 22);
  const cx = 12.5, cy = 10;
  l.paint((x, y) => {
    const radius = Math.hypot(x - cx, (y - cy) * 1.1);
    return radius >= 3 && radius <= 11.5 && Math.cos(3 * Math.atan2((y - cy) * 1.1, x - cx) - radius * 0.6) > 0.38;
  }, (x, y) => x < cx ? VIOLET : y < cy ? CYAN : ROSE);
  l.role((x, y) => (x + 2 * y) % 5 <= 1, 'armor');
  for (const [x, y] of [[5, 6], [20, 9], [10, 18]]) reactor(l, x, y, BLUE);
  for (const [x, y] of [[2, 8], [21, 4], [17, 19]]) l.add(x, y, MINT, 'accelerator');
  reactor(l, 12, 10, ROSE);
  campaign.push(l.finish());
}

// 09: A maze with explicit two- or three-cell doors; every partition has a route around it.
{
  const l = level(9, '霓虹迷城', 4, '先沿左右巷道绕过横墙；反应芯能拆薄门框，别在底部装甲上反复直撞。', 381, 82, 26, 22);
  chamber(l, 1, 1, 24, 20, BLUE, 'bottom');
  for (const x of [8, 17]) {
    rect(l, x, 2, x, 19, CYAN);
    l.role((col, y) => col === x && y % 4 <= 1, 'armor');
    l.cut((col, y) => col === x && (y >= (x === 8 ? 5 : 13) && y <= (x === 8 ? 7 : 15)));
  }
  for (const [x0, x1, y, gate] of [[2, 16, 8, 4], [9, 23, 13, 20], [2, 7, 15, 4], [18, 23, 6, 20]]) {
    rect(l, x0, y, x1, y, VIOLET, 'armor');
    l.cut((x, row) => row === y && x >= gate && x <= gate + 1);
  }
  for (const [x, y] of [[4, 4], [12, 4], [21, 10], [12, 17], [4, 18]]) reactor(l, x, y, ROSE);
  for (const [x, y] of [[1, 10], [24, 16], [17, 4], [8, 18]]) l.add(x, y, MINT, 'accelerator');
  l.cut((x, y) => (x === 1 || x === 24) && y >= 10 && y <= 12);
  campaign.push(l.finish());
}

// 10: Small separated islands discourage parking beneath one long ricochet chamber.
{
  const l = level(10, '星云群岛', 4, '在六座孤岛之间调整落点；金色核心炸开周围邻砖，抢道具前先判断回球。', 388, 80, 26, 22);
  for (const [cx, cy, color] of [[4, 4, CYAN], [13, 3, ROSE], [21, 7, VIOLET], [11, 11, BLUE], [4, 18, VIOLET], [20, 18, CYAN]]) {
    l.paint((x, y) => Math.abs(x - cx) + Math.abs(y - cy) <= 3, color);
    l.role((x, y) => Math.abs(x - cx) + Math.abs(y - cy) <= 3 && y >= cy + 1, 'armor');
    reactor(l, cx, cy, color);
    l.add(cx - 3, cy, MINT, 'accelerator');
    l.cut((x, y) => x === cx && y === cy + 3);
  }
  campaign.push(l.finish());
}

// 11: A large diamond scaffold and two satellite shrines share diagonal access lanes.
{
  const l = level(11, '分形圣殿', 4, '中央圣殿与两侧晶室相连；从斜向裂口进入，避免一次同时激活多个加速点。', 394, 80, 26, 22);
  l.paint((x, y) => diamondRing(x, y, 12.5, 10, 10.5, 0.7) || diamondRing(x, y, 12.5, 10, 6.5, 0.7), VIOLET);
  for (const [x0, color, gate] of [[0, CYAN, 'right'], [20, ROSE, 'left']]) {
    chamber(l, x0, 6, x0 + 5, 14, color, gate);
    reactor(l, x0 + 2, 10, color);
  }
  l.role((x, y) => y >= 12 || (y <= 4 && x >= 8 && x <= 17), 'armor');
  l.cut((x, y) => (x === 8 || x === 17) && y >= 13 && y <= 16);
  for (const [x, y] of [[12, 6], [12, 14]]) reactor(l, x, y, BLUE);
  rect(l, 11, 9, 14, 11, ROSE, 'armor');
  for (const [x, y] of [[6, 10], [19, 10], [12, 1], [13, 19]]) l.add(x, y, MINT, 'accelerator');
  campaign.push(l.finish());
}

// 12: Turbine spokes create fast side returns; open horizontal service lanes reach the core.
{
  const l = level(12, '恒星熔炉', 5, '先打金色冷却节点，再穿过横向检修口；炉心有三层装甲，超新星要择机释放。', 400, 78, 26, 22);
  const cx = 12.5, cy = 10;
  l.paint((x, y) => ring(x, y, cx, cy, 10.8, 8.8, 0.085), VIOLET);
  l.paint((x, y) => ring(x, y, cx, cy, 6, 5.4, 0.12), CYAN);
  for (const [ax, ay, bx, by] of [[3, 4, 8, 7], [22, 4, 17, 7], [3, 16, 8, 13], [22, 16, 17, 13]]) line(l, ax, ay, bx, by, ROSE, 0.75, 'armor');
  l.role((x, y) => (x < 6 || x > 19) && y >= 6 && y <= 15, 'armor');
  l.cut((x, y) => y >= 10 && y <= 11 && (x < 8 || x > 17));
  rect(l, 11, 8, 14, 12, ROSE, 'armor');
  for (const [x, y] of [[7, 5], [18, 5], [7, 15], [18, 15]]) reactor(l, x, y, BLUE);
  for (const [x, y] of [[12, 1], [13, 19], [2, 8], [23, 13]]) l.add(x, y, MINT, 'accelerator');
  l.add(12, 12, ARMOR, 'armor', 3); l.add(13, 12, ARMOR, 'armor', 3);
  campaign.push(l.finish());
}

// 13: Three interrupted collectors, four weak points, a narrow equator and an armored heart.
{
  const l = level(13, '戴森天幕', 5, '利用外环缺口逐层拆解；四枚金色弱点能削开装甲，最后收束角度击穿核心。', 405, 76, 26, 22);
  const cx = 12.5, cy = 10;
  l.paint((x, y) => ring(x, y, cx, cy, 11.8, 9.5, 0.065), VIOLET);
  l.paint((x, y) => ring(x, y, cx, cy, 8, 7, 0.09), CYAN);
  l.paint((x, y) => ring(x, y, cx, cy, 11.8, 3.3, 0.13), ROSE);
  l.role((x, y) => y >= 11 || (x >= 8 && x <= 17 && y <= 4), 'armor');
  l.cut((x, y) => (x >= 5 && x <= 6 || x >= 19 && x <= 20) && (y < 5 || y > 15));
  l.cut((x, y) => y >= 10 && y <= 11 && (x < 7 || x > 18));
  l.cut((x, y) => x >= 12 && x <= 13 && y >= 15);
  rect(l, 10, 8, 15, 12, BLUE, 'armor');
  for (const [x, y] of [[8, 7], [17, 7], [8, 13], [17, 13]]) reactor(l, x, y, ROSE);
  for (const [x, y] of [[2, 6], [23, 6], [5, 16], [20, 16], [12, 3], [13, 17]]) l.add(x, y, MINT, 'accelerator');
  for (const x of [11, 14]) l.add(x, 12, ARMOR, 'armor', 3);
  campaign.push(l.finish());
}

const outputDirectory = path.join(__dirname, '..', 'levels');
for (const [index, stage] of campaign.entries()) {
  const positions = new Set();
  let totalHP = 0;
  for (const brick of stage.bricks) {
    const key = `${brick.row},${brick.col}`;
    if (positions.has(key)) throw new Error(`${stage.name}: duplicate ${key}`);
    positions.add(key);
    if (brick.row < 0 || brick.row >= stage.gridHeight || brick.col < 0 || brick.col >= stage.gridWidth) throw new Error(`${stage.name}: out-of-bounds ${key}`);
    if (![1, 2, 3].includes(brick.hp) || !(brick.kind in KIND_HP)) throw new Error(`${stage.name}: invalid brick ${key}`);
    if (brick.kind !== 'armor' && brick.hp !== KIND_HP[brick.kind]) throw new Error(`${stage.name}: incorrect role HP ${key}`);
    if (!/^#[a-f0-9]{6}$/i.test(brick.color)) throw new Error(`${stage.name}: invalid color`);
    if (90 + (brick.row + 1) * 357 / stage.gridWidth - 2 > 400) throw new Error(`${stage.name}: brick field too low`);
    totalHP += brick.hp;
  }
  if (totalHP / stage.bricks.length > 1.72 || totalHP / stage.bricks.length < 1.25) throw new Error(`${stage.name}: HP distribution outside tactical budget`);
  if (stage.bricks.length < 90 || stage.bricks.length > 220) throw new Error(`${stage.name}: inappropriate brick count ${stage.bricks.length}`);
  const filename = `level-${String(index + 1).padStart(2, '0')}.json`;
  const header = JSON.stringify({ ...stage, bricks: undefined }, null, 2).slice(0, -2);
  const encodedBricks = stage.bricks.map((brick) => `    ${JSON.stringify(brick)}`).join(',\n');
  fs.writeFileSync(path.join(outputDirectory, filename), `${header},\n  "bricks": [\n${encodedBricks}\n  ]\n}\n`);
}
console.table(campaign.map((stage) => ({
  name: stage.name, grid: `${stage.gridWidth}×${stage.gridHeight}`, bricks: stage.bricks.length,
  hp: stage.bricks.reduce((sum, brick) => sum + brick.hp, 0),
  averageHP: +(stage.bricks.reduce((sum, brick) => sum + brick.hp, 0) / stage.bricks.length).toFixed(2),
  armor: stage.bricks.filter((brick) => brick.kind === 'armor').length,
  reactor: stage.bricks.filter((brick) => brick.kind === 'reactor').length,
  accelerator: stage.bricks.filter((brick) => brick.kind === 'accelerator').length,
  bottom: +(Math.max(...stage.bricks.map((brick) => 90 + (brick.row + 1) * 357 / stage.gridWidth - 2))).toFixed(1),
  speed: stage.ballSpeed, paddle: stage.paddleWidth, lives: stage.lives,
})));

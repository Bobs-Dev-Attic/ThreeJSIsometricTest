/**
 * Grid-based navigation for the forest.
 *
 * The world is rasterised into a square grid of walkable / blocked cells.
 * Every obstacle is inflated by the agent's radius so the character's body
 * never overlaps a tree or rock. `findPath` runs A* (8-directional, no corner
 * cutting) and then a line-of-sight pass to smooth the result into a short
 * list of natural waypoints.
 */

const SQRT2 = Math.SQRT2;

// A tiny binary min-heap keyed by f-score, storing cell indices.
class MinHeap {
  constructor() {
    this.items = []; // [f, index]
  }
  get size() {
    return this.items.length;
  }
  push(f, idx) {
    const a = this.items;
    a.push([f, idx]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < n && a[l][0] < a[s][0]) s = l;
        if (r < n && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

export class NavGrid {
  /**
   * @param {Array<{x:number,z:number,radius:number}>} obstacles
   * @param {object} opts
   * @param {number} opts.halfSize  world extends from -halfSize..halfSize on x/z
   * @param {number} opts.cellSize  size of each grid cell in world units
   * @param {number} opts.agentRadius  half-width of the character
   */
  constructor(obstacles, { halfSize = 40, cellSize = 0.5, agentRadius = 0.5, gridMargin = 0.2 } = {}) {
    this.halfSize = halfSize;
    this.cellSize = cellSize;
    this.agentRadius = agentRadius;
    this.cols = Math.ceil((halfSize * 2) / cellSize);
    this.blocked = new Uint8Array(this.cols * this.cols);

    // Obstacles inflated by the agent radius — the true no-go discs for the
    // character's centre. Used for exact line-of-sight (not just the grid).
    this.inflated = obstacles.map((o) => ({ x: o.x, z: o.z, r: o.radius + agentRadius }));

    // The grid marks blocked with an *extra* margin so that the straight
    // segment between any two adjacent walkable cell centres can never dip
    // inside a true inflated disc — i.e. raw A* steps are clear by construction.
    for (const o of obstacles) {
      const r = o.radius + agentRadius + gridMargin;
      const minX = Math.floor((o.x - r + halfSize) / cellSize);
      const maxX = Math.floor((o.x + r + halfSize) / cellSize);
      const minZ = Math.floor((o.z - r + halfSize) / cellSize);
      const maxZ = Math.floor((o.z + r + halfSize) / cellSize);
      const r2 = r * r;
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.cols) continue;
          const wx = -halfSize + (cx + 0.5) * cellSize;
          const wz = -halfSize + (cz + 0.5) * cellSize;
          const dx = wx - o.x;
          const dz = wz - o.z;
          if (dx * dx + dz * dz <= r2) this.blocked[cz * this.cols + cx] = 1;
        }
      }
    }
  }

  inBounds(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.cols;
  }

  isWalkable(cx, cz) {
    return this.inBounds(cx, cz) && this.blocked[cz * this.cols + cx] === 0;
  }

  cellX(x) {
    return Math.floor((x + this.halfSize) / this.cellSize);
  }
  cellZ(z) {
    return Math.floor((z + this.halfSize) / this.cellSize);
  }
  worldX(cx) {
    return -this.halfSize + (cx + 0.5) * this.cellSize;
  }
  worldZ(cz) {
    return -this.halfSize + (cz + 0.5) * this.cellSize;
  }

  // Nearest walkable cell to (cx,cz), searched in expanding rings. Used when a
  // click lands on/inside an obstacle, or the agent is nudged into one.
  nearestWalkable(cx, cz, maxRing = 16) {
    if (this.isWalkable(cx, cz)) return [cx, cz];
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue; // ring edge only
          if (this.isWalkable(cx + dx, cz + dz)) return [cx + dx, cz + dz];
        }
      }
    }
    return null;
  }

  // Exact line-of-sight test: the segment is clear only if it never enters any
  // obstacle's inflated disc. This is the true clearance the character keeps,
  // independent of grid resolution, so smoothing can't shortcut past a trunk.
  hasLineOfSight(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const segLen2 = dx * dx + dz * dz;

    for (const o of this.inflated) {
      // Closest point on the segment to the obstacle centre.
      let t = segLen2 === 0 ? 0 : ((o.x - ax) * dx + (o.z - az) * dz) / segLen2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const ddx = px - o.x;
      const ddz = pz - o.z;
      if (ddx * ddx + ddz * ddz < o.r * o.r) return false;
    }
    return true;
  }

  /**
   * @param {{x:number,z:number}} start
   * @param {{x:number,z:number}} goal
   * @returns {Array<{x:number,z:number}>|null} world-space waypoints, or null
   */
  findPath(start, goal) {
    const startCell = this.nearestWalkable(this.cellX(start.x), this.cellZ(start.z));
    const goalCell = this.nearestWalkable(this.cellX(goal.x), this.cellZ(goal.z));
    if (!startCell || !goalCell) return null;

    const cols = this.cols;
    const startIdx = startCell[1] * cols + startCell[0];
    const goalIdx = goalCell[1] * cols + goalCell[0];
    if (startIdx === goalIdx) return [{ x: goal.x, z: goal.z }];

    const g = new Float64Array(cols * cols).fill(Infinity);
    const came = new Int32Array(cols * cols).fill(-1);
    const closed = new Uint8Array(cols * cols);
    const open = new MinHeap();

    const heuristic = (cx, cz) => {
      const dx = Math.abs(cx - goalCell[0]);
      const dz = Math.abs(cz - goalCell[1]);
      return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
    };

    g[startIdx] = 0;
    open.push(heuristic(startCell[0], startCell[1]), startIdx);

    const NEIGHBORS = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
    ];

    let found = false;
    while (open.size > 0) {
      const [, current] = open.pop();
      if (current === goalIdx) {
        found = true;
        break;
      }
      if (closed[current]) continue;
      closed[current] = 1;

      const cx = current % cols;
      const cz = (current - cx) / cols;

      for (const [dx, dz, cost] of NEIGHBORS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!this.isWalkable(nx, nz)) continue;
        // Don't cut across the corner of a blocked cell.
        if (dx !== 0 && dz !== 0) {
          if (!this.isWalkable(cx + dx, cz) || !this.isWalkable(cx, cz + dz)) continue;
        }
        const nIdx = nz * cols + nx;
        if (closed[nIdx]) continue;
        const tentative = g[current] + cost;
        if (tentative < g[nIdx]) {
          g[nIdx] = tentative;
          came[nIdx] = current;
          open.push(tentative + heuristic(nx, nz), nIdx);
        }
      }
    }

    if (!found) return null;

    // Reconstruct cell path (goal -> start), then reverse.
    const cells = [];
    for (let c = goalIdx; c !== -1; c = came[c]) {
      cells.push(c);
      if (c === startIdx) break;
    }
    cells.reverse();

    // Convert to world points; anchor the ends to the true start/goal.
    const pts = cells.map((c) => {
      const cx = c % cols;
      const cz = (c - cx) / cols;
      return { x: this.worldX(cx), z: this.worldZ(cz) };
    });
    pts[0] = { x: start.x, z: start.z };
    if (this.isWalkable(this.cellX(goal.x), this.cellZ(goal.z))) {
      pts[pts.length - 1] = { x: goal.x, z: goal.z };
    }

    return this._smooth(pts);
  }

  // Greedy string-pulling: from each anchor, advance to the *farthest* later
  // waypoint still reachable in a clear straight line. Every emitted segment is
  // therefore line-of-sight verified.
  _smooth(pts) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.hasLineOfSight(pts[i].x, pts[i].z, pts[j].x, pts[j].z)) {
        j--;
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}

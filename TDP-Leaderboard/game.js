
class Game {
  constructor(levelMap, replayData) {
    this.div = {
      floor: [],
      rail: [],
      wall: [],
      goal: [],
    };
    this.keys = {};
    this.lastInputChangeFrame = 0;
    this.frame = 0;
    this.replayControlState = [];
    this.controls = {
      up: 38,
      down: 40,
      left: 37,
      right: 39,
      jump: 32,
      spin: 90,
      blink: 88,
      restart: 82,
      nextLevel: 13,
      nextLevel2: 10,
      skipLevel: 83
    };
    this.controlTypes = Object.keys(this.controls);
    this.player = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      d: 0.8,//diameter
      r: 0.98,//resistence
      ar: 0.98,//air resistence
      a: 0.01,//acceleration
      az: 0.1,//acceleration Z
      g: 0.003,//gravity
      ms: 100,//max spin
      sb: 0.3,//spin boost
      rest: 3,//resting 'speed'
      mx: 1,//max acceleration
      blink: 30,//blink duration
      blinkV: 0.3,
      blinkCooldown: 300,
    };
    this.timer = 0;
    this.startedTime = false;

    this.jump = false;
    this.doubleJump = false;
    this.spinning = false;
    this.spin = 0;
    this.blinking = 0;
    this.blinkTimer = false;
    this.blinked = false;

    this.finish = false;

    this.setup();
    this.setupReplay(levelMap, replayData);
  }
  
  maxFromRow(row) {
    let maxR = 0;
    let count = 0;
    let cur = 0;
    let x = 0;
    let X = 0;
    let w = 0;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === cur) {
        count += cur;
      }
      else {
        if (count > maxR) {
          maxR = count;
          x = X;
          w = maxR / cur;
        }
        X = i;
        cur = row[i];
        count = cur;
      }
    }
    if (count > maxR) {
      maxR = count;
      x = X;
      w = maxR / cur;
    }
    return [x, w, maxR];
  };
  maxRectangle(A) {
    let C = A[0].length;
    let R = A.length;

    let maxR = this.maxFromRow(A[0]);
    let result = maxR[1];
    let x = maxR[0], y = 0, w = maxR[1], h = 1;

    for (let i = 1; i < R; i++) {
      for (let j = 0; j < C; j++) {
        if (A[i][j] === 1) {
          A[i][j] += A[i - 1][j];
        }
      }
      maxR = this.maxFromRow(A[i]);
      if (maxR[2] > result) {
        result = maxR[2];
        x = maxR[0];
        y = i - A[i][x] + 1;
        h = A[i][x];
        w = maxR[1];
      }
    }

    return { x: x, y: y, w: w, h: h };
  }
  rectDivision(chars) {
    let rects = [];
    let a = 1;
    while (a > 0) {
      let tgrid = [];
      let currentMap = this.currentMap;
      for (let i = 0; i < currentMap.grid.length; i++) {
        tgrid.push([]);
        for (let j = 0; j < currentMap.grid[i].length; j++) {
          tgrid[i].push(
            chars.indexOf(currentMap.grid[i][j]) >= 0 ? 1 : 0);
        }
      }
      for (let i = 0; i < rects.length; i++) {
        for (let x = rects[i].w - 1; x >= 0; x--) {
          for (let y = rects[i].h - 1; y >= 0; y--) {
            tgrid[rects[i].y + y][rects[i].x + x] = i + 2;
          }
        }
      }

      for (var i = 0; i < rects.length; i++) {
        for (var x = rects[i].w - 1; x >= 0; x--) {
          for (var y = rects[i].h - 1; y >= 0; y--) {
            tgrid[rects[i].y + y][rects[i].x + x] = 0;
          }
        }
      }

      rects.push(this.maxRectangle(tgrid));
      a = rects[rects.length - 1].w;

      if (a === 0) {
        rects.pop();
      }
    }
    return rects;
  }
  pointLineDist(x0, y0, x1, y1, x2, y2, r) {
    let b = -1;
    let a = (y2 - y1) / (x2 - x1);
    let c = y1 - x1 * a;

    let x = (b * (b * x0 - a * y0) - a * c) / (a * a + b * b);
    let y = (a * (-b * x0 + a * y0) - b * c) / (a * a + b * b);

    let sq = n => Math.pow(n, 2);
    let d = Math.sqrt(sq(x - x0) + sq(y - y0));
    if (d < r) {
      if (x1 < x2) {
        if (x1 < x && x < x2) {
          return { x: x, y: y, dist: d };
        }
      }
      else if (x1 > x && x > x2) {
        return { x: x, y: y, dist: d };
      }
      let da = Math.sqrt(sq(x0 - x1) + sq(y0 - y1));
      let db = Math.sqrt(sq(x0 - x2) + sq(y0 - y2));
      if (da < db && da < r) {
        return { x: x1, y: y1, dist: da };
      }
      if (db < r) {
        return { x: x2, y: y2, dist: db };
      }
    }
  };
  shapeIntersect(points, sz, x, y, z, r) {
    if (z >= sz) { return; }
    let closest = r;
    let closestP = { x: 0, y: 0 };
    for (let i = 1; i < points.length; i++) {
      let cl = this.pointLineDist(x, y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, r);
      if (cl && cl.dist < closest) {
        closest = cl.dist;
        closestP = { x: cl.x, y: cl.y };
      }
    }
    let cl = this.pointLineDist(x, y, points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y, r);
    if (cl && cl.dist < closest) {
      closest = cl.dist;
      closestP = { x: cl.x, y: cl.y };
    }
    if (closest < r) {
      return closestP;
    }
  }
  playerCollision(i, j) {
    if (i < 0 || j < 0) { return; }
    let t = this.currentMap.grid.length > j ? (this.currentMap.grid[j].length > i ? this.currentMap.grid[j][i] : false) : false;
    if (t === false) { return; }
    let temp;
    let shapeIntersect = this.shapeIntersect.bind(this);
    let player = this.player;
    switch (t) {
      case ('+'):
      case ('G'):
      case ('S'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 0, player.x, player.y, player.z, player.d / 2);
        break;
      case ('#'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 1, player.x, player.y, player.z, player.d / 2);
        break;
      case ('w'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 5, player.x, player.y, player.z, player.d / 2);
        break;
      case ('['):
        temp = shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 0, player.x, player.y, player.z, player.d / 2);
        if (temp) { return temp; }
      case ('.'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 1, player.x, player.y, player.z, player.d / 2);
        break;
      case (']'):
        temp = shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 0, player.x, player.y, player.z, player.d / 2);
        if (temp) { return temp; }
      case (','):
        return shapeIntersect([
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 1, player.x, player.y, player.z, player.d / 2);
        break;
      case ('}'):
        temp = shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 0, player.x, player.y, player.z, player.d / 2);
        if (temp) { return temp; }
      case ('l'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
        ], 1, player.x, player.y, player.z, player.d / 2);
        break;
      case ('{'):
        temp = shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i + 0.5, y: j + 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 0, player.x, player.y, player.z, player.d / 2);
        if (temp) { return temp; }
      case ('r'):
        return shapeIntersect([
          { x: i - 0.5001, y: j - 0.5 },
          { x: i + 0.5001, y: j - 0.5 },
          { x: i - 0.5, y: j + 0.5 },
        ], 1, player.x, player.y, player.z, player.d / 2);
        break;
    }
  }
  getGround(x, y) {
    let currentMap = this.currentMap;
    let X = x + 0.5 >> 0;
    let Y = y + 0.5 >> 0;
    if (X < 0 || Y < 0 || Y >= currentMap.grid.length || X >= currentMap.grid[Y].length) {
      return -100;
    }
    switch (currentMap.grid[Y][X]) {
      case (' '):
        return -100;
      case ('#'):
        return 1;
      case ('w'):
        return 5;
      case ('['):
        return y - Y > x - X ? 1 : 0;
      case (']'):
        return Y - y > x - X ? 0 : 1;
      case ('l'):
        return y - Y > x - X ? -100 : 1;
      case ('r'):
        return Y - y > x - X ? 1 : -100;
      case ('}'):
        return y - Y > x - X ? 0 : 1;
      case ('{'):
        return Y - y > x - X ? 1 : 0;
      case ('.'):
        return y - Y > x - X ? 1 : -100;
      case (','):
        return Y - y > x - X ? -100 : 1;
      case ('G'):
        if (this.player.z >= 0) {
          this.finish = true;
        }
        return 0;
      default:
        return 0;
    }
  }
  setup() {
  }
  setupReplay(levelMap, replayData) {
    let keys = this.keys;
    let controls = this.controls;
    keys[controls.up] = false;
    keys[controls.down] = false;
    keys[controls.left] = false;
    keys[controls.right] = false;

    this.lastInputChangeFrame = 0;
    this.frame = 0;
    this.replayControlState = replayData;

    this.timer = 0;
    this.startedTime = false;

    this.player.vx = 0;
    this.player.vy = 0;

    this.finish = false;
    this.finishTransition = 0;

    this.jump = false;
    this.doubleJump = false;
    this.spinning = false;
    this.spin = 0;
    this.blinking = 0;
    this.blinked = false;

    this.currentMap = levelMap;
    let currentMap = this.currentMap;
    for (let i = 0; i < currentMap.grid.length; i++) {
      for (let j = 0; j < currentMap.grid[i].length; j++) {
        if (currentMap.grid[i][j] === 'S') {
          this.player.x = j;
          this.player.y = i;
          this.player.z = 0;
          i = 100;
          break;
        }
      }
    }
    this.div.floor = this.rectDivision('+S[]{}');
    this.div.rail = this.rectDivision('#');
    this.div.wall = this.rectDivision('w');
    this.div.goal = this.rectDivision('G');
  }
  stepPlayer() {

    if (this.finish) { return; }
    let controls = this.controls;
    if (this.frame === 0 || this.replayControlState[this.frame]) {
      this.lastInputChangeFrame = this.frame;

      //Read the keys
      let controlState = this.replayControlState[this.frame];
      [...controlState.keys()].forEach(index => this.keys[this.controls[this.controlTypes[index]]] = controlState[index]);
    }
    let keys = this.keys;
    this.frame++;
    if (!this.startedTime && (keys[controls.up] || keys[controls.down] || keys[controls.left] || keys[controls.right])) {
      this.startedTime = true;
    }

    if (this.startedTime) {
      this.timer++;
    }
    let player = this.player;
    if (player.z < -20) {
      this.setupLevel(onLevel, true);
    }
    let PI = Math.PI;
    let cos = Math.cos;
    let sin = Math.sin;
    let ground = this.getGround(player.x, player.y);
    for (let i = 0; i < PI * 2; i += PI / 4) {
      let temp = this.getGround(player.x + cos(i) * (player.d - 0.001) / 2, player.y + sin(i) * (player.d - 0.001) / 2, 1);
      if (temp > ground && temp <= player.z) {
        ground = temp;
      }
    }
    if (this.spinning) {
      this.spin++;
      if (this.spin > player.ms) {
        this.spin = player.ms;
      }
    } else if (player.z > ground && keys[controls.spin]) {
      this.spinning = true;
    }


    let v = (!!keys[controls.left] ^ !!keys[controls.right]) + (!!keys[controls.up] ^ !!keys[controls.down]) > 1 ? 0.7071067811865476 : 1;

    let abs = Math.abs;
    if (keys[controls.up]) {
      player.vy -= v * player.a * (player.mx / (player.rest + abs(player.vy)));
      if (!this.spinning && this.spin) {
        player.vy -= v * player.a * this.spin * player.sb;
      }
    }
    if (keys[controls.down]) {
      player.vy += v * player.a * (player.mx / (player.rest + abs(player.vy)));
      if (!this.spinning && this.spin) {
        player.vy += v * player.a * this.spin * player.sb;
      }
    }
    if (keys[controls.left]) {
      player.vx -= v * player.a * (player.mx / (player.rest + abs(player.vx)));
      if (!this.spinning && this.spin) {
        player.vx -= v * player.a * this.spin * player.sb;
      }
    }
    if (keys[controls.right]) {
      player.vx += v * player.a * (player.mx / (player.rest + abs(player.vx)));
      if (!this.spinning && this.spin) {
        player.vx += v * player.a * this.spin * player.sb;
      }
    }
    if (keys[controls.jump] && !this.jump) {
      if (player.z === ground) {
        this.jump = true;
        player.vz += player.az;
      }
      else if (player.z > ground && !this.doubleJump) {
        this.doubleJump = true;
        player.vz *= -0.25;
        player.vz += player.az;
      }
      else {
        this.jump = true;
      }
    } else if (this.jump && !keys[controls.jump]) {
      this.jump = false;
    }

    if (!this.spinning) { this.spin = 0; }

    player.vz -= player.g;

    player.z += player.vz;


    if (player.z <= ground) {
      player.z = ground;
      player.vz = 0;
      this.spinning = false;
    }

    if (player.z === ground) {
      player.vx *= player.ar;
      player.vy *= player.ar;
      this.doubleJump = false;
    }
    else {
      player.vx *= player.r;
      player.vy *= player.r;
    }

    if (this.blinking < 0) { this.blinking++; }

    if (!keys[controls.blink]) {
      this.blinked = false;
    }

    if (!this.blinked && this.blinking === 0 && keys[controls.blink]) {
      this.blinking = player.blink;
      this.blinked = true;
    }

    if (this.blinking > 0) {
      this.blinking--;
      if (this.blinking === 0) {
        this.blinking = -player.blinkCooldown;
      }

      if (keys[controls.up]) {
        player.y -= player.blinkV * v;
      }
      if (keys[controls.down]) {
        player.y += player.blinkV * v;
      }
      if (keys[controls.left]) {
        player.x -= player.blinkV * v;
      }
      if (keys[controls.right]) {
        player.x += player.blinkV * v;
      }
    }
    else {
      player.x += player.vx;
      player.y += player.vy;
    }

    let x = (player.x >> 0);
    let y = (player.y >> 0);
    for (let i = -1; i < 4; i++) {
      for (let j = -1; j < 4; j++) {
        let collision = this.playerCollision(x + j, y + i);
        if (collision) {
          let v = { x: player.x - collision.x, y: player.y - collision.y };
          let sq = n => Math.pow(n, 2);
          v = { x: v.x / Math.sqrt(sq(v.x) + sq(v.y)), y: v.y / Math.sqrt(sq(v.x) + sq(v.y)) };
          player.x = collision.x + v.x * player.d / 2;
          player.y = collision.y + v.y * player.d / 2;

          let atan2 = Math.atan2;
          let theta1 = atan2(player.vy, player.vx);
          let theta2 = atan2(-v.y, -v.x) + Math.PI / 2;
          let theta = theta2 - (theta1 - theta2);

          let m = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
          player.vx = cos(theta) * m;
          player.vy = sin(theta) * m;
          if (this.spinning) {
            player.vx *= 1 + 0.01 * this.spin;
            player.vy *= 1 + 0.01 * this.spin;
            this.spinning = false;
            this.spin = 0;
          }
        }
      }
    }
  }
}
module.exports = Game;
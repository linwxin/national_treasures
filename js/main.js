/**
 * 砖了个砖 - 最终修复版
 * 彻底解决回拉原点时方块消失问题 + 优化网格映射逻辑
 */

// --- 初始化画布与系统信息 ---
let canvas, ctx;
try {
  canvas = wx.createCanvas();
  ctx = canvas.getContext('2d');
} catch (e) {
  console.error('创建画布失败:', e);
  canvas = { width: 375, height: 667 };
}

let windowInfo;
try {
  windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (e) {
  windowInfo = { screenWidth: 375, screenHeight: 667 };
}

const SCREEN_WIDTH = windowInfo.screenWidth;
const SCREEN_HEIGHT = windowInfo.screenHeight;
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// --- 游戏配置 ---
const GRID_COLS = 10;
const GRID_ROWS = 14;
const TOTAL_BRICKS = 140;
const GAME_PADDING = 20;
const BRICK_SIZE = Math.floor((SCREEN_WIDTH - GAME_PADDING * 2) / GRID_COLS);
const GAME_AREA_HEIGHT = BRICK_SIZE * GRID_ROWS;
// 留出底部空间给按钮，剩余空间居中，这里简单做垂直居中
const START_Y = Math.floor((SCREEN_HEIGHT - GAME_AREA_HEIGHT) / 2) - 30; // 稍微向上偏移一点，给下方按钮留更多空间

const GAME_AREA = {
  x: GAME_PADDING,
  y: START_Y,
  width: BRICK_SIZE * GRID_COLS,
  height: GAME_AREA_HEIGHT
};
const BRICK_TYPES = 6;

export default class Main {
  constructor() {
    this.isGameOver = false;
    this.isWin = false;
    this.score = 0;
    this.grid = [];
    this.selectedBrick = null;
    this.matchingBricks = [];
    this.initialPosition = null; // 改为存储纯数据，而非对象引用
    this.moveDirection = null; 
    this.pushedBricks = [];
    this.pushDirection = null; 
    this.pushedBricksInitialPositions = []; // 存储纯数据快照
    
    // 初始化按钮区域
    this.resetBtnArea = {
      x: SCREEN_WIDTH / 2 - 60,
      y: GAME_AREA.y + GAME_AREA.height + 30,
      width: 120,
      height: 40
    };

    this.initTouchEvents();
    this.init();
    this.loop();
  }
  
  init() {
    this.initGrid();
    this.fillBricks();
  }
  
  restartGame() {
    this.isGameOver = false;
    this.isWin = false;
    this.score = 0;
    this.selectedBrick = null;
    this.matchingBricks = [];
    this.initialPosition = null;
    this.moveDirection = null;
    this.pushedBricks = [];
    this.pushDirection = null;
    this.pushedBricksInitialPositions = [];
    this.init();
  }
  
  initGrid() {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = null;
      }
    }
  }
  
  fillBricks() {
    let bricksAdded = 0;
    while (bricksAdded < TOTAL_BRICKS) {
      const row = Math.floor(Math.random() * GRID_ROWS);
      const col = Math.floor(Math.random() * GRID_COLS);
      if (this.grid[row][col] === null) {
        const type = Math.floor(Math.random() * BRICK_TYPES);
        this.grid[row][col] = {
          type,
          x: GAME_AREA.x + col * BRICK_SIZE,
          y: GAME_AREA.y + row * BRICK_SIZE,
          row, col,
          width: BRICK_SIZE, height: BRICK_SIZE
        };
        bricksAdded++;
      }
    }
  }

  initTouchEvents() {
    wx.onTouchStart(this.onTouchStart.bind(this));
    wx.onTouchMove(this.onTouchMove.bind(this));
    wx.onTouchEnd(this.onTouchEnd.bind(this));
  }
  
  onTouchStart(e) {
    const touch = e.touches ? e.touches[0] : e;
    
    // 检查重置按钮点击（游戏进行中且未结束时可用，或者结束后也可重置？这里假设随时可用）
    if (!this.isGameOver &&
        touch.clientX >= this.resetBtnArea.x && touch.clientX <= this.resetBtnArea.x + this.resetBtnArea.width &&
        touch.clientY >= this.resetBtnArea.y && touch.clientY <= this.resetBtnArea.y + this.resetBtnArea.height) {
      this.shuffleBricks();
      return;
    }

    if (this.isGameOver) {
      const btnX = SCREEN_WIDTH / 2 - 75;
      const btnY = SCREEN_HEIGHT / 2 + 50;
      if (touch.clientX >= btnX && touch.clientX <= btnX + 150 &&
          touch.clientY >= btnY && touch.clientY <= btnY + 50) this.restartGame();
      return;
    }
    
    this.selectedBrick = this.getBrickAtPosition(touch.clientX, touch.clientY);
    if (this.selectedBrick) {
      // 关键修改1：存储纯数据快照（深拷贝），避免引用篡改
      this.initialPosition = {
        row: this.selectedBrick.row,
        col: this.selectedBrick.col,
        x: this.selectedBrick.x,
        y: this.selectedBrick.y,
        type: this.selectedBrick.type // 额外存储类型，防止丢失
      };
      this.moveDirection = null;
      this.pushedBricks = [];
      this.pushDirection = null;
      this.pushedBricksInitialPositions = [];
    }
  }

  /**
   * 辅助：将涉及移动的方块从网格中抹除痕迹
   */
  clearAllRelatedBricksFromGrid() {
    if (this.selectedBrick) {
      // 修复：只有当网格中确实是当前选中砖块时才清除，防止误删已归位的推块
      if (this.grid[this.selectedBrick.row][this.selectedBrick.col] === this.selectedBrick) {
        this.grid[this.selectedBrick.row][this.selectedBrick.col] = null;
      }
    }
    this.pushedBricks.forEach(brick => {
      if (brick && brick.row >=0 && brick.col >=0) { // 关键修改2：增加边界校验
        // 修复：同上，增加一致性校验
        if (this.grid[brick.row][brick.col] === brick) {
          this.grid[brick.row][brick.col] = null;
        }
      }
    });
  }

  /**
   * 辅助：物理复位方块到初始状态
   */
  /**
 * 重置推块到初始位置
 * @param {boolean} includeSelected - 是否同时重置选中砖块（默认false）
 */
  resetPushedBricks(includeSelected = false) {
    // 1. 清空相关砖块的网格引用（避免重复赋值）
    if (this.selectedBrick) {
      if (this.grid[this.selectedBrick.row][this.selectedBrick.col] === this.selectedBrick) {
        this.grid[this.selectedBrick.row][this.selectedBrick.col] = null;
      }
    }
    this.pushedBricks.forEach(brick => {
      if (this.grid[brick.row]?.[brick.col] === brick) {
        this.grid[brick.row][brick.col] = null;
      }
    });

    // 2. 还原推块：row/col 与 x/y 严格同步（基于网格计算坐标，避免偏移）
    this.pushedBricks.forEach((brick, index) => {
      const init = this.pushedBricksInitialPositions[index];
      if (init) {
        brick.row = init.row;
        brick.col = init.col;
        brick.x = GAME_AREA.x + init.col * BRICK_SIZE; // 坐标由网格索引计算
        brick.y = GAME_AREA.y + init.row * BRICK_SIZE;
        // 边界检测：确保网格赋值不越界
        if (init.row >= 0 && init.row < GRID_ROWS && init.col >= 0 && init.col < GRID_COLS) {
          this.grid[init.row][init.col] = brick;
        }
      }
    });

    // 3. 还原选中砖块（可选）
    if (includeSelected && this.selectedBrick && this.initialPosition) {
      this.selectedBrick.row = this.initialPosition.row;
      this.selectedBrick.col = this.initialPosition.col;
      this.selectedBrick.x = GAME_AREA.x + this.initialPosition.col * BRICK_SIZE;
      this.selectedBrick.y = GAME_AREA.y + this.initialPosition.row * BRICK_SIZE;
      this.grid[this.initialPosition.row][this.initialPosition.col] = this.selectedBrick;
    }
  }

  onTouchMove(e) {
    if (this.isGameOver || !this.selectedBrick || !this.initialPosition) return;
    const touch = e.touches ? e.touches[0] : e;
    
    // 1. 确定方向
    if (this.moveDirection === null) {
      const colDiff = Math.floor((touch.clientX - GAME_AREA.x) / BRICK_SIZE) - this.initialPosition.col;
      const rowDiff = Math.floor((touch.clientY - GAME_AREA.y) / BRICK_SIZE) - this.initialPosition.row;
      if (Math.abs(colDiff) > Math.abs(rowDiff) && colDiff !== 0) this.moveDirection = 'horizontal';
      else if (Math.abs(rowDiff) > Math.abs(colDiff) && rowDiff !== 0) this.moveDirection = 'vertical';
      else return;
    }

    // 2. 计算目标偏移
    let targetCol = this.moveDirection === 'horizontal' ? 
        Math.floor((touch.clientX - GAME_AREA.x) / BRICK_SIZE) : this.initialPosition.col;
    let targetRow = this.moveDirection === 'vertical' ? 
        Math.floor((touch.clientY - GAME_AREA.y) / BRICK_SIZE) : this.initialPosition.row;
    
    targetCol = Math.max(0, Math.min(GRID_COLS - 1, targetCol));
    targetRow = Math.max(0, Math.min(GRID_ROWS - 1, targetRow));

    // 3. 处理推动方向切换（核心修复）
    let newPushDir = null;
    if (this.moveDirection === 'horizontal') {
      newPushDir = targetCol > this.initialPosition.col ? 'right' : (targetCol < this.initialPosition.col ? 'left' : null);
    } else {
      newPushDir = targetRow > this.initialPosition.row ? 'down' : (targetRow < this.initialPosition.row ? 'up' : null);
    }

    if (this.pushDirection !== newPushDir) {
      this.resetPushedBricks(); // 先还原所有砖块到网格
      this.pushDirection = newPushDir;
      this.pushedBricks = [];
      this.pushedBricksInitialPositions = [];
      
      if (this.pushDirection) {
        this.pushedBricks = this.findConnectedBricks(this.pushDirection);
        // 关键修改6：存储推块的纯数据快照（深拷贝）
        this.pushedBricksInitialPositions = this.pushedBricks.map(b => ({
          row: b.row, col: b.col, x: b.x, y: b.y, type: b.type
        }));
      }
    }

    // 4. 碰撞检测
    let moveDist = (this.moveDirection === 'horizontal') ? targetCol - this.initialPosition.col : targetRow - this.initialPosition.row;
    let actualDist = moveDist;

    if (this.pushDirection && this.pushedBricks.length > 0) {
      const lastB = this.pushedBricksInitialPositions[this.pushedBricks.length - 1];
      const step = moveDist > 0 ? 1 : -1;
      if (this.moveDirection === 'horizontal') {
        for (let c = lastB.col + step; Math.abs(c - lastB.col) <= Math.abs(moveDist); c += step) {
          if (c < 0 || c >= GRID_COLS || (this.grid[lastB.row][c] && !this.pushedBricks.includes(this.grid[lastB.row][c]) && this.grid[lastB.row][c] !== this.selectedBrick)) {
            actualDist = (c - step) - lastB.col; break;
          }
        }
      } else {
        for (let r = lastB.row + step; Math.abs(r - lastB.row) <= Math.abs(moveDist); r += step) {
          if (r < 0 || r >= GRID_ROWS || (this.grid[r][lastB.col] && !this.pushedBricks.includes(this.grid[r][lastB.col]) && this.grid[r][lastB.col] !== this.selectedBrick)) {
            actualDist = (r - step) - lastB.row; break;
          }
        }
      }
    } else {
      const step = moveDist > 0 ? 1 : -1;
      if (this.moveDirection === 'horizontal') {
        for (let c = this.initialPosition.col + step; Math.abs(c - this.initialPosition.col) <= Math.abs(moveDist); c += step) {
          if (c < 0 || c >= GRID_COLS || (this.grid[this.initialPosition.row][c] && this.grid[this.initialPosition.row][c] !== this.selectedBrick)) {
            actualDist = (c - step) - this.initialPosition.col; break;
          }
        }
      } else {
        for (let r = this.initialPosition.row + step; Math.abs(r - this.initialPosition.row) <= Math.abs(moveDist); r += step) {
          if (r < 0 || r >= GRID_ROWS || (this.grid[r][this.initialPosition.col] && this.grid[r][this.initialPosition.col] !== this.selectedBrick)) {
            actualDist = (r - step) - this.initialPosition.row; break;
          }
        }
      }
    }

    // 5. 执行位移更新（先清网格，再赋值）
    this.clearAllRelatedBricksFromGrid();
    
    // 更新主方块
    this.selectedBrick.col = (this.moveDirection === 'horizontal') ? this.initialPosition.col + actualDist : this.initialPosition.col;
    this.selectedBrick.row = (this.moveDirection === 'vertical') ? this.initialPosition.row + actualDist : this.initialPosition.row;
    this.selectedBrick.x = GAME_AREA.x + this.selectedBrick.col * BRICK_SIZE;
    this.selectedBrick.y = GAME_AREA.y + this.selectedBrick.row * BRICK_SIZE;
    // 关键修改7：更新后立即回填网格，防止引用丢失
    if (this.selectedBrick.row >=0 && this.selectedBrick.col >=0) {
      this.grid[this.selectedBrick.row][this.selectedBrick.col] = this.selectedBrick;
    }

    // 更新推块
    this.pushedBricks.forEach((b, i) => {
      const init = this.pushedBricksInitialPositions[i];
      b.col = (this.moveDirection === 'horizontal') ? init.col + actualDist : init.col;
      b.row = (this.moveDirection === 'vertical') ? init.row + actualDist : init.row;
      b.x = GAME_AREA.x + b.col * BRICK_SIZE;
      b.y = GAME_AREA.y + b.row * BRICK_SIZE;
      if (b.row >=0 && b.col >=0) {
        this.grid[b.row][b.col] = b;
      }
    });
  }
  
  onTouchEnd() {
    if (this.isGameOver || !this.selectedBrick) return;
    
    const r = this.selectedBrick.row, c = this.selectedBrick.col, type = this.selectedBrick.type;
    let match = null;
    const dirs = [{r:-1, c:0}, {r:1, c:0}, {r:0, c:-1}, {r:0, c:1}];
    
    // 原有匹配检测逻辑不变...
    for (const d of dirs) {
      let tr = r + d.r, tc = c + d.c;
      while (tr >= 0 && tr < GRID_ROWS && tc >= 0 && tc < GRID_COLS) {
        const target = this.grid[tr][tc];
        if (target) {
          if (target.type === type && !this.pushedBricks.includes(target)) match = { brick: target, r: tr, c: tc };
          break;
        }
        tr += d.r; tc += d.c;
      }
      if (match) break;
    }
    
    if (match) {
      // 原有消除逻辑不变...
      this.grid[r][c] = null;
      this.grid[match.r][match.c] = null;
      this.score += 20;
      this.checkGameOver();
    } else {
      // 核心修改：一键归位推块+选中砖块
      this.resetPushedBricks(true);
    }
    
    // 清空临时变量（移到最后，确保归位逻辑执行完）
    this.selectedBrick = null; 
    this.initialPosition = null; 
    this.moveDirection = null; 
    this.pushedBricks = []; 
    this.pushDirection = null;
    this.pushedBricksInitialPositions = [];
  }
  
  getBrickAtPosition(x, y) {
    if (x < GAME_AREA.x || x > GAME_AREA.x + GAME_AREA.width || y < GAME_AREA.y || y > GAME_AREA.y + GAME_AREA.height) return null;
    const col = Math.floor((x - GAME_AREA.x) / BRICK_SIZE);
    const row = Math.floor((y - GAME_AREA.y) / BRICK_SIZE);
    return (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) ? this.grid[row][col] : null;
  }
  
  findConnectedBricks(dir) {
    const list = [];
    if (!this.initialPosition) return list; // 兜底
    let r = this.initialPosition.row, c = this.initialPosition.col;
    while (true) {
      if (dir === 'left') c--; 
      else if (dir === 'right') c++; 
      else if (dir === 'up') r--; 
      else if (dir === 'down') r++;
      
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) break;
      const b = this.grid[r][c];
      if (!b) break;
      list.push(b);
    }
    return list;
  }
  
  shuffleBricks() {
    // 1. 收集所有有效砖块
    const validBricks = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) {
          validBricks.push(this.grid[r][c]);
        }
      }
    }

    if (validBricks.length === 0) return;

    // 2. 提取并打乱类型（只交换类型，保持砖块对象引用和位置属性不变，最安全）
    // 或者完全重新分配位置？
    // 如果只交换类型，位置不变，那么砖块的 x,y,row,col 都不用动。
    // 但是用户说“重新分配位置”，视觉上看起来就是砖块换了位置。
    // 实际上交换类型和交换位置在视觉上是等价的，且实现更简单。
    
    // Fisher-Yates 洗牌算法打乱类型
    const types = validBricks.map(b => b.type);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    // 3. 重新赋值类型
    validBricks.forEach((b, i) => {
      b.type = types[i];
    });

    // 4. 重置选中状态，防止状态错乱
    this.selectedBrick = null;
    this.initialPosition = null;
    this.moveDirection = null;
    this.pushedBricks = [];
    this.pushDirection = null;
    this.pushedBricksInitialPositions = [];

    // 5. 检查是否死局（可选，洗牌后最好保证有解，但随机洗牌也能接受）
    this.checkGameOver();
  }

  checkGameOver() {
    let rem = 0, can = false;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b1 = this.grid[r][c];
        if (!b1) continue;
        rem++;
        const dirs = [{r:1, c:0}, {r:-1, c:0}, {r:0, c:1}, {r:0, c:-1}];
        for (const d of dirs) {
          let nr = r + d.r, nc = c + d.c;
          while (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            const b2 = this.grid[nr][nc];
            if (b2) { 
              if (b2.type === b1.type) can = true; 
              break; 
            }
            nr += d.r; nc += d.c;
          }
          if (can) break;
        }
        if (can) break;
      }
      if (can) break;
    }
    if (rem === 0) { this.isGameOver = true; this.isWin = true; }
    else if (!can) { this.isGameOver = true; this.isWin = false; }
  }
  
  showGameOverMessage(isWin) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(isWin ? '恭喜过关！' : '游戏结束', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);
    ctx.font = '24px Arial';
    ctx.fillText(`得分: ${this.score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(SCREEN_WIDTH / 2 - 75, SCREEN_HEIGHT / 2 + 50, 150, 50);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 82);
  }
  
  render() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = '#222222';
    ctx.fillRect(GAME_AREA.x, GAME_AREA.y, GAME_AREA.width, GAME_AREA.height);
    
    ctx.strokeStyle = '#444444';
    for (let i = 0; i <= GRID_COLS; i++) {
      ctx.beginPath(); ctx.moveTo(GAME_AREA.x + i * BRICK_SIZE, GAME_AREA.y);
      ctx.lineTo(GAME_AREA.x + i * BRICK_SIZE, GAME_AREA.y + GAME_AREA.height); ctx.stroke();
    }
    for (let i = 0; i <= GRID_ROWS; i++) {
      ctx.beginPath(); ctx.moveTo(GAME_AREA.x, GAME_AREA.y + i * BRICK_SIZE);
      ctx.lineTo(GAME_AREA.x + GAME_AREA.width, GAME_AREA.y + i * BRICK_SIZE); ctx.stroke();
    }
    
    // 关键修改9：渲染前校验砖块有效性，避免渲染空对象
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b && b.row === r && b.col === c) { // 确保砖块位置与网格一致
          this.drawBrick(b, b === this.selectedBrick);
        }
      }
    }
    ctx.fillStyle = '#ffffff'; ctx.font = '24px Arial'; ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this.score}`, GAME_PADDING, GAME_AREA.y - 10); // 分数位置也跟随调整

    // 绘制重置按钮
    if (!this.isGameOver) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(this.resetBtnArea.x, this.resetBtnArea.y, this.resetBtnArea.width, this.resetBtnArea.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('重置位置', this.resetBtnArea.x + this.resetBtnArea.width / 2, this.resetBtnArea.y + this.resetBtnArea.height / 2);
      ctx.textBaseline = 'alphabetic'; // 还原基线
    }

    if (this.isGameOver) this.showGameOverMessage(this.isWin);
  }
  
  drawBrick(brick, isSelected) {
    const colors = ['#FF5252', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800'];
    ctx.fillStyle = colors[brick.type];
    ctx.fillRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
      ctx.strokeRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height - 4);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const cx = brick.x + brick.width / 2, cy = brick.y + brick.height / 2, r = brick.width / 4;
    switch (brick.type) {
      case 0: ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); break;
      case 1: ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx - r, cy + r); ctx.lineTo(cx + r, cy + r); ctx.fill(); break;
      case 2: ctx.fillRect(cx - r, cy - r, r * 2, r * 2); break;
      case 3: ctx.fillRect(cx - r, cy - r/2, r * 2, r); ctx.fillRect(cx - r/2, cy - r, r, r * 2); break;
      case 4: ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.fill(); break;
      case 5: this.drawStar(cx, cy, 5, r, r/2); break;
    }
  }
  
  drawStar(cx, cy, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3, x, y, step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outer; y = cy + Math.sin(rot) * outer; ctx.lineTo(x, y); rot += step;
      x = cx + Math.cos(rot) * inner; y = cy + Math.sin(rot) * inner; ctx.lineTo(x, y); rot += step;
    }
    ctx.closePath(); ctx.fill();
  }
  
  loop() {
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }
}
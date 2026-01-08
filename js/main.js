/**
 * 砖了个砖游戏主文件
 * 实现游戏的初始化、渲染和主循环逻辑
 */

// 获取画布和上下文
let canvas, ctx;
try {
  canvas = wx.createCanvas();
  ctx = canvas.getContext('2d');
} catch (e) {
  console.error('创建画布失败:', e);
  // 创建备用画布
  canvas = {};
  ctx = {};
}

// 获取屏幕信息
let windowInfo;
try {
  windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (e) {
  console.error('获取屏幕信息失败:', e);
  windowInfo = { screenWidth: 375, screenHeight: 667 };
}

const SCREEN_WIDTH = windowInfo.screenWidth;
const SCREEN_HEIGHT = windowInfo.screenHeight;

// 设置画布大小
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// 游戏配置
const GRID_COLS = 10; // 网格列数
const GRID_ROWS = 14; // 网格行数
const TOTAL_BRICKS = 140; // 砖块总数

// 计算砖块大小和游戏区域
const GAME_PADDING = 20; // 游戏区域边距
const BRICK_SIZE = Math.floor((SCREEN_WIDTH - GAME_PADDING * 2) / GRID_COLS); // 砖块大小
const GAME_AREA = {
  x: GAME_PADDING,
  y: GAME_PADDING * 3,
  width: BRICK_SIZE * GRID_COLS,
  height: BRICK_SIZE * GRID_ROWS
};

// 砖块类型/颜色数量
const BRICK_TYPES = 6;

/**
 * 游戏主类
 */
export default class Main {
  constructor() {
    // 游戏状态
    this.isGameOver = false;
    this.isWin = false;
    this.score = 0;
    this.grid = []; // 游戏网格
    this.selectedBrick = null; // 当前选中的砖块
    this.matchingBricks = []; // 匹配的砖块
    this.initialPosition = null; // 初始位置
    
    // 初始化触摸事件
    this.initTouchEvents();
    
    // 初始化游戏
    this.init();
    
    // 开始游戏循环
    this.loop();
  }
  
  /**
   * 初始化游戏
   */
  init() {
    // 初始化游戏网格
    this.initGrid();
    
    // 填充砖块
    this.fillBricks();
  }
  
  /**
   * 初始化游戏网格
   */
  initGrid() {
    this.grid = [];
    
    // 创建空网格
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = null;
      }
    }
  }
  
  /**
   * 填充砖块
   */
  fillBricks() {
    // 随机填充砖块
    let bricksAdded = 0;
    
    while (bricksAdded < TOTAL_BRICKS) {
      const row = Math.floor(Math.random() * GRID_ROWS);
      const col = Math.floor(Math.random() * GRID_COLS);
      
      // 如果该位置为空，则添加砖块
      if (this.grid[row][col] === null) {
        // 随机砖块类型 (0-5)
        const type = Math.floor(Math.random() * BRICK_TYPES);
        
        // 创建砖块
        this.grid[row][col] = {
          type,
          x: GAME_AREA.x + col * BRICK_SIZE,
          y: GAME_AREA.y + row * BRICK_SIZE,
          row,
          col,
          width: BRICK_SIZE,
          height: BRICK_SIZE
        };
        
        bricksAdded++;
      }
    }
  }
  
  /**
   * 初始化触摸事件
   */
  initTouchEvents() {
    try {
      // 触摸开始
      wx.onTouchStart(this.onTouchStart.bind(this));
      
      // 触摸移动
      wx.onTouchMove(this.onTouchMove.bind(this));
      
      // 触摸结束
      wx.onTouchEnd(this.onTouchEnd.bind(this));
    } catch (e) {
      console.error('初始化触摸事件失败:', e);
      // 使用canvas的触摸事件作为备选
      if (canvas && canvas.addEventListener) {
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
      }
    }
  }
  
  /**
   * 触摸开始事件处理
   */
  onTouchStart(e) {
    if (this.isGameOver) return;
    
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    const { clientX, clientY } = touch;
    
    // 检查是否点击了砖块
    this.selectedBrick = this.getBrickAtPosition(clientX, clientY);
    
    // 初始化相同类型的砖块数组
    this.matchingBricks = [];
    
    // 记录选中砖块的初始位置，用于松开时回到原位
    if (this.selectedBrick) {
      this.initialPosition = {
        row: this.selectedBrick.row,
        col: this.selectedBrick.col,
        x: this.selectedBrick.x,
        y: this.selectedBrick.y
      };
    }
  }
  
  /**
   * 触摸移动事件处理
   */
  onTouchMove(e) {
    if (this.isGameOver || !this.selectedBrick) return;
    
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    const { clientX, clientY } = touch;
    
    // 如果没有初始位置，无法移动
    if (!this.initialPosition) return;
    
    // 计算当前触摸位置对应的网格坐标
    const col = Math.floor((clientX - GAME_AREA.x) / BRICK_SIZE);
    const row = Math.floor((clientY - GAME_AREA.y) / BRICK_SIZE);
    
    // 检查坐标是否有效
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      // 计算与选中砖块原位置的行列差值（用于判断移动方向）
      const rowDiff = row - this.initialPosition.row;
      const colDiff = col - this.initialPosition.col;
      
      // 只允许在以选中砖块原位置为中心的十字方向移动（严格水平或垂直）
      // 即：rowDiff === 0（水平移动）或 colDiff === 0（垂直移动）
      if ((rowDiff === 0 && colDiff !== 0) || (colDiff === 0 && rowDiff !== 0) || (colDiff === 0 && rowDiff === 0)) {
        // 获取当前位置
        const currentRow = this.selectedBrick.row;
        const currentCol = this.selectedBrick.col;
        
        // 检查移动路径上是否有阻挡
        let canMove = true;
        
        if (rowDiff === 0 && colDiff !== 0) {
          // 水平移动：检查从当前列到目标列之间的所有位置
          const startCol = Math.min(currentCol, col);
          const endCol = Math.max(currentCol, col);
          
          for (let c = startCol; c <= endCol; c++) {
            // 跳过当前位置（因为那里是选中的砖块）
            if (c === currentCol) continue;
            
            // 检查路径上的位置是否有砖块
            if (this.grid[row][c] !== null) {
              canMove = false;
              break;
            }
          }
        } else if (colDiff === 0 && rowDiff !== 0) {
          // 垂直移动：检查从当前行到目标行之间的所有位置
          const startRow = Math.min(currentRow, row);
          const endRow = Math.max(currentRow, row);
          
          for (let r = startRow; r <= endRow; r++) {
            // 跳过当前位置（因为那里是选中的砖块）
            if (r === currentRow) continue;
            
            // 检查路径上的位置是否有砖块
            if (this.grid[r][col] !== null) {
              canMove = false;
              break;
            }
          }
        }
        
        // 如果路径上没有阻挡，可以移动
        if (canMove) {
          // 更新网格
          this.grid[currentRow][currentCol] = null;
          this.grid[row][col] = this.selectedBrick;
          
          // 更新方块位置
          this.selectedBrick.row = row;
          this.selectedBrick.col = col;
          this.selectedBrick.x = GAME_AREA.x + this.selectedBrick.col * BRICK_SIZE;
          this.selectedBrick.y = GAME_AREA.y + this.selectedBrick.row * BRICK_SIZE;
        }
      }
    }
  }
  
  /**
   * 触摸结束事件处理
   */
  onTouchEnd() {
    if (this.isGameOver) {
      this.selectedBrick = null;
      return;
    }
    
    // 如果有选中的砖块
    if (this.selectedBrick) {
      // 获取当前位置的砖块
      const currentRow = this.selectedBrick.row;
      const currentCol = this.selectedBrick.col;
      const currentType = this.selectedBrick.type;
      
      // 检查周围最近的四个方块是否有可消除的方块
      let matchingBrick = null;
      let matchingBrickRow = null;
      let matchingBrickCol = null;
      
      // 定义四个方向：上、下、左、右
      const directions = [
        { row: -1, col: 0 }, // 上
        { row: 1, col: 0 },  // 下
        { row: 0, col: -1 }, // 左
        { row: 0, col: 1 }   // 右
      ];
      
      // 检查四个方向上的方块，如果遇到空位置则继续向该方向查找
      for (const dir of directions) {
        // 从当前位置开始，沿着方向查找
        let r = currentRow;
        let c = currentCol;
        
        // 继续向该方向移动，直到找到一个方块或到达边界
        while (true) {
          // 移动到下一个位置
          r += dir.row;
          c += dir.col;
          
          // 检查坐标是否有效
          if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) {
            // 超出边界，结束查找
            break;
          }
          
          // 如果该位置有砖块
          if (this.grid[r][c] !== null) {
            const brick = this.grid[r][c];
            
            // 检查类型是否相同
            if (brick.type === currentType) {
              matchingBrick = brick;
              matchingBrickRow = r;
              matchingBrickCol = c;
              break;
            } else {
              // 遇到不同类型的砖块，停止在这个方向上的查找
              break;
            }
          }
          // 如果是空位置，继续向该方向查找
        }
        
        // 如果已经找到匹配的砖块，不再检查其他方向
        if (matchingBrick) {
          break;
        }
      }
      
      // 如果找到匹配的砖块，消除这两个砖块
      if (matchingBrick) {
        // 消除选中的砖块
        this.grid[currentRow][currentCol] = null;
        
        // 消除匹配的砖块（使用查找时保存的坐标，确保位置正确）
        this.grid[matchingBrickRow][matchingBrickCol] = null;
        
        // 增加分数 (每消除一个砖块得10分)
        this.score += 2 * 10;
        
        // 检查游戏是否结束
        this.checkGameOver();
      } else {
        // 如果没有找到匹配的砖块，将选中的砖块移回原位置
        if (this.initialPosition) {
          // 恢复网格
          this.grid[currentRow][currentCol] = null;
          this.grid[this.initialPosition.row][this.initialPosition.col] = this.selectedBrick;
          
          // 恢复砖块位置
          this.selectedBrick.row = this.initialPosition.row;
          this.selectedBrick.col = this.initialPosition.col;
          this.selectedBrick.x = this.initialPosition.x;
          this.selectedBrick.y = this.initialPosition.y;
        }
      }
    }
    
    // 重置选中的砖块和初始位置
    this.selectedBrick = null;
    this.initialPosition = null;
  }
  
  /**
   * 获取指定位置的砖块
   */
  getBrickAtPosition(x, y) {
    // 检查是否在游戏区域内
    if (
      x < GAME_AREA.x || 
      x > GAME_AREA.x + GAME_AREA.width || 
      y < GAME_AREA.y || 
      y > GAME_AREA.y + GAME_AREA.height
    ) {
      return null;
    }
    
    // 计算网格坐标
    const col = Math.floor((x - GAME_AREA.x) / BRICK_SIZE);
    const row = Math.floor((y - GAME_AREA.y) / BRICK_SIZE);
    
    // 检查坐标是否有效
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      return this.grid[row][col];
    }
    
    return null;
  }
  
  /**
   * 检查游戏是否结束
   */
  checkGameOver() {
    // 检查是否所有砖块都已消除
    let remainingBricks = 0;
    
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.grid[row][col] !== null) {
          remainingBricks++;
        }
      }
    }
    
    if (remainingBricks === 0) {
      // 游戏胜利
      this.isGameOver = true;
      this.isWin = true;
      this.showGameOverMessage(true);
      return;
    }
    
    // 检查是否还有可以消除的砖块
    let canEliminate = false;
    
    outerLoop: for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.grid[row][col] !== null) {
          // 检查上下左右是否有相同类型的砖块
          const type = this.grid[row][col].type;
          
          // 上
          if (row > 0 && this.grid[row - 1][col] !== null && this.grid[row - 1][col].type === type) {
            canEliminate = true;
            break outerLoop;
          }
          
          // 下
          if (row < GRID_ROWS - 1 && this.grid[row + 1][col] !== null && this.grid[row + 1][col].type === type) {
            canEliminate = true;
            break outerLoop;
          }
          
          // 左
          if (col > 0 && this.grid[row][col - 1] !== null && this.grid[row][col - 1].type === type) {
            canEliminate = true;
            break outerLoop;
          }
          
          // 右
          if (col < GRID_COLS - 1 && this.grid[row][col + 1] !== null && this.grid[row][col + 1].type === type) {
            canEliminate = true;
            break outerLoop;
          }
        }
      }
    }
    
    if (!canEliminate && remainingBricks > 0) {
      // 游戏失败
      this.isGameOver = true;
      this.isWin = false;
      this.showGameOverMessage(false);
    }
  }
  
  /**
   * 显示游戏结束信息
   */
  showGameOverMessage(isWin) {
    // 绘制半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // 设置文本样式
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    
    // 显示游戏结果
    if (isWin) {
      ctx.fillText('恭喜过关！', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);
    } else {
      ctx.fillText('游戏结束', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);
    }
    
    // 显示分数
    ctx.font = '24px Arial';
    ctx.fillText(`得分: ${this.score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    
    // 显示重新开始按钮
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(SCREEN_WIDTH / 2 - 75, SCREEN_HEIGHT / 2 + 50, 150, 50);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 80);
  }
  
  /**
   * 渲染游戏
   */
  render() {
    // 清空画布
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // 绘制背景
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // 绘制游戏区域
    ctx.fillStyle = '#222222';
    ctx.fillRect(GAME_AREA.x, GAME_AREA.y, GAME_AREA.width, GAME_AREA.height);
    
    // 绘制网格线
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    
    // 绘制垂直线
    for (let col = 0; col <= GRID_COLS; col++) {
      const x = GAME_AREA.x + col * BRICK_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, GAME_AREA.y);
      ctx.lineTo(x, GAME_AREA.y + GAME_AREA.height);
      ctx.stroke();
    }
    
    // 绘制水平线
    for (let row = 0; row <= GRID_ROWS; row++) {
      const y = GAME_AREA.y + row * BRICK_SIZE;
      ctx.beginPath();
      ctx.moveTo(GAME_AREA.x, y);
      ctx.lineTo(GAME_AREA.x + GAME_AREA.width, y);
      ctx.stroke();
    }
    
    // 绘制砖块
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const brick = this.grid[row][col];
        if (brick !== null) {
          // 检查是否是选中的砖块或匹配的砖块
          const isSelected = this.selectedBrick && brick === this.selectedBrick;
          const isMatching = this.matchingBricks && this.matchingBricks.includes(brick);
          
          this.drawBrick(brick, isSelected, isMatching);
        }
      }
    }
    
    // 绘制分数
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this.score}`, GAME_PADDING, GAME_PADDING * 2);
    
    // 如果游戏结束，显示游戏结束信息
    if (this.isGameOver) {
      this.showGameOverMessage(this.isWin);
    }
  }
  
  /**
   * 绘制砖块
   * @param {Object} brick - 砖块对象
   * @param {boolean} isSelected - 是否是选中的砖块
   * @param {boolean} isMatching - 是否是匹配的砖块
   */
  drawBrick(brick, isSelected = false, isMatching = false) {
    // 砖块颜色
    const colors = [
      '#FF5252', // 红色
      '#FFEB3B', // 黄色
      '#4CAF50', // 绿色
      '#2196F3', // 蓝色
      '#9C27B0', // 紫色
      '#FF9800'  // 橙色
    ];
    
    // 绘制砖块背景
    ctx.fillStyle = colors[brick.type];
    ctx.fillRect(
      brick.x + 1,
      brick.y + 1,
      brick.width - 2,
      brick.height - 2
    );
    
    // 如果是选中的砖块，绘制高亮边框
    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        brick.x + 2,
        brick.y + 2,
        brick.width - 4,
        brick.height - 4
      );
    }
    
    // 如果是匹配的砖块，绘制闪烁效果
    if (isMatching) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(
        brick.x + 5,
        brick.y + 5,
        brick.width - 10,
        brick.height - 10
      );
    }
    
    // 绘制砖块图案
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    
    // 根据类型绘制不同图案
    switch (brick.type) {
      case 0: // 红色 - 圆形
        ctx.beginPath();
        ctx.arc(
          brick.x + brick.width / 2,
          brick.y + brick.height / 2,
          brick.width / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
        break;
      case 1: // 黄色 - 三角形
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.width / 2, brick.y + brick.height / 4);
        ctx.lineTo(brick.x + brick.width / 4, brick.y + brick.height * 3 / 4);
        ctx.lineTo(brick.x + brick.width * 3 / 4, brick.y + brick.height * 3 / 4);
        ctx.closePath();
        ctx.fill();
        break;
      case 2: // 绿色 - 正方形
        ctx.fillRect(
          brick.x + brick.width / 4,
          brick.y + brick.height / 4,
          brick.width / 2,
          brick.height / 2
        );
        break;
      case 3: // 蓝色 - 十字
        ctx.fillRect(
          brick.x + brick.width / 3,
          brick.y + brick.height / 6,
          brick.width / 3,
          brick.height * 2 / 3
        );
        ctx.fillRect(
          brick.x + brick.width / 6,
          brick.y + brick.height / 3,
          brick.width * 2 / 3,
          brick.height / 3
        );
        break;
      case 4: // 紫色 - 菱形
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.width / 2, brick.y + brick.height / 4);
        ctx.lineTo(brick.x + brick.width * 3 / 4, brick.y + brick.height / 2);
        ctx.lineTo(brick.x + brick.width / 2, brick.y + brick.height * 3 / 4);
        ctx.lineTo(brick.x + brick.width / 4, brick.y + brick.height / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 5: // 橙色 - 五角星
        this.drawStar(
          brick.x + brick.width / 2,
          brick.y + brick.height / 2,
          5,
          brick.width / 4,
          brick.width / 8
        );
        break;
    }
  }
  
  /**
   * 绘制星形
   */
  drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * 游戏循环
   */
  loop() {
    // 渲染游戏
    this.render();
    
    // 请求下一帧
    try {
      // 使用全局requestAnimationFrame
      requestAnimationFrame(this.loop.bind(this));
    } catch (e) {
      console.error('requestAnimationFrame失败:', e);
      // 使用setTimeout作为备选
      setTimeout(this.loop.bind(this), 1000 / 60);
    }
  }
}

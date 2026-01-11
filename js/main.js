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
    this.moveDirection = null; // 移动方向：'horizontal'(水平) 或 'vertical'(垂直)
    this.pushedBricks = []; // 被推动的连续方块列表
    this.pushDirection = null; // 推动方向：'left', 'right', 'up', 'down'
    this.pushedBricksInitialPositions = []; // 被推动方块的初始位置
    
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
   * 重新开始游戏
   */
  restartGame() {
    // 重置游戏状态
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
    
    // 重新初始化游戏
    this.init();
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
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    const { clientX, clientY } = touch;
    
    // 如果游戏结束，检查是否点击了重新开始按钮
    if (this.isGameOver) {
      // 重新开始按钮的位置和大小
      const buttonX = SCREEN_WIDTH / 2 - 75;
      const buttonY = SCREEN_HEIGHT / 2 + 50;
      const buttonWidth = 150;
      const buttonHeight = 50;
      
      // 检查是否点击了重新开始按钮
      if (clientX >= buttonX && clientX <= buttonX + buttonWidth &&
          clientY >= buttonY && clientY <= buttonY + buttonHeight) {
        // 重新开始游戏
        this.restartGame();
      }
      return;
    }
    
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
      // 重置移动方向，允许重新选择方向
      this.moveDirection = null;
      // 重置被推动的方块
      this.pushedBricks = [];
      this.pushDirection = null;
      this.pushedBricksInitialPositions = [];
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
    
    // 如果还没有锁定移动方向，先确定方向
    if (this.moveDirection === null) {
      // 计算当前触摸位置对应的网格坐标
      const col = Math.floor((clientX - GAME_AREA.x) / BRICK_SIZE);
      const row = Math.floor((clientY - GAME_AREA.y) / BRICK_SIZE);
      
      // 计算与初始位置的行列差值
      const rowDiff = row - this.initialPosition.row;
      const colDiff = col - this.initialPosition.col;
      
      // 根据差值确定移动方向（取绝对值较大的方向）
      if (Math.abs(colDiff) > Math.abs(rowDiff) && colDiff !== 0) {
        // 水平移动
        this.moveDirection = 'horizontal';
      } else if (Math.abs(rowDiff) > Math.abs(colDiff) && rowDiff !== 0) {
        // 垂直移动
        this.moveDirection = 'vertical';
      } else {
        // 如果差值太小或相等，不锁定方向，等待更明确的移动
        return;
      }
    }
    
    // 根据已锁定的移动方向计算目标位置
    let targetCol, targetRow;
    
    if (this.moveDirection === 'horizontal') {
      // 水平移动：以鼠标的水平坐标为终点，垂直坐标保持初始位置
      targetCol = Math.floor((clientX - GAME_AREA.x) / BRICK_SIZE);
      targetRow = this.initialPosition.row; // 保持初始行
    } else if (this.moveDirection === 'vertical') {
      // 垂直移动：以鼠标的垂直坐标为终点，水平坐标保持初始位置
      targetCol = this.initialPosition.col; // 保持初始列
      targetRow = Math.floor((clientY - GAME_AREA.y) / BRICK_SIZE);
    } else {
      return;
    }
    
    // 确保目标位置在有效范围内
    targetCol = Math.max(0, Math.min(GRID_COLS - 1, targetCol));
    targetRow = Math.max(0, Math.min(GRID_ROWS - 1, targetRow));
    
    // 获取当前位置
    const currentRow = this.selectedBrick.row;
    const currentCol = this.selectedBrick.col;
    
    // 如果目标位置和当前位置相同，不需要移动
    if (targetRow === currentRow && targetCol === currentCol) {
      return;
    }
    
    // 确定推动方向
    let newPushDirection = null;
    if (this.moveDirection === 'horizontal') {
      if (targetCol > this.initialPosition.col) {
        newPushDirection = 'right';
      } else if (targetCol < this.initialPosition.col) {
        newPushDirection = 'left';
      }
    } else if (this.moveDirection === 'vertical') {
      if (targetRow > this.initialPosition.row) {
        newPushDirection = 'down';
      } else if (targetRow < this.initialPosition.row) {
        newPushDirection = 'up';
      }
    }
    
    // 计算移动距离
    let moveDistance = 0;
    if (this.moveDirection === 'horizontal') {
      moveDistance = targetCol - this.initialPosition.col;
    } else {
      moveDistance = targetRow - this.initialPosition.row;
    }
    
    // 判断是否在原点或越过原点
    const isAtOrigin = (this.moveDirection === 'horizontal' && targetCol === this.initialPosition.col) ||
                       (this.moveDirection === 'vertical' && targetRow === this.initialPosition.row);
    const isPastOrigin = (this.moveDirection === 'horizontal' && 
                          ((this.pushDirection === 'right' && targetCol < this.initialPosition.col) ||
                           (this.pushDirection === 'left' && targetCol > this.initialPosition.col))) ||
                         (this.moveDirection === 'vertical' &&
                          ((this.pushDirection === 'down' && targetRow < this.initialPosition.row) ||
                           (this.pushDirection === 'up' && targetRow > this.initialPosition.row)));
    
    // 如果推动方向改变，需要重置被推动的方块
    if (this.pushDirection !== newPushDirection) {
      // 如果之前有被推动的方块
      if (this.pushDirection && this.pushedBricks.length > 0) {
        // 如果当前在原点或已越过原点，被推动的方块保持在当前位置（原点位置）
        // 否则复位到初始位置
        if (!isAtOrigin && !isPastOrigin) {
          this.resetPushedBricks();
        }
        // 注意：如果已越过原点，被推动的方块保持在原点，不会被清除
      }
      
      // 更新推动方向
      this.pushDirection = newPushDirection;
      
      // 如果新的推动方向不为null，查找新的连续方块
      if (this.pushDirection) {
        this.pushedBricks = this.findConnectedBricks(this.pushDirection);
        // 保存初始位置
        this.pushedBricksInitialPositions = this.pushedBricks.map(brick => ({
          row: brick.row,
          col: brick.col,
          x: brick.x,
          y: brick.y
        }));
      } else {
        // 只有在不在原点且没有越过原点时才清除
        if (!isAtOrigin && !isPastOrigin) {
          this.pushedBricks = [];
          this.pushedBricksInitialPositions = [];
        }
      }
    }
    
    // 计算选中方块的目标位置
    let selectedTargetRow = this.initialPosition.row;
    let selectedTargetCol = this.initialPosition.col;
    if (this.moveDirection === 'horizontal') {
      selectedTargetCol = this.initialPosition.col + moveDistance;
    } else {
      selectedTargetRow = this.initialPosition.row + moveDistance;
    }
    
    // 确保选中方块的目标位置在有效范围内
    selectedTargetCol = Math.max(0, Math.min(GRID_COLS - 1, selectedTargetCol));
    selectedTargetRow = Math.max(0, Math.min(GRID_ROWS - 1, selectedTargetRow));
    
    // 检查是否可以移动（包括推动连续方块）
    let canMove = true;
    let actualMoveDistance = moveDistance;
    
    if (this.pushDirection && this.pushedBricks.length > 0) {
      // 需要推动连续方块
      const lastBrick = this.pushedBricks[this.pushedBricks.length - 1];
      const lastBrickInitialRow = this.pushedBricksInitialPositions[this.pushedBricks.length - 1].row;
      const lastBrickInitialCol = this.pushedBricksInitialPositions[this.pushedBricks.length - 1].col;
      
      let lastBrickTargetRow = lastBrickInitialRow;
      let lastBrickTargetCol = lastBrickInitialCol;
      
      if (this.moveDirection === 'horizontal') {
        lastBrickTargetCol = lastBrickInitialCol + moveDistance;
      } else {
        lastBrickTargetRow = lastBrickInitialRow + moveDistance;
      }
      
      // 检查最后一个连续方块是否会碰到边界或其他方块
      if (this.moveDirection === 'horizontal') {
        if (lastBrickTargetCol < 0 || lastBrickTargetCol >= GRID_COLS) {
          canMove = false;
          actualMoveDistance = lastBrickTargetCol < 0 ? -lastBrickInitialCol : (GRID_COLS - 1 - lastBrickInitialCol);
        } else {
          // 检查最后一个方块移动路径上是否有其他方块（除了被推动的方块和选中方块）
          // 需要检查从初始位置的下一个位置到目标位置之间的所有位置
          if (moveDistance > 0) {
            // 向右移动：检查从初始位置右边到目标位置
            for (let checkCol = lastBrickInitialCol + 1; checkCol <= lastBrickTargetCol; checkCol++) {
              if (checkCol < 0 || checkCol >= GRID_COLS) continue;
              
              const brickAtCheckPos = this.grid[lastBrickInitialRow][checkCol];
              // 如果这个位置有方块，且不是被推动的方块和选中方块，就停止
              if (brickAtCheckPos !== null && 
                  !this.pushedBricks.includes(brickAtCheckPos) && 
                  brickAtCheckPos !== this.selectedBrick) {
                canMove = false;
                // 计算实际移动距离：停在碰撞位置的前一个位置
                actualMoveDistance = checkCol - 1 - lastBrickInitialCol;
                break;
              }
            }
          } else {
            // 向左移动：检查从目标位置到初始位置左边
            for (let checkCol = lastBrickTargetCol; checkCol < lastBrickInitialCol; checkCol++) {
              if (checkCol < 0 || checkCol >= GRID_COLS) continue;
              
              const brickAtCheckPos = this.grid[lastBrickInitialRow][checkCol];
              // 如果这个位置有方块，且不是被推动的方块和选中方块，就停止
              if (brickAtCheckPos !== null && 
                  !this.pushedBricks.includes(brickAtCheckPos) && 
                  brickAtCheckPos !== this.selectedBrick) {
                canMove = false;
                // 计算实际移动距离：停在碰撞位置的后一个位置
                actualMoveDistance = checkCol + 1 - lastBrickInitialCol;
                break;
              }
            }
          }
        }
      } else {
        if (lastBrickTargetRow < 0 || lastBrickTargetRow >= GRID_ROWS) {
          canMove = false;
          actualMoveDistance = lastBrickTargetRow < 0 ? -lastBrickInitialRow : (GRID_ROWS - 1 - lastBrickInitialRow);
        } else {
          // 检查最后一个方块移动路径上是否有其他方块（除了被推动的方块和选中方块）
          // 需要检查从初始位置的下一个位置到目标位置之间的所有位置
          if (moveDistance > 0) {
            // 向下移动：检查从初始位置下方到目标位置
            for (let checkRow = lastBrickInitialRow + 1; checkRow <= lastBrickTargetRow; checkRow++) {
              if (checkRow < 0 || checkRow >= GRID_ROWS) continue;
              
              const brickAtCheckPos = this.grid[checkRow][lastBrickInitialCol];
              // 如果这个位置有方块，且不是被推动的方块和选中方块，就停止
              if (brickAtCheckPos !== null && 
                  !this.pushedBricks.includes(brickAtCheckPos) && 
                  brickAtCheckPos !== this.selectedBrick) {
                canMove = false;
                // 计算实际移动距离：停在碰撞位置的前一个位置
                actualMoveDistance = checkRow - 1 - lastBrickInitialRow;
                break;
              }
            }
          } else {
            // 向上移动：检查从目标位置到初始位置上边
            for (let checkRow = lastBrickTargetRow; checkRow < lastBrickInitialRow; checkRow++) {
              if (checkRow < 0 || checkRow >= GRID_ROWS) continue;
              
              const brickAtCheckPos = this.grid[checkRow][lastBrickInitialCol];
              // 如果这个位置有方块，且不是被推动的方块和选中方块，就停止
              if (brickAtCheckPos !== null && 
                  !this.pushedBricks.includes(brickAtCheckPos) && 
                  brickAtCheckPos !== this.selectedBrick) {
                canMove = false;
                // 计算实际移动距离：停在碰撞位置的后一个位置
                actualMoveDistance = checkRow + 1 - lastBrickInitialRow;
                break;
              }
            }
          }
        }
      }
      
      // 重新计算目标位置
      if (this.moveDirection === 'horizontal') {
        selectedTargetCol = this.initialPosition.col + actualMoveDistance;
        selectedTargetCol = Math.max(0, Math.min(GRID_COLS - 1, selectedTargetCol));
      } else {
        selectedTargetRow = this.initialPosition.row + actualMoveDistance;
        selectedTargetRow = Math.max(0, Math.min(GRID_ROWS - 1, selectedTargetRow));
      }
    } else {
      // 没有连续方块需要推动，检查路径上是否有阻挡
      if (this.moveDirection === 'horizontal') {
        const startCol = Math.min(currentCol, selectedTargetCol);
        const endCol = Math.max(currentCol, selectedTargetCol);
        
        for (let c = startCol; c <= endCol; c++) {
          if (c === currentCol) continue;
          if (this.grid[targetRow][c] !== null) {
            canMove = false;
            break;
          }
        }
      } else {
        const startRow = Math.min(currentRow, selectedTargetRow);
        const endRow = Math.max(currentRow, selectedTargetRow);
        
        for (let r = startRow; r <= endRow; r++) {
          if (r === currentRow) continue;
          if (this.grid[r][targetCol] !== null) {
            canMove = false;
            break;
          }
        }
      }
    }
    
    // 如果可以移动，更新位置
    if (canMove) {
      // 先恢复网格（从当前位置移除选中方块和被推动的方块）
      this.grid[currentRow][currentCol] = null;
      this.pushedBricks.forEach(brick => {
        this.grid[brick.row][brick.col] = null;
      });
      
      // 更新选中方块的位置
      this.grid[selectedTargetRow][selectedTargetCol] = this.selectedBrick;
      this.selectedBrick.row = selectedTargetRow;
      this.selectedBrick.col = selectedTargetCol;
      this.selectedBrick.x = GAME_AREA.x + this.selectedBrick.col * BRICK_SIZE;
      this.selectedBrick.y = GAME_AREA.y + this.selectedBrick.row * BRICK_SIZE;
      
      // 更新被推动方块的位置
      this.pushedBricks.forEach((brick, index) => {
        const initialPos = this.pushedBricksInitialPositions[index];
        let newRow = initialPos.row;
        let newCol = initialPos.col;
        
        if (this.moveDirection === 'horizontal') {
          newCol = initialPos.col + actualMoveDistance;
        } else {
          newRow = initialPos.row + actualMoveDistance;
        }
        
        newCol = Math.max(0, Math.min(GRID_COLS - 1, newCol));
        newRow = Math.max(0, Math.min(GRID_ROWS - 1, newRow));
        
        this.grid[newRow][newCol] = brick;
        brick.row = newRow;
        brick.col = newCol;
        brick.x = GAME_AREA.x + brick.col * BRICK_SIZE;
        brick.y = GAME_AREA.y + brick.row * BRICK_SIZE;
      });
    }
  }
  
  /**
   * 复位被推动的方块
   */
  resetPushedBricks() {
    this.pushedBricks.forEach((brick, index) => {
      const initialPos = this.pushedBricksInitialPositions[index];
      
      // 恢复网格
      this.grid[brick.row][brick.col] = null;
      this.grid[initialPos.row][initialPos.col] = brick;
      
      // 恢复位置
      brick.row = initialPos.row;
      brick.col = initialPos.col;
      brick.x = initialPos.x;
      brick.y = initialPos.y;
    });
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
            
            // 跳过被推动的连续方块，只检查其他方块
            if (this.pushedBricks.includes(brick)) {
              // 如果是被推动的方块，继续查找（跳过它）
              continue;
            }
            
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
        
        // 被推动的方块留在新位置（不需要复位）
        
        // 检查游戏是否结束
        this.checkGameOver();
      } else {
        // 如果没有找到匹配的砖块，将选中的砖块和被推动的方块都移回原位置
        if (this.initialPosition) {
          // 先复位被推动的方块
          this.resetPushedBricks();
          
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
    
    // 重置选中的砖块、初始位置、移动方向和被推动的方块
    this.selectedBrick = null;
    this.initialPosition = null;
    this.moveDirection = null;
    this.pushedBricks = [];
    this.pushDirection = null;
    this.pushedBricksInitialPositions = [];
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
   * 查找与选中方块连接的连续方块
   * @param {string} direction - 方向：'left', 'right', 'up', 'down'
   * @returns {Array} 连续方块数组
   */
  findConnectedBricks(direction) {
    if (!this.selectedBrick) return [];
    
    const connectedBricks = [];
    const startRow = this.selectedBrick.row;
    const startCol = this.selectedBrick.col;
    
    let currentRow = startRow;
    let currentCol = startCol;
    
    // 根据方向查找连续方块
    while (true) {
      // 移动到下一个位置
      if (direction === 'left') {
        currentCol--;
      } else if (direction === 'right') {
        currentCol++;
      } else if (direction === 'up') {
        currentRow--;
      } else if (direction === 'down') {
        currentRow++;
      }
      
      // 检查是否超出边界
      if (currentRow < 0 || currentRow >= GRID_ROWS || 
          currentCol < 0 || currentCol >= GRID_COLS) {
        break;
      }
      
      // 检查该位置是否有方块
      const brick = this.grid[currentRow][currentCol];
      if (brick === null) {
        break;
      }
      
      // 添加连续方块
      connectedBricks.push(brick);
    }
    
    return connectedBricks;
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
    // 检查每个方块是否可以移动（跳过空位置）来找到匹配的方块
    let canEliminate = false;
    
    outerLoop: for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.grid[row][col] !== null) {
          const type = this.grid[row][col].type;
          
          // 定义四个方向：上、下、左、右
          const directions = [
            { row: -1, col: 0 }, // 上
            { row: 1, col: 0 },  // 下
            { row: 0, col: -1 }, // 左
            { row: 0, col: 1 }   // 右
          ];
          
          // 检查四个方向上的方块，如果遇到空位置则继续向该方向查找
          for (const dir of directions) {
            let r = row;
            let c = col;
            
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
                if (brick.type === type) {
                  canEliminate = true;
                  break outerLoop;
                } else {
                  // 遇到不同类型的砖块，停止在这个方向上的查找
                  break;
                }
              }
              // 如果是空位置，继续向该方向查找
            }
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

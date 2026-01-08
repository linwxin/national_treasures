import Pool from './base/pool';

let instance;

/**
 * 全局状态管理器
 * 负责管理游戏的状态，包括帧数、分数、砖块和动画等
 */
export default class DataBus {
  // 直接在类中定义实例属性
  bricks = []; // 存储砖块
  animations = []; // 存储动画
  frame = 0; // 当前帧数
  score = 0; // 当前分数
  isGameOver = false; // 游戏是否结束
  isWin = false; // 是否胜利
  pool = new Pool(); // 初始化对象池

  constructor() {
    // 确保单例模式
    if (instance) return instance;

    instance = this;
  }

  // 重置游戏状态
  reset() {
    this.frame = 0; // 当前帧数
    this.score = 0; // 当前分数
    this.bricks = []; // 存储砖块
    this.animations = []; // 存储动画
    this.isGameOver = false; // 游戏是否结束
    this.isWin = false; // 是否胜利
  }

  // 游戏结束
  gameOver(win = false) {
    this.isGameOver = true;
    this.isWin = win;
  }

  /**
   * 回收砖块，进入对象池
   * 此后不进入帧循环
   * @param {Object} brick - 要回收的砖块对象
   */
  removeBrick(brick) {
    const temp = this.bricks.splice(this.bricks.indexOf(brick), 1);
    if (temp) {
      this.pool.recover('brick', brick); // 回收砖块到对象池
    }
  }
}

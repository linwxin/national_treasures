/**
 * 微信小游戏适配器
 * 用于在微信小游戏环境中模拟浏览器API
 */

// 创建全局GameGlobal对象
if (!GameGlobal.isInit) {
  GameGlobal.isInit = true;
  
  // 创建canvas
  if (!GameGlobal.canvas) {
    try {
      GameGlobal.canvas = wx.createCanvas();
    } catch (e) {
      console.error('创建canvas失败:', e);
      GameGlobal.canvas = {};
    }
  }

  // 创建全局对象
  const global = GameGlobal;

  // 导出全局变量
  function inject() {
    // 基础对象
    const _global = GameGlobal;
    
    // 创建document和window对象
    const document = {};
    const window = {};
    
    // 设置原型链
    Object.setPrototypeOf(window, _global);
    Object.setPrototypeOf(document, _global);
    
    // 将对象挂载到全局
    if (!_global.document) {
      try {
        Object.defineProperty(_global, 'document', {
          value: document,
          writable: false,
          configurable: true
        });
      } catch (e) {
        console.warn('设置document属性失败:', e);
      }
    }
    if (!_global.window) {
      try {
        Object.defineProperty(_global, 'window', {
          value: window,
          writable: false,
          configurable: true
        });
      } catch (e) {
        console.warn('设置window属性失败:', e);
      }
    }
  }
  
  // 执行注入
  inject();

  // 添加requestAnimationFrame和cancelAnimationFrame
  if (!GameGlobal.requestAnimationFrame) {
    GameGlobal.requestAnimationFrame = function(callback) {
      return setTimeout(callback, 1000 / 60);
    };
  }
  
  if (!GameGlobal.cancelAnimationFrame) {
    GameGlobal.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
  }
  
  // 添加Image对象
  if (!GameGlobal.Image) {
    GameGlobal.Image = function() {
      this.width = 0;
      this.height = 0;
      this.complete = false;
      
      this._src = '';
      
      Object.defineProperty(this, 'src', {
        get: function() {
          return this._src;
        },
        set: function(value) {
          this._src = value;
          if (value) {
            this._loadImage(value);
          }
        }
      });
    };
    
    GameGlobal.Image.prototype._loadImage = function(src) {
      const self = this;
      const img = wx.createImage();
      
      img.onload = function() {
        self.complete = true;
        self.width = img.width;
        self.height = img.height;
        
        if (self.onload) {
          self.onload();
        }
      };
      
      img.onerror = function() {
        if (self.onerror) {
          self.onerror();
        }
      };
      
      img.src = src;
    };
  }
}

// 导出全局对象
export default GameGlobal;
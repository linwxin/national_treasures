/**
 * Symbol兼容库
 * 用于在微信小游戏环境中提供Symbol支持
 */

// 如果Symbol不存在，则创建一个polyfill
if (!GameGlobal.Symbol) {
  // Symbol构造函数
  const Symbol = function Symbol(description) {
    // 生成唯一标识符
    this.__name__ = String(description || '');
    this.__hash__ = '__' + Math.random().toString(36).substring(2) + Date.now().toString(36) + '__';
    return this;
  };

  // Symbol.for方法
  Symbol.for = function(key) {
    const globalSymbols = GameGlobal.__symbols__ = GameGlobal.__symbols__ || {};
    const keyString = String(key);
    return globalSymbols[keyString] || (globalSymbols[keyString] = Symbol(keyString));
  };

  // Symbol.keyFor方法
  Symbol.keyFor = function(sym) {
    const globalSymbols = GameGlobal.__symbols__ = GameGlobal.__symbols__ || {};
    for (const key in globalSymbols) {
      if (globalSymbols[key] === sym) {
        return key;
      }
    }
  };

  // 导出Symbol
  try {
    if (!GameGlobal.Symbol) {
      Object.defineProperty(GameGlobal, 'Symbol', {
        value: Symbol,
        writable: false,
        configurable: true
      });
    }
  } catch (e) {
    console.warn('设置GameGlobal.Symbol失败:', e);
  }
}

// 导出Symbol
export default GameGlobal.Symbol;
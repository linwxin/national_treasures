// 安全地设置GameGlobal.canvas
try {
  const canvas = wx.createCanvas();
  if (!GameGlobal.canvas) {
    Object.defineProperty(GameGlobal, 'canvas', {
      value: canvas,
      writable: false,
      configurable: true
    });
  }
} catch (e) {
  console.warn('设置GameGlobal.canvas失败:', e);
}

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

// 获取canvas并设置尺寸
try {
  const canvas = GameGlobal.canvas || wx.createCanvas();
  canvas.width = windowInfo.screenWidth;
  canvas.height = windowInfo.screenHeight;
} catch (e) {
  console.warn('设置canvas尺寸失败:', e);
}

export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;
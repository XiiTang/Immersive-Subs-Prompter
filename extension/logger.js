/**
 * Universal Subtitle Plugin - Logger Module
 * 统一的日志管理系统，用于记录视频检测、消息传输等关键信息
 */

const LOG_PREFIX = "[USP]";
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(context, minLevel = LOG_LEVELS.DEBUG) {
    this.context = context; // 'content-script', 'background', 'popup'
    this.minLevel = minLevel;
    this.enabledCategories = new Set([
      'video-detection',      // 视频检测
      'message-transmission', // 消息传输
      'desktop-communication',// 与 desktop-app 通信
      'media-state',          // 媒体状态变化
      'connection',           // 连接管理
      'control',              // 控制命令
      'error'                 // 错误信息
    ]);
  }

  _shouldLog(level, category) {
    if (level < this.minLevel) return false;
    if (category && !this.enabledCategories.has(category)) return false;
    return true;
  }

  _formatMessage(level, category, message, data) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const levelStr = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'LOG';
    const categoryStr = category ? `[${category}]` : '';
    const contextStr = `[${this.context}]`;
    
    return {
      prefix: `${LOG_PREFIX} ${timestamp} ${contextStr}${categoryStr} ${levelStr}:`,
      message,
      data
    };
  }

  _log(level, category, message, data) {
    if (!this._shouldLog(level, category)) return;
    
    const formatted = this._formatMessage(level, category, message, data);
    const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' :
                         level === LOG_LEVELS.WARN ? 'warn' :
                         level === LOG_LEVELS.INFO ? 'info' : 'log';
    
    if (data !== undefined) {
      console[consoleMethod](formatted.prefix, formatted.message, data);
    } else {
      console[consoleMethod](formatted.prefix, formatted.message);
    }
  }

  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  // 视频检测专用日志
  videoDetected(video, details) {
    this.info('video-detection', '检测到视频元素', {
      src: video.currentSrc || video.src || '(no src)',
      readyState: video.readyState,
      duration: video.duration,
      paused: video.paused,
      ...details
    });
  }

  videoActivated(video, reason) {
    this.info('video-detection', `视频被激活: ${reason}`, {
      src: video.currentSrc || video.src,
      currentTime: video.currentTime,
      duration: video.duration
    });
  }

  videoStateChange(eventType, state) {
    this.debug('media-state', `视频状态变化: ${eventType}`, state);
  }

  // 消息传输专用日志
  messageSent(type, payload, target) {
    this.debug('message-transmission', `发送消息: ${type} -> ${target}`, payload);
  }

  messageReceived(type, payload, source) {
    this.debug('message-transmission', `接收消息: ${type} <- ${source}`, payload);
  }

  messageDeliveryFailed(type, error, target) {
    this.error('message-transmission', `消息发送失败: ${type} -> ${target}`, error);
  }

  // Desktop 通信专用日志
  desktopConnected() {
    this.info('desktop-communication', '已连接到 desktop-app');
  }

  desktopDisconnected() {
    this.warn('desktop-communication', 'desktop-app 连接断开');
  }

  desktopMessageSent(data) {
    this.debug('desktop-communication', '向 desktop-app 发送数据', {
      type: data.type,
      tabId: data.tabId,
      payloadKeys: data.payload ? Object.keys(data.payload) : []
    });
  }

  desktopMessageReceived(data) {
    this.debug('desktop-communication', '从 desktop-app 接收数据', {
      type: data.type,
      source: data.source
    });
  }

  // 连接管理日志
  portConnected(portName, details) {
    this.info('connection', `端口已连接: ${portName}`, details);
  }

  portDisconnected(portName, details) {
    this.info('connection', `端口已断开: ${portName}`, details);
  }

  reconnecting(target, delay) {
    this.info('connection', `正在重连: ${target}`, { delayMs: delay });
  }

  // 控制命令日志
  controlCommandReceived(action, payload) {
    this.info('control', `接收控制命令: ${action}`, payload);
  }

  controlCommandExecuted(action, success, details) {
    if (success) {
      this.info('control', `控制命令执行成功: ${action}`, details);
    } else {
      this.warn('control', `控制命令执行失败: ${action}`, details);
    }
  }

  // 媒体过滤日志
  mediaFiltered(reason, payload) {
    this.debug('media-state', `媒体被过滤: ${reason}`, {
      duration: payload?.duration,
      readyState: payload?.readyState
    });
  }

  mediaStateUpdated(tabId, eventType, isValid) {
    this.debug('media-state', `媒体状态更新: Tab ${tabId}, 事件: ${eventType}, 有效: ${isValid}`);
  }

  // 通用错误日志
  logError(category, message, error) {
    this.error(category, message, {
      error: error.message || error,
      stack: error.stack
    });
  }

  // 启用/禁用特定类别
  enableCategory(category) {
    this.enabledCategories.add(category);
  }

  disableCategory(category) {
    this.enabledCategories.delete(category);
  }

  // 设置日志级别
  setLevel(level) {
    if (typeof level === 'string') {
      this.minLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.DEBUG;
    } else {
      this.minLevel = level;
    }
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, LOG_LEVELS };
}

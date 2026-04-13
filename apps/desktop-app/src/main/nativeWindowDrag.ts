/**
 * Native Window Drag for Windows
 * 
 * 解决 Electron 在 Windows 上透明无边框窗口拖拽问题的原生方案。
 * 
 * 问题背景：
 * 1. CSS `-webkit-app-region: drag` 在透明窗口上不工作
 * 2. 使用 setPosition/setBounds 会导致窗口尺寸漂移（每次调用增加约 2px）
 * 
 * 解决方案：
 * 使用 Windows 原生 API 发送 WM_SYSCOMMAND + SC_MOVE 消息，让 Windows 系统
 * 完全接管窗口拖拽。这样：
 * - 无需轮询鼠标位置
 * - 无尺寸漂移问题
 * - 支持 Windows 的边缘吸附、摇动最小化等原生功能
 * - 拖拽体验与系统原生窗口一致
 */

import { createLogger } from "./logger.js";

const log = createLogger("native-drag");

// Windows API 常量
const WM_SYSCOMMAND = 0x0112;
const SC_MOVE = 0xF010;
const HTCAPTION = 2;

// 动态加载的 koffi 函数
let ReleaseCapture: (() => number) | null = null;
let SendMessageW: ((hWnd: bigint, msg: number, wParam: bigint, lParam: bigint) => bigint) | null = null;
let isInitialized = false;
let initError: string | null = null;

/**
 * 初始化 Windows 原生 API
 * 使用动态导入以避免在非 Windows 平台上加载失败
 */
async function initializeNativeAPIs(): Promise<boolean> {
  if (isInitialized) return true;
  if (initError) return false;

  // 只在 Windows 上初始化
  if (process.platform !== "win32") {
    initError = "Native window drag is only supported on Windows";
    log.warn(initError);
    return false;
  }

  try {
    // 动态导入 koffi
    const koffi = await import("koffi");
    
    // 加载 user32.dll
    const user32 = koffi.default.load("user32.dll");
    
    // 定义 API 函数
    // ReleaseCapture: 释放鼠标捕获，让 Windows 可以接管
    ReleaseCapture = user32.func("ReleaseCapture", "int", []);
    
    // SendMessageW: 发送窗口消息
    // 参数: hWnd (窗口句柄), Msg (消息ID), wParam, lParam
    // 返回: LRESULT (消息处理结果)
    SendMessageW = user32.func("SendMessageW", "int64", ["int64", "uint", "int64", "int64"]);
    
    isInitialized = true;
    log.info("Native window drag APIs initialized successfully");
    return true;
  } catch (error) {
    initError = `Failed to initialize native APIs: ${error instanceof Error ? error.message : String(error)}`;
    log.error(initError, error);
    return false;
  }
}

/**
 * 从 Electron 的 getNativeWindowHandle() 返回的 Buffer 中提取 HWND
 * 在 64 位 Windows 上，HWND 是 64 位指针
 */
function getHwndFromBuffer(buffer: Buffer): bigint {
  // Windows 64-bit: 8 bytes
  // Windows 32-bit: 4 bytes (已过时，基本不需要支持)
  if (buffer.length >= 8) {
    return buffer.readBigInt64LE(0);
  } else {
    return BigInt(buffer.readInt32LE(0));
  }
}

/**
 * 启动 Windows 原生窗口拖拽
 * 
 * 工作原理：
 * 1. ReleaseCapture() - 释放当前的鼠标捕获
 * 2. SendMessageW(hwnd, WM_SYSCOMMAND, SC_MOVE | HTCAPTION, 0) - 告诉 Windows：
 *    "从标题栏位置开始移动这个窗口"
 * 3. Windows 接管后续的拖拽操作，直到用户释放鼠标
 * 
 * @param nativeWindowHandle - BrowserWindow.getNativeWindowHandle() 的返回值
 * @returns 是否成功启动原生拖拽
 */
export async function startNativeWindowDrag(nativeWindowHandle: Buffer): Promise<boolean> {
  // 确保 API 已初始化
  if (!await initializeNativeAPIs()) {
    log.error("Cannot start native drag: APIs not initialized");
    return false;
  }

  if (!ReleaseCapture || !SendMessageW) {
    log.error("Native APIs not available");
    return false;
  }

  try {
    const hwnd = getHwndFromBuffer(nativeWindowHandle);
    
    log.debug("Starting native window drag", { hwnd: hwnd.toString() });
    
    // 步骤 1: 释放鼠标捕获
    // 这是必需的，因为渲染进程可能已经捕获了鼠标
    ReleaseCapture();
    
    // 步骤 2: 发送系统命令让 Windows 开始拖拽
    // SC_MOVE | HTCAPTION (0xF012) 表示从标题栏开始移动
    // 这会触发 Windows 的原生窗口拖拽行为
    const moveCommand = BigInt(SC_MOVE | HTCAPTION);
    SendMessageW(hwnd, WM_SYSCOMMAND, moveCommand, BigInt(0));
    
    log.debug("Native window drag initiated");
    return true;
  } catch (error) {
    log.error("Failed to start native window drag", error);
    return false;
  }
}

/**
 * 检查原生拖拽是否可用
 */
export function isNativeDragAvailable(): boolean {
  return process.platform === "win32";
}

/**
 * 预初始化 API（可选，用于启动时预加载）
 */
export async function preloadNativeAPIs(): Promise<void> {
  if (process.platform === "win32") {
    await initializeNativeAPIs();
  }
}

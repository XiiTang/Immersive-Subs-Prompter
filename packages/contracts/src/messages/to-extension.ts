import type { ControlAction, LoopCommandPayload, SeekCommandPayload } from "../core/transport.js";

interface ToExtensionBaseMessage {
  source: "usp-desktop";
}

interface ToExtensionTabMessage extends ToExtensionBaseMessage {
  tabId: number;
}

export interface ControlSeekCommandMessage extends ToExtensionTabMessage {
  type: "control-command";
  action: "seek";
  payload: SeekCommandPayload;
}

export interface ControlLoopCommandMessage extends ToExtensionTabMessage {
  type: "control-command";
  action: "loop";
  payload: LoopCommandPayload;
}

export interface ControlPauseCommandMessage extends ToExtensionTabMessage {
  type: "control-command";
  action: "pause";
}

export interface ControlPlayCommandMessage extends ToExtensionTabMessage {
  type: "control-command";
  action: "play";
}

export interface ControlStopLoopCommandMessage extends ToExtensionTabMessage {
  type: "control-command";
  action: "stopLoop";
}

export interface HeartbeatMessage extends ToExtensionBaseMessage {
  type: "heartbeat";
}

export type ControlCommandMessage =
  | ControlSeekCommandMessage
  | ControlLoopCommandMessage
  | ControlPauseCommandMessage
  | ControlPlayCommandMessage
  | ControlStopLoopCommandMessage;

export type ToExtensionMessage = ControlCommandMessage | HeartbeatMessage;
export type ControlCommandType = Extract<ToExtensionMessage, { type: "control-command" }>["action"];
export type ControlCommandPayload<TAction extends ControlAction> =
  Extract<ControlCommandMessage, { action: TAction }> extends { payload: infer TPayload }
    ? TPayload
    : never;

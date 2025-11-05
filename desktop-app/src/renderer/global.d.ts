import type { RendererApi } from "../preload.js";

declare global {
  interface Window {
    usp: RendererApi;
  }
}

export {};

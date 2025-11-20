/// <reference types="vite/client" />

import type { RendererApi } from "../preload.js";

declare global {
  interface Window {
    usp: RendererApi;
  }
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

export {};

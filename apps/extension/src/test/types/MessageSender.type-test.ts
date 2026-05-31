import type { VideoStateSnapshot } from "@immersive-subs/contracts";
import { send } from "../../connection/MessageSender";

declare const snapshot: VideoStateSnapshot;

send("time-update", snapshot);
send("video-ended", {});

// @ts-expect-error video-ended does not carry page context in the extension contract.
send("video-ended", { pageUrl: "https://example.com/watch?v=1" });

// @ts-expect-error time-update requires the full video state snapshot payload.
send("time-update", {});

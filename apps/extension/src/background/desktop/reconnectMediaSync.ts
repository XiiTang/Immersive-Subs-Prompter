import type { MediaStateRecord } from "../../shared/types";
import { selectCurrentMediaState } from "../tabs/MediaStateSelectors";
import type { DesktopConnectionSendPayload } from "./DesktopConnection";

type MediaStateSource = {
  list(): MediaStateRecord[];
};

type DesktopMediaSender = {
  send(payload: DesktopConnectionSendPayload): void;
};

export function sendCurrentMediaContext(
  connection: DesktopMediaSender,
  mediaStateStore: MediaStateSource
) {
  const current = selectCurrentMediaState(mediaStateStore.list());

  if (!current) {
    return;
  }

  connection.send({
    tabId: current.tabId,
    type: "video-context",
    payload: current
  });
}

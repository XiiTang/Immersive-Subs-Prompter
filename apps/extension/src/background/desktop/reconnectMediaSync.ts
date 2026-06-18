import type { MediaStateRecord } from "../../shared/types";
import { projectMediaStateRecord, selectCurrentMediaState } from "../tabs/MediaStateSelectors";
import type { DesktopConnectionSendPayload } from "./DesktopConnection";

type MediaStateSource = {
  list(): MediaStateRecord[];
};

type DesktopMediaSender = {
  send(payload: DesktopConnectionSendPayload): void;
};

export function sendCurrentMediaContext(
  connection: DesktopMediaSender,
  mediaStateStore: MediaStateSource,
  now = Date.now()
) {
  const current = selectCurrentMediaState(mediaStateStore.list());

  if (!current) {
    return;
  }

  connection.send({
    tabId: current.tabId,
    type: "video-context",
    payload: projectMediaStateRecord(current, now)
  });
}

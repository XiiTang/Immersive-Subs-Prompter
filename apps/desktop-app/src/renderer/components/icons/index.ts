import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Folder,
  Lock,
  Maximize,
  Mic,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Server,
  Settings,
  SlidersHorizontal,
  Trash2,
  User,
  X,
  type LucideIcon
} from "@lucide/vue";
import { defineComponent, h, type PropType } from "vue";
import { iconClass, iconSizePx, type IconSize } from "./iconSizing";

function icon(component: LucideIcon) {
  return defineComponent({
    props: {
      size: {
        type: String as PropType<IconSize>,
        default: "md"
      }
    },
    setup(props, { attrs }) {
      return () => {
        const { class: className, ...rest } = attrs;
        return h(component, {
          ...rest,
          class: [iconClass(props.size), className],
          size: iconSizePx[props.size],
          strokeWidth: 2,
          "aria-hidden": "true"
        });
      };
    }
  });
}

export const IconAdd = icon(Plus);
export const IconBookOpen = icon(BookOpen);
export const IconChevronDown = icon(ChevronDown);
export const IconChevronUp = icon(ChevronUp);
export const IconCheck = icon(Check);
export const IconClose = icon(X);
export const IconCopy = icon(Copy);
export const IconDelete = icon(Trash2);
export const IconExternalLink = icon(ExternalLink);
export const IconFolder = icon(Folder);
export const IconFullscreen = icon(Maximize);
export const IconLock = icon(Lock);
export const IconMic = icon(Mic);
export const IconPause = icon(Pause);
export const IconPin = icon(Pin);
export const IconPlay = icon(Play);
export const IconFeatures = icon(SlidersHorizontal);
export const IconRefresh = icon(RefreshCw);
export const IconServer = icon(Server);
export const IconSettings = icon(Settings);
export const IconUser = icon(User);

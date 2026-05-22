export type IconSize = "sm" | "md" | "lg";

export const iconSizePx: Record<IconSize, number> = {
  sm: 14,
  md: 16,
  lg: 20
};

export function iconClass(size: IconSize) {
  return ["icon", `icon--${size}`];
}

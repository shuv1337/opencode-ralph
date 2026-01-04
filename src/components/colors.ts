/**
 * Tokyo Night color palette for the TUI
 */
export const colors = {
  bg: "#1a1b26",
  bgDark: "#16161e",
  bgHighlight: "#292e42",
  bgPanel: "#1f2335",
  fg: "#c0caf5",
  fgDark: "#636d9c",
  fgMuted: "#a9b1d6",
  green: "#9ece6a",
  red: "#f7768e",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  purple: "#bb9af7",
  cyan: "#7dcfff",
  border: "#414868",
};

/**
 * Icons for different tool types displayed in the event log
 */
export const TOOL_ICONS: Record<string, string> = {
  read: "\u2192", // →
  write: "\u2190", // ←
  edit: "\u2190", // ←
  glob: "\u2731", // ✱
  grep: "\u2731", // ✱
  bash: "$",
  task: "\u25C9", // ◉
  webfetch: "%",
  websearch: "\u25C8", // ◈
  codesearch: "\u25C7", // ◇
  todowrite: "\u2610", // ☐
  todoread: "\u2610", // ☐
};

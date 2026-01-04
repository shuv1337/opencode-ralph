import { colors } from "./colors";
import { formatEta } from "../util/time";

export type HeaderProps = {
  status: "starting" | "running" | "paused" | "complete" | "error";
  iteration: number;
  tasksComplete: number;
  totalTasks: number;
  eta: number | null;
};

/**
 * Header component displaying status, iteration, tasks, and ETA.
 * Uses flexDirection="row" with a bottom border.
 */
export function Header(props: HeaderProps) {
  // Status indicator with appropriate icon and color
  const getStatusDisplay = () => {
    switch (props.status) {
      case "running":
        return { icon: "\u25A0", color: colors.green }; // ■
      case "paused":
        return { icon: "\u23F8", color: colors.yellow }; // ⏸
      case "complete":
        return { icon: "\u2713", color: colors.green }; // ✓
      case "error":
        return { icon: "\u2717", color: colors.red }; // ✗
      case "starting":
      default:
        return { icon: "\u25CC", color: colors.fgMuted }; // ◌
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <box
      flexDirection="row"
      width="100%"
      height={2}
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
      borderStyle="single"
      border={["bottom"]}
      borderColor={colors.border}
      backgroundColor={colors.bg}
    >
      {/* Status indicator */}
      <text fg={statusDisplay.color}>{statusDisplay.icon}</text>
      <text fg={colors.fg}> {props.status}</text>

      {/* Separator */}
      <text fg={colors.fgMuted}>{"  \u2502  "}</text>

      {/* Iteration display */}
      <text fg={colors.fg}>iteration {props.iteration}</text>

      {/* Separator */}
      <text fg={colors.fgMuted}>{"  \u2502  "}</text>

      {/* Task progress with inline progress bar */}
      <text fg={colors.fg}>
        {props.tasksComplete}/{props.totalTasks} tasks{" "}
        <span style={{ fg: colors.fgMuted }}>[</span>
        <span style={{ fg: colors.green }}>
          {"\u25A0".repeat(
            props.totalTasks > 0
              ? Math.round((props.tasksComplete / props.totalTasks) * 10)
              : 0
          )}
        </span>
        <span style={{ fg: colors.fgMuted }}>
          {"\u25A1".repeat(
            10 -
              (props.totalTasks > 0
                ? Math.round((props.tasksComplete / props.totalTasks) * 10)
                : 0)
          )}
        </span>
        <span style={{ fg: colors.fgMuted }}>]</span>
      </text>

      {/* Separator */}
      <text fg={colors.fgMuted}>{"  \u2502  "}</text>

      {/* ETA display */}
      <text fg={colors.fgMuted}>{formatEta(props.eta)}</text>
    </box>
  );
}



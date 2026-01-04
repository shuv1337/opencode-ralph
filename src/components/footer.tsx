import { colors } from "./colors";
import { formatDuration } from "../util/time";

export type FooterProps = {
  commits: number;
  elapsed: number;
  paused: boolean;
  linesAdded: number;
  linesRemoved: number;
};

/**
 * Footer component displaying keybind hints, commits count, and elapsed time.
 * Uses flexDirection="row" with a top border.
 */
export function Footer(props: FooterProps) {
  return (
    <box
      flexDirection="row"
      width="100%"
      height={2}
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
      borderStyle="single"
      border={["top"]}
      borderColor={colors.border}
      backgroundColor={colors.bg}
    >
      {/* Keybind hints (left side) */}
      <text fg={colors.fgMuted}>
        (<span style={{ fg: colors.fg }}>q</span>) interrupt  (<span style={{ fg: colors.fg }}>p</span>) {props.paused ? "resume" : "pause"}
      </text>

      {/* Spacer */}
      <box flexGrow={1} />

      {/* Stats (right side) */}
      <text>
        <span style={{ fg: colors.green }}>+{props.linesAdded}</span>
        <span style={{ fg: colors.fgMuted }}> / </span>
        <span style={{ fg: colors.red }}>-{props.linesRemoved}</span>
        <span style={{ fg: colors.fgMuted }}>
          {" "}{"\u00B7"}{" "}{props.commits} commits {"\u00B7"} {formatDuration(props.elapsed)}
        </span>
      </text>
    </box>
  );
}

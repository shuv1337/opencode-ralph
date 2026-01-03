import { For, Show } from "solid-js";
import { colors } from "./colors";
import { formatDuration } from "../util/time";
import type { ToolEvent } from "../state";

export type LogProps = {
  events: ToolEvent[];
};

/**
 * Renders an iteration separator line.
 * Format: ── iteration {n} ──────────── {duration} · {commits} commit(s) ──
 */
function SeparatorEvent(props: { event: ToolEvent }) {
  const durationText = () =>
    props.event.duration !== undefined
      ? formatDuration(props.event.duration)
      : "running";
  const commitCount = () => props.event.commitCount ?? 0;
  const commitText = () =>
    `${commitCount()} commit${commitCount() !== 1 ? "s" : ""}`;

  return (
    <box width="100%" paddingTop={1} paddingBottom={1} flexDirection="row">
      <text fg={colors.fgMuted}>{"── "}</text>
      <text fg={colors.fg}>iteration {props.event.iteration}</text>
      <text fg={colors.fgMuted}>{" ────────────── "}</text>
      <text fg={colors.fg}>{durationText()}</text>
      <text fg={colors.fgMuted}>{" · "}</text>
      <text fg={colors.fg}>{commitText()}</text>
      <text fg={colors.fgMuted}>{" ──"}</text>
    </box>
  );
}

/**
 * Renders a tool event line.
 * Format: {icon} {text}
 */
function ToolEventItem(props: { event: ToolEvent }) {
  return (
    <box width="100%">
      <text fg={colors.fg}>{props.event.text}</text>
    </box>
  );
}

/**
 * Scrollable event log component displaying tool events and iteration separators.
 * Uses stickyScroll to keep the view at the bottom as new events arrive.
 */
export function Log(props: LogProps) {
  return (
    <scrollbox
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      rootOptions={{
        backgroundColor: colors.bg,
      }}
      viewportOptions={{
        backgroundColor: colors.bgDark,
      }}
      verticalScrollbarOptions={{
        visible: true,
        trackOptions: {
          backgroundColor: colors.border,
        },
      }}
    >
      <For each={props.events}>
        {(event) => (
          <Show
            when={event.type === "separator"}
            fallback={<ToolEventItem event={event} />}
          >
            <SeparatorEvent event={event} />
          </Show>
        )}
      </For>
    </scrollbox>
  );
}

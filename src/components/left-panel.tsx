import { For, Show, createEffect, createMemo } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTheme } from "../context/ThemeContext";
import { renderMarkdownBold, stripMarkdownBold } from "../lib/text-utils";
import { taskStatusIndicators } from "./tui-theme";
import type { TaskStatus, UiTask } from "./tui-types";

export type LeftPanelProps = {
  tasks: UiTask[];
  selectedIndex: number;
  width: number;
  /** Panel height - used to trigger scroll recalculation on terminal resize */
  height: number;
  /** Total number of tasks (including completed) - used to show "all completed" message */
  totalTasks?: number;
  /** Whether completed tasks are currently being shown */
  showingCompleted?: boolean;
  /** Callback when a task is clicked/selected */
  onSelect?: (index: number) => void;
};

function truncateText(text: string, maxWidth: number): string {
  // Strip markdown to get actual display length
  const plainText = stripMarkdownBold(text);
  if (plainText.length <= maxWidth) return text;
  if (maxWidth <= 3) return plainText.slice(0, maxWidth);
  
  // Need to truncate - work with plain text for length calculation
  // but preserve markdown in the truncated portion
  const targetLength = maxWidth - 1; // Leave room for ellipsis
  let plainIndex = 0;
  let originalIndex = 0;
  
  while (plainIndex < targetLength && originalIndex < text.length) {
    // Skip ** markers
    if (text.slice(originalIndex, originalIndex + 2) === "**") {
      originalIndex += 2;
      continue;
    }
    plainIndex++;
    originalIndex++;
  }
  
  return stripMarkdownBold(text.slice(0, originalIndex)) + "…";
}

// Fixed width for task ID column alignment
const ID_COLUMN_WIDTH = 10;

function getStatusColor(status: TaskStatus, theme: ReturnType<typeof useTheme>["theme"]): string {
  const t = theme();
  switch (status) {
    case "done":
      return t.success;      // green
    case "actionable":
      return t.primary;      // blue
    case "pending":
    default:
      return t.textMuted;    // gray
  }
}

function TaskRow(props: {
  task: UiTask;
  isSelected: boolean;
  maxWidth: number;
  index: number;
}) {
  const { theme } = useTheme();
  const t = () => theme();

  // Color-coded left-margin status indicator
  const statusColor = () => getStatusColor(props.task.status, theme);
  const statusIndicator = () => taskStatusIndicators[props.task.status];

  // Fixed-width ID column for alignment
  const paddedId = () => props.task.id.padEnd(ID_COLUMN_WIDTH).slice(0, ID_COLUMN_WIDTH);

  // Title width accounts for: status indicator (1) + space (1) + ID (10) + space (1) + padding (2)
  const titleWidth = () => Math.max(10, props.maxWidth - ID_COLUMN_WIDTH - 5);
  const truncatedTitle = () => truncateText(props.task.title, titleWidth());

  // Row background: zebra striping with selection override
  const rowBg = () => {
    if (props.isSelected) return t().primary;
    return props.index % 2 === 0 ? t().background : t().backgroundPanel;
  };

  // Text colors: inverted for selection, muted for done tasks
  const textColor = () => {
    if (props.isSelected) return t().background;
    if (props.task.status === "done") return t().textMuted;
    return t().text;
  };

  // Bold/emphasis color: same as text when selected, accent otherwise
  const boldColor = () => {
    if (props.isSelected) return t().background;
    return t().accent;
  };

  const idColor = () => {
    if (props.isSelected) return t().background;
    return t().textMuted;
  };

  // Render title with markdown bold parsing
  const renderedTitle = () => renderMarkdownBold(
    truncatedTitle(), 
    textColor(), 
    boldColor(),
    t().secondary // Use secondary color for [tags]
  );

  return (
    <box
      width="100%"
      flexDirection="row"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={rowBg()}
    >
      <text fg={statusColor()}>{statusIndicator()}</text>
      <text fg={idColor()}> {paddedId()}</text>
      <text fg={textColor()}> </text>
      {renderedTitle()}
    </box>
  );
}

export function LeftPanel(props: LeftPanelProps) {
  const { theme } = useTheme();
  const t = () => theme();
  let scrollboxRef: ScrollBoxRenderable | undefined;

  const maxRowWidth = () => Math.max(20, props.width - 4);

  // Compute the empty state message based on context
  // Uses createMemo to ensure proper reactivity when task state changes
  const emptyMessage = createMemo(() => {
    const totalTasks = props.totalTasks ?? 0;
    const showingCompleted = props.showingCompleted ?? false;
    
    // If there are total tasks but none visible, all are completed (and hidden)
    if (totalTasks > 0 && !showingCompleted) {
      return `All ${totalTasks} tasks completed! 🎉`;
    }
    
    // No tasks at all
    return "No tasks loaded";
  });

  // Track the task list length for reactivity - forces re-render when it changes
  const taskCount = createMemo(() => props.tasks.length);

  createEffect(() => {
    const selectedIndex = props.selectedIndex;
    const count = taskCount();
    // Access height to create reactive dependency - effect re-runs on terminal resize
    const _height = props.height;

    if (!scrollboxRef || count === 0) {
      // Reset scroll position when task list becomes empty
      if (scrollboxRef) {
        scrollboxRef.scrollTop = 0;
      }
      return;
    }

    // Direct Sync Scrolling:
    // The scroll position is directly tied to the selection index.
    // This provides immediate, 1-to-1 visual feedback for every navigation step,
    // ensuring the selected task is always at the top of the visible list
    // (except when reaching the end of the task list).
    const updateScroll = () => {
      if (!scrollboxRef) return;

      const nextTop = selectedIndex;

      if (nextTop !== scrollboxRef.scrollTop) {
        scrollboxRef.scrollTop = nextTop;
        // Force immediate render to keep scrollbar in perfect sync
        scrollboxRef.requestRender();
      }
    };

    // Use queueMicrotask to defer until after Solid's render cycle
    queueMicrotask(() => updateScroll());
  });

  return (
    <box
      title="Tasks"
      flexGrow={1}
      flexShrink={1}
      minWidth={30}
      maxWidth={50}
      flexDirection="column"
      backgroundColor={t().background}
      border
      borderColor={t().border}
    >
      <scrollbox
        ref={(el) => {
          scrollboxRef = el;
        }}
        flexGrow={1}
        width="100%"
        stickyScroll={false}
        rootOptions={{
          backgroundColor: t().background,
        }}
        viewportOptions={{
          backgroundColor: t().background,
        }}
        verticalScrollbarOptions={{
          visible: true,
          trackOptions: {
            backgroundColor: t().border,
          },
        }}
      >
        {/* Use keyed rendering to force complete re-render when task count changes */}
        <Show
          when={taskCount() > 0}
          fallback={
            <box padding={1} flexDirection="column">
              <text fg={t().success}>{emptyMessage()}</text>
              <Show when={(props.totalTasks ?? 0) > 0 && !(props.showingCompleted ?? false)}>
                <text fg={t().textMuted}>Press Shift+C to show completed</text>
              </Show>
            </box>
          }
        >
          <For each={props.tasks}>
            {(task, index) => (
              <box onMouseDown={() => props.onSelect?.(index())}>
                <TaskRow
                  task={task}
                  isSelected={index() === props.selectedIndex}
                  maxWidth={maxRowWidth()}
                  index={index()}
                />
              </box>
            )}
          </For>
        </Show>
      </scrollbox>
    </box>
  );
}

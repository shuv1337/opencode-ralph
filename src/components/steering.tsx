import { useKeyboard } from "@opentui/solid";
import type { KeyEvent } from "@opentui/core";
import { createSignal, onMount } from "solid-js";
import { colors } from "./colors";

export type SteeringOverlayProps = {
  visible: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
};

/**
 * Steering mode overlay for sending messages to the active session.
 * Opens with `:` key, closes with ESC, sends with Enter.
 */
export function SteeringOverlay(props: SteeringOverlayProps) {
  const [input, setInput] = createSignal("");

  // Handle keyboard events for the steering input
  useKeyboard((e: KeyEvent) => {
    if (!props.visible) return;

    // ESC: close overlay
    if (e.name === "escape" || e.name === "Escape") {
      props.onClose();
      return;
    }

    // Enter: send message
    if (e.name === "return" || e.name === "enter" || e.name === "Enter") {
      const message = input().trim();
      if (message) {
        props.onSend(message);
        setInput("");
      }
      props.onClose();
      return;
    }

    // Backspace: delete last character
    if (e.name === "backspace" || e.name === "Backspace") {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    // Regular character input (single printable characters)
    if (e.raw && e.raw.length === 1 && !e.ctrl && !e.meta) {
      setInput((prev) => prev + e.raw);
    }
  });

  if (!props.visible) return null;

  return (
    <box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={colors.bgHighlight}
    >
      <box
        width="60%"
        padding={1}
        borderStyle="single"
        borderColor={colors.purple}
        backgroundColor={colors.bgPanel}
        flexDirection="column"
      >
        {/* Title */}
        <text fg={colors.purple}>Steer Agent</text>

        {/* Input box */}
        <box
          marginTop={1}
          padding={1}
          borderStyle="single"
          borderColor={colors.border}
          backgroundColor={colors.bgDark}
        >
          <text fg={input() ? colors.fg : colors.fgMuted}>
            {input() || "Type message and press Enter"}
          </text>
        </box>

        {/* Help text */}
        <text fg={colors.fgDark} marginTop={1}>
          <span style={{ fg: colors.fgMuted }}>Enter</span> send  <span style={{ fg: colors.fgMuted }}>Esc</span> cancel
        </text>
      </box>
    </box>
  );
}

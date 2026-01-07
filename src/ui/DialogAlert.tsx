import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import { Dialog } from "./Dialog";
import { useDialog } from "../context/DialogContext";
import { colors } from "../components/colors";

export type DialogAlertProps = {
  /** Dialog title displayed at the top */
  title?: string;
  /** Message to display */
  message: string;
  /** Callback when user dismisses (Enter, Escape, or button) */
  onDismiss?: () => void;
  /** Optional custom border color */
  borderColor?: string;
  /** Optional variant for styling (info, success, warning, error) */
  variant?: "info" | "success" | "warning" | "error";
};

/**
 * Alert dialog for displaying messages to the user.
 * Displays a message and Dismiss button.
 * Enter or Escape key dismisses the dialog.
 */
export function DialogAlert(props: DialogAlertProps) {
  const { pop } = useDialog();

  // Get variant-specific colors
  const getVariantColor = () => {
    switch (props.variant) {
      case "success":
        return colors.green;
      case "warning":
        return colors.yellow;
      case "error":
        return colors.red;
      case "info":
      default:
        return colors.cyan;
    }
  };

  const handleDismiss = () => {
    props.onDismiss?.();
    pop();
  };

  // Handle Enter/Escape keyboard shortcuts
  useKeyboard((e: KeyEvent) => {
    // Enter key to dismiss
    if (e.name === "return" || e.name === "enter" || e.name === "Enter") {
      handleDismiss();
      return;
    }
    // Escape is also handled by base Dialog, but we handle it here
    // to ensure onDismiss is called
    if (e.name === "escape" || e.name === "Escape") {
      handleDismiss();
      return;
    }
  });

  const variantColor = getVariantColor();

  return (
    <Dialog
      borderColor={props.borderColor || variantColor}
      onClose={handleDismiss}
      width="50%"
    >
      {/* Title (optional) */}
      {props.title && (
        <box marginBottom={1}>
          <text fg={variantColor} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
        </box>
      )}

      {/* Message */}
      <box marginBottom={1}>
        <text fg={colors.fg}>{props.message}</text>
      </box>

      {/* Button row */}
      <box flexDirection="row" justifyContent="flex-end">
        <box flexDirection="row">
          <text fg={colors.fgMuted}>[</text>
          <text fg={variantColor}>Enter</text>
          <text fg={colors.fgMuted}>] Dismiss</text>
        </box>
      </box>
    </Dialog>
  );
}

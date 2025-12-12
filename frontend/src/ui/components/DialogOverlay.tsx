import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { keyframes } from "@emotion/react";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloudIcon from "@mui/icons-material/Cloud";
import SentimentSatisfiedIcon from "@mui/icons-material/SentimentSatisfied";
import SentimentNeutralIcon from "@mui/icons-material/SentimentNeutral";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";
import {
  DialogFragment,
  DialogEmotion,
  ServerMessage,
  ServerMessageType,
} from "@shared/types";
import { alpha } from "../theme";

interface DialogOverlayProps {
  client: WebSocketClient;
  renderer: Renderer;
}

interface ActiveDialog {
  fragment: DialogFragment;
  startTime: number;
}

const DIALOG_DURATION = 5000;
const FADE_OUT_DURATION = 1000;
const DIALOG_VERTICAL_OFFSET = 40;
const DIALOG_BOUNDARY_PADDING = 24;

interface CanvasMetrics {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

const getCanvasMetrics = (renderer: Renderer): CanvasMetrics => {
  const app = renderer.getApp();
  const canvas = app?.canvas as HTMLCanvasElement | undefined;
  if (!canvas) {
    return { offsetX: 0, offsetY: 0, width: 0, height: 0 };
  }

  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  if (parentRect) {
    return {
      offsetX: canvasRect.left - parentRect.left,
      offsetY: canvasRect.top - parentRect.top,
      width: parentRect.width,
      height: parentRect.height,
    };
  }

  return {
    offsetX: canvasRect.left,
    offsetY: canvasRect.top,
    width: canvasRect.width,
    height: canvasRect.height,
  };
};

// Animations
const appearAnimation = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

export const DialogOverlay: React.FC<DialogOverlayProps> = ({
  client,
  renderer,
}) => {
  const theme = useTheme();
  const bubbleBackground = alpha(
    theme.palette.common.white,
    theme.opacity?.dialog ?? 0.96,
  );
  const bubbleBorder = alpha(theme.palette.common.white, theme.opacity?.medium ?? 0.12);
  const bubbleShadow = `0 20px 40px ${alpha("#000", theme.opacity?.overlay ?? 0.55)}`;
  const getEmotionIcon = (emotion: DialogEmotion): React.JSX.Element => {
    switch (emotion) {
      case DialogEmotion.JOY:
        return (
          <WbSunnyIcon
            sx={{ fontSize: 16, color: theme.palette.emotions.joy }}
          />
        );
      case DialogEmotion.LOVE:
        return (
          <FavoriteIcon
            sx={{ fontSize: 16, color: theme.palette.emotions.love }}
          />
        );
      case DialogEmotion.SADNESS:
        return (
          <CloudIcon
            sx={{ fontSize: 16, color: theme.palette.emotions.sadness }}
          />
        );
      case DialogEmotion.NOSTALGIA:
        return (
          <SentimentSatisfiedIcon
            sx={{ fontSize: 16, color: theme.palette.emotions.nostalgia }}
          />
        );
      case DialogEmotion.NEUTRAL:
      default:
        return (
          <SentimentNeutralIcon
            sx={{ fontSize: 16, color: theme.palette.emotions.neutral }}
          />
        );
    }
  };
  const [activeDialogs, setActiveDialogs] = useState<Map<string, ActiveDialog>>(
    new Map(),
  );
  const [dialogPositions, setDialogPositions] = useState<
    Map<string, { x: number; y: number; opacity: number }>
  >(new Map());
  const requestRef = useRef<number | undefined>(undefined);

  // Use renderer dimensions to project world coordinates to screen coordinates
  const updatePositions = useCallback((): void => {
    const now = Date.now();
    const newPositions = new Map<
      string,
      { x: number; y: number; opacity: number }
    >();
    const toRemove: string[] = [];
    const canvasMetrics = getCanvasMetrics(renderer);

    activeDialogs.forEach((dialog, id) => {
      const elapsed = now - dialog.startTime;

      if (elapsed >= DIALOG_DURATION + FADE_OUT_DURATION) {
        toRemove.push(id);
        return;
      }

      // Calculate opacity
      let opacity = 1;
      if (elapsed >= DIALOG_DURATION) {
        opacity = 1 - (elapsed - DIALOG_DURATION) / FADE_OUT_DURATION;
      }

      // Project world coordinates to the DOM overlay using Pixi's global transform
      const world = renderer.getWorldContainer();

      if (world) {
        const screenPos = world.toGlobal({
          x: dialog.fragment.x,
          y: dialog.fragment.y,
        });
        let x = screenPos.x + canvasMetrics.offsetX;
        let y = screenPos.y + canvasMetrics.offsetY - DIALOG_VERTICAL_OFFSET;

        if (canvasMetrics.width > 0 && canvasMetrics.height > 0) {
          const maxX = canvasMetrics.width - DIALOG_BOUNDARY_PADDING;
          const maxY = canvasMetrics.height - DIALOG_BOUNDARY_PADDING;
          x = Math.min(Math.max(x, DIALOG_BOUNDARY_PADDING), maxX);
          y = Math.min(Math.max(y, DIALOG_BOUNDARY_PADDING), maxY);
        }

        newPositions.set(id, { x, y, opacity });
      }
    });

    if (toRemove.length > 0) {
      setActiveDialogs((prev) => {
        const next = new Map(prev);
        toRemove.forEach((id) => next.delete(id));
        return next;
      });
    }

    setDialogPositions(newPositions);
    requestRef.current = requestAnimationFrame(updatePositions);
  }, [activeDialogs, renderer]);

  useEffect((): (() => void) => {
    requestRef.current = requestAnimationFrame(updatePositions);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updatePositions]);

  useEffect((): (() => void) => {
    const handleDialog = (data: ServerMessage): void => {
      if (data.type === ServerMessageType.DIALOG && data.dialog) {
        const fragment = data.dialog;
        setActiveDialogs((prev) => {
          const next = new Map(prev);
          next.set(fragment.id, { fragment, startTime: Date.now() });
          return next;
        });
      }
    };

    client.on(ServerMessageType.DIALOG, handleDialog);
    return (): void => {
      client.off(ServerMessageType.DIALOG, handleDialog);
    };
  }, [client]);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
      {Array.from(activeDialogs.entries()).map(([id, { fragment }]) => {
        const pos = dialogPositions.get(id);
        if (!pos) return null;

        return (
          <Box
            key={id}
            sx={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translateX(-50%)",
              maxWidth: 200,
              p: 1.5,
              bgcolor: bubbleBackground,
              borderRadius: theme.tokens.borderRadius.md,
              boxShadow: bubbleShadow,
              border: `1px solid ${bubbleBorder}`,
              color: theme.palette.text.primary,
              opacity: pos.opacity,
              animation: `${appearAnimation} 0.3s ease-out`,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: `8px solid ${bubbleBackground}`,
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              {fragment.emotion &&
                getEmotionIcon(fragment.emotion as DialogEmotion)}
              {fragment.speaker && (
                <Typography
                  variant="caption"
                  display="block"
                  sx={{ fontWeight: "bold", color: "text.secondary" }}
                >
                  {fragment.speaker}
                </Typography>
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{ color: "text.primary", lineHeight: 1.2 }}
            >
              {fragment.text}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

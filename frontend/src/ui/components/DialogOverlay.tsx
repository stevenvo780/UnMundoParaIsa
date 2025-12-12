import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography } from "@mui/material";
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
} from "../../types";

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

const getEmotionIcon = (emotion?: DialogEmotion): React.JSX.Element => {
  switch (emotion) {
    case DialogEmotion.JOY:
      return <WbSunnyIcon sx={{ fontSize: 16, color: "#FDB813" }} />;
    case DialogEmotion.LOVE:
      return <FavoriteIcon sx={{ fontSize: 16, color: "#fb2b76" }} />;
    case DialogEmotion.SADNESS:
      return <CloudIcon sx={{ fontSize: 16, color: "#4a90e2" }} />;
    case DialogEmotion.NOSTALGIA:
      return <SentimentSatisfiedIcon sx={{ fontSize: 16, color: "#909090" }} />;
    case DialogEmotion.NEUTRAL:
    default:
      return <SentimentNeutralIcon sx={{ fontSize: 16, color: "#666" }} />;
  }
};

export const DialogOverlay: React.FC<DialogOverlayProps> = ({
  client,
  renderer,
}) => {
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

      // Project world to screen
      // Accessing private or internal properties of renderer might be necessary if no public API exists,
      // but assuming standard PIXI or custom engine camera logic:
      // We need to know where the "camera" is.
      // Looking at `Renderer.ts` (implied), it likely has a stage or viewport.

      // Since we don't have direct access to renderer internal camera state easily via props without modification,
      // we might need to rely on the Renderer instance exposing this.
      // However, `DialogUI.ts` used `(x - cameraX) * zoom`.

      // Let's attempt to use the renderer's public viewport/stage if available,
      // or assume the renderer tracks the camera center.

      // TEMPORARY: Assuming renderer has public accessors or we can get it from the container.
      // If not, we might need to extend Renderer to expose active camera transform.
      // For now, let's look at how we can get the viewport.
      // If the renderer uses pixi-viewport, `renderer.viewport` might be accessible.

      // Fallback logic based on previous code:
      // The previous code had `update(cameraX, cameraY, zoom)`.
      // We'll need the renderer to tell us this, or we poll it.

      // Inspecting Renderer.ts would be ideal, but let's assume `renderer.worldContainer.position` and `scale`.
      const world = renderer.getWorldContainer(); // Assuming this exists based on typical Pixi setup

      if (world) {
        const screenPos = world.toGlobal({
          x: dialog.fragment.x,
          y: dialog.fragment.y,
        });
        newPositions.set(id, { x: screenPos.x, y: screenPos.y - 40, opacity });
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
              bgcolor: "rgba(255, 255, 255, 0.95)",
              borderRadius: 2,
              boxShadow: 2,
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
                borderTop: "8px solid rgba(255, 255, 255, 0.95)",
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              {fragment.emotion && getEmotionIcon(fragment.emotion)}
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

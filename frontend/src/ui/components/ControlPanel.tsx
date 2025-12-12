import React, { useState, useEffect } from "react";
import {
  Drawer,
  Typography,
  Button,
  Stack,
  FormControlLabel,
  Checkbox,
  Divider,
  Box,
  IconButton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";
import {
  SimulationMetrics,
  ClientMessageType,
  FieldType,
  ServerMessage,
  ServerMessageType,
} from "@shared/types";

interface ControlPanelProps {
  client: WebSocketClient;
  renderer: Renderer;
}

const SIDEBAR_WIDTH = 300;

export const ControlPanel: React.FC<ControlPanelProps> = ({
  client,
  renderer,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [fps, setFps] = useState(0);
  const [_connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting" | "failed"
  >("disconnected");
  const [reconnectInfo, setReconnectInfo] = useState<{
    attempt: number;
    maxAttempts: number;
  } | null>(null);

  // Field toggles state
  const [showMoisture, setShowMoisture] = useState(false);
  const [showNutrients, setShowNutrients] = useState(false);

  useEffect((): (() => void) => {
    // Subscribe to events
    const handleMetrics = (data: ServerMessage): void => {
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    };

    const handleConnected = (): void => {
      setConnected(true);
      setConnectionStatus("connected");
      setReconnectInfo(null);
    };

    const handleDisconnected = (): void => {
      setConnected(false);
      setConnectionStatus("disconnected");
    };

    const handleReconnecting = (data: unknown): void => {
      const info = data as { attempt?: number; maxAttempts?: number };
      setConnectionStatus("reconnecting");
      if (info.attempt && info.maxAttempts) {
        setReconnectInfo({
          attempt: info.attempt,
          maxAttempts: info.maxAttempts,
        });
      }
    };

    const handleMaxReconnect = (): void => {
      setConnectionStatus("failed");
    };

    client.on(ServerMessageType.METRICS, handleMetrics);
    client.on("connected", handleConnected);
    client.on("disconnected", handleDisconnected);
    client.on("reconnecting", handleReconnecting);
    client.on("max_reconnect_reached", handleMaxReconnect);

    // FPS Counter
    const fpsInterval = setInterval((): void => {
      const app = renderer.getApp();
      if (app) {
        setFps(Math.round(app.ticker.FPS));
      }
    }, 1000);

    return (): void => {
      client.off(ServerMessageType.METRICS, handleMetrics);
      client.off("connected", handleConnected);
      client.off("disconnected", handleDisconnected);
      client.off("reconnecting", handleReconnecting);
      client.off("max_reconnect_reached", handleMaxReconnect);
      clearInterval(fpsInterval);
    };
  }, [client, renderer]);

  const togglePause = (): void => {
    const newState = !isPaused;
    setIsPaused(newState);
    if (newState) {
      client.send({ type: ClientMessageType.PAUSE });
    } else {
      client.send({ type: ClientMessageType.RESUME });
    }
  };

  const handleReset = (): void => {
    client.send({ type: ClientMessageType.RESET });
  };

  const handleSpawn = (): void => {
    client.send({
      type: ClientMessageType.SPAWN_ENTITY,
      x: 0, // Center
      y: 0,
    });
  };

  const toggleField = (type: FieldType, show: boolean): void => {
    if (type === FieldType.WATER) setShowMoisture(show);
    if (type === FieldType.FOOD) setShowNutrients(show);
    renderer.toggleFieldVisibility(type);
  };

  return (
    <>
      {/* Toggle Button (visible when closed) */}
      {!isOpen && (
        <Box sx={{ position: "fixed", top: 20, right: 20, zIndex: 1200 }}>
          <IconButton
            color="primary"
            onClick={() => setIsOpen(true)}
            sx={{
              bgcolor: "background.paper",
              boxShadow: 3,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

      <Drawer
        variant="persistent"
        anchor="right"
        open={isOpen}
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            p: 2,
            backgroundColor: "rgba(30, 30, 30, 0.95)", // Semi-transparent dark
            backdropFilter: "blur(8px)",
          },
        }}
      >
        <Stack spacing={2}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" color="primary">
              Un Mundo Para Isa
            </Typography>
            <IconButton onClick={() => setIsOpen(false)} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* Status */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Estado del Sistema
            </Typography>
            <Typography
              variant="body2"
              color={
                connectionStatus === "connected"
                  ? "success.main"
                  : connectionStatus === "reconnecting"
                    ? "warning.main"
                    : "error.main"
              }
            >
              {connectionStatus === "connected" && "Conectado al Servidor"}
              {connectionStatus === "disconnected" && "Desconectado"}
              {connectionStatus === "reconnecting" &&
                `Reconectando... ${reconnectInfo ? `(${reconnectInfo.attempt}/${reconnectInfo.maxAttempts})` : ""}`}
              {connectionStatus === "failed" &&
                "Error: Máximo de intentos alcanzado"}
            </Typography>
            <Typography variant="body2">FPS: {fps}</Typography>
            <Typography variant="body2">Tick: {metrics?.tick || 0}</Typography>
          </Box>

          <Divider />

          {/* Metrics */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Métricas
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Entidades: {metrics?.particleCount || 0}
              </Typography>
              <Typography variant="body2">
                Chunks Activos: {metrics?.activeChunks || 0}
              </Typography>
              <Typography variant="body2">
                Prom. Comida:{" "}
                {metrics?.fieldAverages?.food?.toFixed(2) || "0.00"}
              </Typography>
              <Typography variant="body2">
                Prom. Agua:{" "}
                {metrics?.fieldAverages?.water?.toFixed(2) || "0.00"}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Controls */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Controles
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                variant={isPaused ? "contained" : "outlined"}
                color={isPaused ? "warning" : "primary"}
                startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                onClick={togglePause}
                fullWidth
              >
                {isPaused ? "Reanudar" : "Pausar"}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RefreshIcon />}
                onClick={handleReset}
                fullWidth
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                color="info"
                startIcon={<AddIcon />}
                onClick={handleSpawn}
                fullWidth
              >
                Centro
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* Layers */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Visualización
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showMoisture}
                  onChange={(e) =>
                    toggleField(FieldType.WATER, e.target.checked)
                  }
                />
              }
              label="Humedad"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showNutrients}
                  onChange={(e) =>
                    toggleField(FieldType.FOOD, e.target.checked)
                  }
                />
              }
              label="Nutrientes"
            />
          </Box>
        </Stack>
      </Drawer>
    </>
  );
};

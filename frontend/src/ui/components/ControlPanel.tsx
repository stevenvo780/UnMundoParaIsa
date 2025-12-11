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
} from "../../types";

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
  const [connected, setConnected] = useState(false);

  // Field toggles state
  const [showMoisture, setShowMoisture] = useState(false);
  const [showNutrients, setShowNutrients] = useState(false);

  useEffect(() => {
    // Subscribe to events
    const handleMetrics = (data: ServerMessage) => {
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    };

    const handleConnected = () => setConnected(true);
    const handleDisconnected = () => setConnected(false);

    client.on("metrics", handleMetrics);
    client.on("connected", handleConnected);
    client.on("disconnected", handleDisconnected);

    // FPS Counter
    const fpsInterval = setInterval(() => {
      const app = renderer.getApp();
      if (app) {
        setFps(Math.round(app.ticker.FPS));
      }
    }, 1000);

    return () => {
      client.off("metrics", handleMetrics);
      client.off("connected", handleConnected);
      client.off("disconnected", handleDisconnected);
      clearInterval(fpsInterval);
    };
  }, [client, renderer]);

  const togglePause = () => {
    const newState = !isPaused;
    setIsPaused(newState);
    if (newState) {
      client.send({ type: ClientMessageType.PAUSE });
    } else {
      client.send({ type: ClientMessageType.RESUME });
    }
  };

  const handleReset = () => {
    client.send({ type: ClientMessageType.RESET });
  };

  const handleSpawn = () => {
    client.send({
      type: ClientMessageType.SPAWN_ENTITY,
      x: 0, // Center
      y: 0,
    });
  };

  const toggleField = (type: FieldType, show: boolean) => {
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
              color={connected ? "success.main" : "error.main"}
            >
              {connected ? "Conectado al Servidor" : "Desconectado"}
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

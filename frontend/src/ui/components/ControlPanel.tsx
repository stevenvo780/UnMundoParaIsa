import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
  Button,
  Stack,
  FormControlLabel,
  Checkbox,
  Divider,
  Box,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
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

export const ControlPanel: React.FC<ControlPanelProps> = ({
  client,
  renderer,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [fps, setFps] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Subscribe to events
    const handleTick = (data: ServerMessage) => {
      // Tick is handled in metrics or separate event
    };

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

    // Initial state
    setConnected(client.isConnected());

    // FPS Counter
    let frameCount = 0;
    const fpsInterval = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    const frameCounter = () => {
      frameCount++;
      requestAnimationFrame(frameCounter);
    };
    const animId = requestAnimationFrame(frameCounter);

    return () => {
      // Cleanup (assuming client has off, or we just rely on component unmount not happening often)
      // client.off... (WebSocketClient might not expose off, but listeners are persistent in this app)
      clearInterval(fpsInterval);
      cancelAnimationFrame(animId);
    };
  }, [client]);

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        top: 20,
        right: 20,
        width: 300,
        p: 2,
        borderRadius: 2,
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        zIndex: 1000,
        backgroundColor: "rgba(22, 33, 62, 0.95)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          color="primary"
          sx={{ fontWeight: "bold", fontSize: "1.1rem" }}
        >
          Un Mundo Para Isa
        </Typography>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: connected ? "success.main" : "error.main",
            boxShadow: `0 0 8px ${connected ? "#4caf50" : "#f44336"}`,
          }}
          title={connected ? "Conectado" : "Desconectado"}
        />
      </Box>

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            Tick
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {metrics?.tick ?? 0}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            FPS
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {fps}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            Partículas
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {metrics?.particleCount ?? 0}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            Chunks Activos
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {metrics?.activeChunks ?? 0}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          size="small"
          color={isPaused ? "success" : "warning"}
          startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
          onClick={() => {
            if (isPaused) client.resume();
            else client.pause();
            setIsPaused(!isPaused);
          }}
          fullWidth
        >
          {isPaused ? "Reanudar" : "Pausar"}
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<RefreshIcon />}
          onClick={() => client.reset()}
          fullWidth
        >
          Reset
        </Button>
      </Stack>

      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        onClick={() => client.spawnParticles(256, 256, 10)}
        fullWidth
        sx={{ mb: 2 }}
      >
        Spawn (Centro)
      </Button>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: "uppercase", fontSize: "0.75rem" }}
      >
        Capas Visuales
      </Typography>
      <Stack spacing={0.5}>
        <FieldToggle
          renderer={renderer}
          field="food"
          label="Comida"
          defaultChecked
        />
        <FieldToggle
          renderer={renderer}
          field="water"
          label="Agua"
          defaultChecked
        />
        <FieldToggle
          renderer={renderer}
          field="trail0"
          label="Trail 0"
          defaultChecked
        />
        <FieldToggle renderer={renderer} field="trail1" label="Trail 1" />
        <FieldToggle renderer={renderer} field="trail2" label="Trail 2" />
        <FieldToggle renderer={renderer} field="trail3" label="Trail 3" />
        <FieldToggle renderer={renderer} field="danger" label="Peligro" />
        <FieldToggle renderer={renderer} field="trees" label="Árboles" />
      </Stack>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, textTransform: "uppercase", fontSize: "0.75rem" }}
      >
        Métricas de Campo
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Comida Avg
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {metrics?.fieldAverages?.food?.toFixed(2) ?? "0.00"}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Agua Avg
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {metrics?.fieldAverages?.water?.toFixed(2) ?? "0.00"}
        </Typography>
      </Box>
    </Paper>
  );
};

// Helper component for toggles
const FieldToggle: React.FC<{
  renderer: Renderer;
  field: FieldType;
  label: string;
  defaultChecked?: boolean;
}> = ({ renderer, field, label, defaultChecked }) => {
  return (
    <FormControlLabel
      control={
        <Checkbox
          defaultChecked={defaultChecked}
          size="small"
          onChange={(e) => renderer.toggleFieldVisibility(field)}
          sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 18 } }}
        />
      }
      label={
        <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
          {label}
        </Typography>
      }
      sx={{ ml: 0, mr: 0 }}
    />
  );
};

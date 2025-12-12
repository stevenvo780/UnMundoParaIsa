import React, { useState, useEffect, useMemo } from "react";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Checkbox,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Toolbar,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "../theme";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import GroupsIcon from "@mui/icons-material/Groups";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import ForestIcon from "@mui/icons-material/Forest";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import TerrainIcon from "@mui/icons-material/Terrain";
import TuneIcon from "@mui/icons-material/Tune";
import type { SvgIconComponent } from "@mui/icons-material";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";
import {
  SimulationMetrics,
  ClientMessageType,
  FieldType,
  ServerMessage,
  ServerMessageType,
} from "@shared/types";
import { StatCard } from "./shared/StatCard";

interface ControlPanelProps {
  client: WebSocketClient;
  renderer: Renderer;
}

type PanelId =
  | "system"
  | "population"
  | "infrastructure"
  | "biodiversity"
  | "emergence"
  | "environment"
  | "controls";

interface PanelDefinition {
  id: PanelId;
  label: string;
  Icon: SvgIconComponent;
}

const PANEL_ORDER: PanelDefinition[] = [
  { id: "system", label: "Sistema", Icon: DashboardCustomizeIcon },
  { id: "population", label: "Población", Icon: GroupsIcon },
  { id: "infrastructure", label: "Infra", Icon: LocationCityIcon },
  { id: "biodiversity", label: "Biodiversidad", Icon: ForestIcon },
  { id: "emergence", label: "Emergencia", Icon: AutoGraphIcon },
  { id: "environment", label: "Entorno", Icon: TerrainIcon },
  { id: "controls", label: "Control", Icon: TuneIcon },
];

// SmallStat ha sido reemplazado por StatCard importado desde /shared/

const IndicatorBar: React.FC<{
  label: string;
  value?: number;
  format?: (value: number) => string;
}> = ({ label, value = 0, format }) => {
  const theme = useTheme();
  const normalized = Math.max(0, Math.min(1, value));
  const display = format
    ? format(value)
    : `${Math.round(normalized * 100)}%`;
  return (
    <Box>
      <Box display="flex" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption">{display}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={normalized * 100}
        sx={{
          height: 4,
          borderRadius: theme.tokens.borderRadius.pill,
          backgroundColor: alpha('#fff', theme.opacity.light),
          mt: 0.5,
        }}
      />
    </Box>
  );
};

export const ControlPanel: React.FC<ControlPanelProps> = ({ client, renderer }) => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [fps, setFps] = useState(0);
  const [_connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting" | "failed"
  >("disconnected");
  const [reconnectInfo, setReconnectInfo] = useState<{
    attempt: number;
    maxAttempts: number;
  } | null>(null);
  const [showMoisture, setShowMoisture] = useState(false);
  const [showNutrients, setShowNutrients] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  useEffect((): (() => void) => {
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
    client.send({ type: newState ? ClientMessageType.PAUSE : ClientMessageType.RESUME });
  };

  const handleReset = (): void => {
    client.send({ type: ClientMessageType.RESET });
  };

  const handleSpawn = (): void => {
    client.send({
      type: ClientMessageType.SPAWN_ENTITY,
      x: 0,
      y: 0,
    });
  };

  const toggleField = (type: FieldType, show: boolean): void => {
    if (type === FieldType.WATER) setShowMoisture(show);
    if (type === FieldType.FOOD) setShowNutrients(show);
    renderer.toggleFieldVisibility(type);
  };

  const connectionColor =
    connectionStatus === "connected"
      ? "success.main"
      : connectionStatus === "reconnecting"
        ? "warning.main"
        : "error.main";

  const structureEntries = metrics?.structureStats
    ? Object.entries(metrics.structureStats.byType)
    : [];

  const biodiversity = metrics?.biodiversity;
  const behaviorEntries = biodiversity
    ? Object.entries(biodiversity.behaviorCounts)
    : [];
  const behaviorTotal = behaviorEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );

  const shannonNormalized = useMemo(() => {
    if (!biodiversity || behaviorEntries.length === 0) return 0;
    const normalizer = Math.log(Math.max(behaviorEntries.length, 1)) || 1;
    return Math.min(1, biodiversity.shannonIndex / normalizer);
  }, [biodiversity, behaviorEntries.length]);

  const emergence = metrics?.emergence;
  const emergenceIndicators = emergence
    ? [
        { label: "Complejidad", value: emergence.complexity },
        { label: "Coherencia", value: emergence.coherence },
        { label: "Adaptabilidad", value: emergence.adaptability },
        { label: "Sostenibilidad", value: emergence.sustainability },
        { label: "Entropía", value: emergence.entropy },
        { label: "Autopoyesis", value: emergence.autopoiesis },
        { label: "Novedad", value: emergence.novelty },
        { label: "Estabilidad", value: emergence.stability },
      ]
    : [];

  const environmentIndicators = [
    {
      label: "Nutrientes",
      value: metrics?.fieldAverages?.[FieldType.FOOD] ?? 0,
    },
    {
      label: "Humedad",
      value: metrics?.fieldAverages?.[FieldType.WATER] ?? 0,
    },
    {
      label: "Peligro",
      value: metrics?.fieldAverages?.[FieldType.DANGER] ?? 0,
    },
    {
      label: "Labor",
      value: metrics?.fieldAverages?.[FieldType.LABOR] ?? 0,
    },
  ];

  const renderPanelContent = (panel: PanelId): React.ReactNode => {
    switch (panel) {
      case "system":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Salud del sistema</Typography>
            <Divider />
            <Typography variant="body2" color={connectionColor}>
              {connectionStatus === "connected" && "Conectado al servidor"}
              {connectionStatus === "disconnected" && "Desconectado"}
              {connectionStatus === "reconnecting" && "Reconectando..."}
              {connectionStatus === "failed" && "Error persistente"}
            </Typography>
            {connectionStatus === "reconnecting" && reconnectInfo && (
              <Typography variant="caption" color="text.secondary">
                Intento {reconnectInfo.attempt}/{reconnectInfo.maxAttempts}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <SmallStat label="FPS" value={fps} />
              <SmallStat label="Tick" value={metrics?.tick ?? 0} />
              <SmallStat label="Chunks" value={metrics?.activeChunks ?? 0} />
              <SmallStat
                label="Tiempo por tick"
                value={`${(metrics?.tickTimeMs ?? 0).toFixed(1)} ms`}
              />
            </Stack>
          </Stack>
        );

      case "population":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Dinámica de agentes</Typography>
            <Divider />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <SmallStat
                label="Agentes activos"
                value={metrics?.particleCount ?? 0}
              />
              <SmallStat label="Nacimientos" value={metrics?.births ?? 0} />
              <SmallStat label="Muertes" value={metrics?.deaths ?? 0} />
              <SmallStat
                label="Densidad"
                value={`${(metrics?.totalDensity ?? 0).toFixed(1)} u`}
              />
            </Stack>
          </Stack>
        );

      case "infrastructure":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Infraestructura emergente
            </Typography>
            <Divider />
            <Typography variant="h3">
              {metrics?.structureStats?.total ?? 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total estructuras observadas
            </Typography>
            {structureEntries.length > 0 ? (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {structureEntries.map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${type} (${count})`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.disabled">
                Sin construcciones reportadas
              </Typography>
            )}
          </Stack>
        );

      case "biodiversity":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Biodiversidad cultural</Typography>
            <Divider />
            {biodiversity ? (
              <>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {behaviorEntries.map(([type, count]) => {
                    const percentage =
                      behaviorTotal > 0
                        ? Math.round((count / behaviorTotal) * 100)
                        : 0;
                    const label =
                      type.charAt(0).toUpperCase() + type.slice(1);
                    return (
                      <Chip
                        key={type}
                        size="small"
                        label={`${label} · ${percentage}% (${count})`}
                        variant="outlined"
                        sx={{
                          borderColor: "rgba(255,255,255,0.2)",
                          color: "inherit",
                        }}
                      />
                    );
                  })}
                </Stack>
                <IndicatorBar
                  label="Entropía (Shannon)"
                  value={shannonNormalized}
                  format={() => biodiversity.shannonIndex.toFixed(2)}
                />
                <IndicatorBar
                  label={`Dominancia (${biodiversity.dominantType})`}
                  value={biodiversity.dominantRatio}
                />
                <Typography variant="caption" color="text.secondary">
                  Riqueza de especies: {biodiversity.speciesRichness}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.disabled">
                Sin datos recientes
              </Typography>
            )}
          </Stack>
        );

      case "emergence":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Indicadores de complejidad
            </Typography>
            <Divider />
            {emergence ? (
              <Stack spacing={1}>
                {emergenceIndicators.map((indicator) => (
                  <IndicatorBar
                    key={indicator.label}
                    label={indicator.label}
                    value={indicator.value}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.disabled">
                Sin datos recientes
              </Typography>
            )}
          </Stack>
        );

      case "environment":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Campos ambientales</Typography>
            <Divider />
            <Stack spacing={1}>
              {environmentIndicators.map((indicator) => (
                <IndicatorBar
                  key={indicator.label}
                  label={indicator.label}
                  value={indicator.value}
                />
              ))}
            </Stack>
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Capas interactivas
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
              label="Mostrar humedad"
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
              label="Mostrar nutrientes"
            />
          </Stack>
        );

      case "controls":
        return (
          <Stack spacing={2}>
            <Typography variant="subtitle1">Controles de simulación</Typography>
            <Divider />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant={isPaused ? "contained" : "outlined"}
                color={isPaused ? "warning" : "primary"}
                startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                onClick={togglePause}
              >
                {isPaused ? "Reanudar" : "Pausar"}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RefreshIcon />}
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                color="info"
                startIcon={<AddIcon />}
                onClick={handleSpawn}
              >
                Centro
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Usa estos comandos para estabilizar o reiniciar la historia emergente.
            </Typography>
          </Stack>
        );

      default:
        return null;
    }
  };

  const activePanelDefinition = PANEL_ORDER.find((panel) => panel.id === activePanel);

  return (
    <>
      {/* Top status bar */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          pointerEvents: "none",
          zIndex: 1200,
        }}
      >
        <AppBar
          position="static"
          color="default"
          sx={{ pointerEvents: "auto", backgroundColor: "rgba(18,18,26,0.95)" }}
        >
          <Toolbar sx={{ flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="h6" sx={{ lineHeight: 1 }}>
                Un Mundo Para Isa
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tablero de monitoreo en vivo
              </Typography>
            </Box>
            <Chip
              label={
                connectionStatus === "connected"
                  ? "Conectado"
                  : connectionStatus === "reconnecting"
                    ? "Reconectando"
                    : connectionStatus === "failed"
                      ? "Error"
                      : "Desconectado"
              }
              sx={{ backgroundColor: connectionColor, color: "white" }}
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ flexGrow: 1 }}>
              <Typography variant="body2">FPS {fps}</Typography>
              <Typography variant="body2">Tick {metrics?.tick ?? 0}</Typography>
              <Typography variant="body2">
                Chunks {metrics?.activeChunks ?? 0}
              </Typography>
              <Typography variant="body2">
                Agentes {metrics?.particleCount ?? 0}
              </Typography>
              <Typography variant="body2">
                Estructuras {metrics?.structureStats?.total ?? 0}
              </Typography>
              <Typography variant="body2">
                Nacimientos {metrics?.births ?? 0}
              </Typography>
              <Typography variant="body2">
                Muertes {metrics?.deaths ?? 0}
              </Typography>
              <Typography variant="body2">
                Tiempo {`${(metrics?.tickTimeMs ?? 0).toFixed(1)} ms`}
              </Typography>
            </Stack>
          </Toolbar>
        </AppBar>
      </Box>

      {/* Bottom navigation bar */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          pointerEvents: "none",
          zIndex: 1200,
        }}
      >
        <Paper
          elevation={10}
          sx={{ pointerEvents: "auto", borderRadius: 0 }}
        >
          <BottomNavigation
            showLabels
            value={activePanel ?? ""}
            onChange={(_event, newValue) => {
              if (!newValue) {
                setActivePanel(null);
                return;
              }
              setActivePanel((prev) => (prev === newValue ? null : (newValue as PanelId)));
            }}
            sx={{ backgroundColor: "rgba(18,18,26,0.98)", width: "100%" }}
          >
            {PANEL_ORDER.map((panel) => (
              <BottomNavigationAction
                key={panel.id}
                value={panel.id}
                label={panel.label}
                icon={<panel.Icon />}
                sx={{ color: "white" }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      </Box>

      <Dialog
        open={Boolean(activePanel)}
        onClose={() => setActivePanel(null)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            backgroundColor: "rgba(18,18,26,0.97)",
            color: "white",
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="h6">
            {activePanelDefinition?.label || "Panel"}
          </Typography>
          <IconButton onClick={() => setActivePanel(null)} sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>{activePanel ? renderPanelContent(activePanel) : null}</DialogContent>
      </Dialog>
    </>
  );
};

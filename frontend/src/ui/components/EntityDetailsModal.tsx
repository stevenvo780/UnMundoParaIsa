import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  IconButton,
  Box,
  Stack,
  Chip,
  LinearProgress,
  Divider,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Particle, AgentState } from "@shared/types";
import { alpha } from "../theme";
import { StatCard } from "./shared/StatCard";

interface EntityDetailsModalProps {
  open: boolean;
  onClose: () => void;
  entity: Particle | null;
}

const BEHAVIOR_ORDER = ["forager", "hunter", "nomad", "settler"] as const;
type BehaviorKey = (typeof BEHAVIOR_ORDER)[number];

const BEHAVIOR_PROFILES: Record<
  BehaviorKey,
  { label: string; description: string; accent: string }
> = {
  forager: {
    label: "Recolector",
    description:
      "Prefiere rutas cortas, recolecta comida y agua con poco riesgo.",
    accent: "#81c784",
  },
  hunter: {
    label: "Cazador",
    description: "Persigue objetivos distantes y explora zonas peligrosas.",
    accent: "#ff8a65",
  },
  nomad: {
    label: "Nómada",
    description: "Se desplaza constantemente y prioriza descubrir territorios.",
    accent: "#4fc3f7",
  },
  settler: {
    label: "Colonizador",
    description: "Tiende a estabilizarse y construir estructuras cercanas.",
    accent: "#ba68c8",
  },
};

const getBehaviorProfile = (seed: number): {
  type: BehaviorKey;
  label: string;
  description: string;
  accent: string;
} => {
  const index = (seed >> 4) & 0b11;
  const key = BEHAVIOR_ORDER[index] ?? "forager";
  return { type: key, ...BEHAVIOR_PROFILES[key] };
};

// StatBadge ha sido reemplazado por StatCard importado desde /shared/

export const EntityDetailsModal: React.FC<EntityDetailsModalProps> = ({
  open,
  onClose,
  entity,
}) => {
  const theme = useTheme();
  if (!entity) return null;

  const behaviorProfile = React.useMemo(
    () => getBehaviorProfile(entity.seed),
    [entity.seed],
  );

  const inventoryItems = entity.inventory
    ? Object.entries(entity.inventory)
    : [];

  const inventoryLoad = inventoryItems.reduce((sum, [, count]) => sum + count, 0);
  const speed = Math.hypot(entity.vx ?? 0, entity.vy ?? 0);
  const headingDeg = Math.atan2(entity.vy ?? 0, entity.vx ?? 0) * (180 / Math.PI);
  const normalizedHeading = Number.isFinite(headingDeg)
    ? (headingDeg + 360) % 360
    : null;
  const targetDistance =
    entity.targetX !== undefined && entity.targetY !== undefined
      ? Math.hypot(entity.targetX - entity.x, entity.targetY - entity.y)
      : null;

  const memoryPoints = [
    entity.memory?.homeLocation
      ? { label: "Hogar", value: entity.memory.homeLocation }
      : null,
    entity.memory?.lastFoodLocation
      ? { label: "Última comida", value: entity.memory.lastFoodLocation }
      : null,
    entity.memory?.lastWaterLocation
      ? { label: "Última agua", value: entity.memory.lastWaterLocation }
      : null,
  ].filter(
    (
      point,
    ): point is { label: string; value: { x: number; y: number } } =>
      Boolean(point),
  );

  const formatCoord = (coord: { x: number; y: number }): string =>
    `(${coord.x.toFixed(1)}, ${coord.y.toFixed(1)})`;
  const knownStructures = entity.memory?.knownStructures?.length ?? 0;

  const getStateColor = (
    state?: AgentState,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" => {
    switch (state) {
      case AgentState.IDLE:
        return "default";
      case AgentState.GATHERING:
        return "success";
      case AgentState.WORKING:
        return "warning";
      case AgentState.WANDERING:
        return "info";
      case AgentState.FLEEING:
        return "error";
      case AgentState.MOVING:
        return "primary";
      default:
        return "default";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      hideBackdrop
      PaperProps={{
        sx: {
          position: "absolute",
          top: 96,
          left: 24,
          m: 0,
          borderRadius: theme.tokens.borderRadius.xl,
          backgroundColor: alpha(theme.palette.background.default, theme.opacity.dialog),
          color: "white",
          border: `1px solid ${alpha('#fff', theme.opacity.light)}`,
          boxShadow: `0 25px 60px ${alpha('#000', theme.opacity.overlay)}`,
          backdropFilter: "blur(10px)",
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 2,
        }}
      >
        <Box>
              <Typography
                variant="overline"
                sx={{ color: behaviorProfile.accent, letterSpacing: 2 }}
              >
                Perfil animal
              </Typography>
              <Typography variant="h6">
                {entity.name ? entity.name : `Animal #${entity.id}`}
              </Typography>
            </Box>
            <IconButton
              aria-label="Cerrar"
              onClick={onClose}
          sx={{ color: "white", backgroundColor: alpha('#fff', theme.opacity.light) }}
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent dividers sx={{ borderColor: alpha('#fff', theme.opacity.light) }}>
        <Stack spacing={2}>
          {/* Status Section */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Estado
            </Typography>
            <Box display="flex" gap={1} alignItems="center" mb={1}>
              {entity.state && (
                <Chip
                  label={entity.state}
                  color={
                    getStateColor(entity.state as AgentState) as
                      | "default"
                      | "primary"
                      | "secondary"
                      | "error"
                      | "info"
                      | "success"
                      | "warning"
                  }
                  size="small"
                />
              )}
              <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                {entity.currentAction || "Thinking..."}
              </Typography>
            </Box>

            <Typography variant="caption" display="block" mb={0.5}>
              Energía {(entity.energy * 100).toFixed(0)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={entity.energy * 100}
              color={entity.energy < 0.3 ? "error" : "success"}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>

          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              gutterBottom
            >
              Indicadores vitales
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <StatCard label="Velocidad" value={`${speed.toFixed(2)} u/t`} variant="compact" />
              <StatCard
                label="Dirección"
                value={
                  normalizedHeading !== null
                    ? `${Math.round(normalizedHeading)}°`
                    : "—"
                }
                variant="compact"
              />
              <StatCard
                label="Carga"
                value={`${inventoryLoad.toFixed(1)} uds`}
                variant="compact"
              />
              <StatCard
                label="Reproducción"
                value={entity.wantsToReproduce ? "Activa" : "Latente"}
                variant="compact"
              />
            </Stack>
            {targetDistance !== null && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: "block" }}
              >
                Distancia al objetivo: {targetDistance.toFixed(1)}u
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Core Needs Section */}
          {entity.needs && (
            <>
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Necesidades
                </Typography>
                <Stack spacing={0.5}>
                  {Object.entries(entity.needs).map(([need, value]) => (
                    <Box key={need} display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="caption"
                        sx={{ width: 50, textTransform: "capitalize" }}
                      >
                        {need}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={value * 100}
                        sx={{
                          flexGrow: 1,
                          height: 4,
                          borderRadius: theme.tokens.borderRadius.sm,
                          backgroundColor: alpha('#fff', theme.opacity.light),
                          "& .MuiLinearProgress-bar": {
                            backgroundColor:
                              value < 0.3
                                ? theme.palette.error.main
                                : value < 0.6
                                  ? theme.palette.warning.main
                                  : theme.palette.success.main,
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Divider />
            </>
          )}

          {/* Goals Section */}
          {entity.currentGoal && (
            <>
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Objetivo Actual
                </Typography>
                <Chip
                  label={entity.currentGoal.type}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ width: "100%", justifyContent: "flex-start", pl: 1 }}
                />
                {entity.currentGoal.targetStructureId && (
                  <Typography variant="caption" display="block" mt={0.5}>
                    Structure ID: {entity.currentGoal.targetStructureId}
                  </Typography>
                )}
                {entity.currentGoal.targetX !== undefined &&
                  entity.currentGoal.targetY !== undefined && (
                    <Typography variant="caption" display="block">
                      Destino: ({entity.currentGoal.targetX.toFixed(1)},
                      {" "}
                      {entity.currentGoal.targetY.toFixed(1)})
                    </Typography>
                  )}
              </Box>
              <Divider />
            </>
          )}

          {memoryPoints.length > 0 && (
            <>
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Memoria sensorial
                </Typography>
                <Stack spacing={0.5}>
                  {memoryPoints.map((entry) => (
                    <Typography key={entry.label} variant="body2">
                      {entry.label}: {formatCoord(entry.value)}
                    </Typography>
                  ))}
                </Stack>
                {knownStructures > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    Conoce {knownStructures} estructura(s)
                  </Typography>
                )}
              </Box>
              <Divider />
            </>
          )}

          {/* Ownership Section */}
          {entity.ownedStructureIds && entity.ownedStructureIds.length > 0 && (
            <>
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Propiedades
                </Typography>
                <Typography variant="caption">
                  Dueño de {entity.ownedStructureIds.length} estructura(s)
                </Typography>
              </Box>
              <Divider />
            </>
          )}

          {/* Inventory Section */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Inventario
            </Typography>
            {inventoryItems.length > 0 ? (
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {inventoryItems.map(([item, count]) => (
                  <Chip
                    key={item}
                    label={`${item}: ${count.toFixed(1)}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: "white",
                      borderColor: alpha('#fff', theme.opacity.border),
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.disabled">
                Vacío
              </Typography>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              Carga total: {inventoryLoad.toFixed(1)} unidades
            </Typography>
          </Box>

          <Divider />

          {/* Info Section */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              gutterBottom
            >
              Perfil del animal
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" mb={0.5}>
              <Chip
                label={behaviorProfile.label}
                size="small"
                sx={{
                  borderColor: behaviorProfile.accent,
                  color: behaviorProfile.accent,
                }}
                variant="outlined"
              />
              <Chip
                label={`Firma ${behaviorProfile.type.toUpperCase()}`}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              {behaviorProfile.description}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Pos: ({entity.x.toFixed(1)}, {entity.y.toFixed(1)}) | Seed:{" "}
              {entity.seed}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Velocidad: {speed.toFixed(2)} u/t · Rumbo:{" "}
              {normalizedHeading !== null
                ? `${Math.round(normalizedHeading)}°`
                : "—"}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

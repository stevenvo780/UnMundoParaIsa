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
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Particle, AgentState } from "@shared/types";

interface EntityDetailsModalProps {
  open: boolean;
  onClose: () => void;
  entity: Particle | null;
}

const StatBadge: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <Box
    sx={{
      p: 1,
      borderRadius: 1,
      border: "1px solid rgba(255,255,255,0.12)",
      minWidth: 110,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

export const EntityDetailsModal: React.FC<EntityDetailsModalProps> = ({
  open,
  onClose,
  entity,
}) => {
  if (!entity) return null;

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
          borderRadius: 4,
          backgroundColor: "rgba(6, 8, 20, 0.96)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
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
            sx={{ color: "primary.light", letterSpacing: 2 }}
          >
            Agente activo
          </Typography>
          <Typography variant="h6">#{entity.id}</Typography>
        </Box>
        <IconButton
          aria-label="Cerrar"
          onClick={onClose}
          sx={{ color: "white", backgroundColor: "rgba(255,255,255,0.08)" }}
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent dividers sx={{ borderColor: "rgba(255,255,255,0.1)" }}>
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
              <StatBadge label="Velocidad" value={`${speed.toFixed(2)} u/t`} />
              <StatBadge
                label="Dirección"
                value={
                  normalizedHeading !== null
                    ? `${Math.round(normalizedHeading)}°`
                    : "—"
                }
              />
              <StatBadge
                label="Carga"
                value={`${inventoryLoad.toFixed(1)} uds`}
              />
              <StatBadge
                label="Reproducción"
                value={entity.wantsToReproduce ? "Activa" : "Latente"}
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
                          borderRadius: 1,
                          backgroundColor: "rgba(255,255,255,0.1)",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor:
                              value < 0.3
                                ? "#f44336"
                                : value < 0.6
                                  ? "#ff9800"
                                  : "#4caf50",
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
                      borderColor: "rgba(255,255,255,0.3)",
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

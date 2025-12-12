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
import CloseIcon from "@mui/icons-material/Close";
import { Particle, AgentState } from "@shared/types";

interface EntityDetailsModalProps {
  open: boolean;
  onClose: () => void;
  entity: Particle | null;
}

export const EntityDetailsModal: React.FC<EntityDetailsModalProps> = ({
  open,
  onClose,
  entity,
}) => {
  if (!entity) return null;

  const inventoryItems = entity.inventory
    ? Object.entries(entity.inventory)
    : [];

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
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          position: "absolute",
          top: 20,
          left: 20,
          m: 0,
          backgroundColor: "rgba(30, 30, 30, 0.95)",
          color: "white",
          backdropFilter: "blur(4px)",
        },
      }}
      hideBackdrop
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">Agente #{entity.id}</Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: "grey.500" }}
          size="small"
        >
          <CloseIcon />
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

          <Divider />

          {/* Core Needs Section */}
          {entity.needs && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
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
                              ? "#f44336" // Error/Desperate
                              : value < 0.6
                                ? "#ff9800" // Warning
                                : "#4caf50", // Good
                        },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Goals Section */}
          {entity.currentGoal && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
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
            </Box>
          )}

          {/* Ownership Section */}
          {entity.ownedStructureIds && entity.ownedStructureIds.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Propiedades
              </Typography>
              <Typography variant="caption">
                Dueño de {entity.ownedStructureIds.length} estructura(s)
              </Typography>
            </Box>
          )}

          <Divider />

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
          </Box>

          {/* Info Section */}
          <Box>
            <Typography variant="caption" color="text.secondary">
              Pos: ({entity.x.toFixed(1)}, {entity.y.toFixed(1)}) | Seed:{" "}
              {entity.seed}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

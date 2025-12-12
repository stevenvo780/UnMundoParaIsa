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
import { StructureData } from "@shared/types";

interface StructureDetailsModalProps {
  open: boolean;
  structure: StructureData | null;
  onClose: () => void;
}

const STRUCTURE_META: Record<
  string,
  { label: string; description: string; tags: string[]; accent: string }
> = {
  camp: {
    label: "Campamento",
    description: "Punto temporal para reagruparse y compartir recursos.",
    tags: ["Refugio", "Temporal"],
    accent: "#d4a574",
  },
  shelter: {
    label: "Refugio",
    description: "Reduce la exposición de los agentes y mejora su descanso.",
    tags: ["Protección", "Confort"],
    accent: "#8b4513",
  },
  settlement: {
    label: "Asentamiento",
    description: "Núcleo estable con influencia en el territorio cercano.",
    tags: ["Comunidad", "Estabilidad"],
    accent: "#cd853f",
  },
  storage: {
    label: "Almacén",
    description: "Centraliza recursos para optimizar la logística local.",
    tags: ["Inventario", "Logística"],
    accent: "#daa520",
  },
  watchtower: {
    label: "Atalaya",
    description: "Extiende el campo visual y anticipa riesgos.",
    tags: ["Vigilancia", "Defensa"],
    accent: "#708090",
  },
  farm: {
    label: "Granja",
    description: "Mejora la disponibilidad de comida en su perímetro.",
    tags: ["Producción", "Sustento"],
    accent: "#228b22",
  },
  mine: {
    label: "Mina",
    description: "Fuente estable de minerales y piedra.",
    tags: ["Minería", "Industria"],
    accent: "#696969",
  },
  workbench: {
    label: "Taller",
    description: "Permite crear herramientas y acelerar el progreso.",
    tags: ["Artesanía", "Progreso"],
    accent: "#a0522d",
  },
  default: {
    label: "Estructura",
    description: "Punto avanzado construido por los agentes.",
    tags: ["Infraestructura"],
    accent: "#888888",
  },
};

export const StructureDetailsModal: React.FC<StructureDetailsModalProps> = ({
  open,
  structure,
  onClose,
}) => {
  if (!structure) return null;

  const meta = STRUCTURE_META[structure.type] ?? STRUCTURE_META.default;
  const healthPercent = Math.round(structure.health * 100);
  const influenceIndex = Math.min(1, structure.level * structure.health * 0.5);

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
          right: 24,
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
          <Typography variant="overline" sx={{ color: meta.accent, letterSpacing: 2 }}>
            {meta.label}
          </Typography>
          <Typography variant="h6">Estructura #{structure.id}</Typography>
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
          <Typography variant="body2" color="text.secondary">
            {meta.description}
          </Typography>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Integridad ({healthPercent}%)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={healthPercent}
              sx={{ mt: 0.5, height: 6, borderRadius: 1 }}
              color={healthPercent < 40 ? "error" : healthPercent < 70 ? "warning" : "success"}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Nivel
              </Typography>
              <Typography variant="h6">{structure.level}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Influencia
              </Typography>
              <Typography variant="h6">{Math.round(influenceIndex * 100)}%</Typography>
            </Box>
          </Stack>

          <Divider flexItem />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Propiedad y Ubicación
            </Typography>
            <Typography variant="body2">
              Coordenadas ({structure.x.toFixed(1)}, {structure.y.toFixed(1)})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Propietario: {structure.ownerId !== undefined ? `Agente #${structure.ownerId}` : "Sin asignar"}
            </Typography>
          </Box>

          <Divider flexItem />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Funciones Clave
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {meta.tags.map((tag) => (
                <Chip
                  key={tag}
                  size="small"
                  label={tag}
                  sx={{ borderColor: meta.accent, color: meta.accent }}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

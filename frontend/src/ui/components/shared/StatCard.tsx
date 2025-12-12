import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "../../theme";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  minWidth?: number;
  variant?: "default" | "compact";
}

/**
 * StatCard - Componente unificado para mostrar estadísticas
 *
 * Reemplaza a SmallStat (ControlPanel) y StatBadge (EntityDetailsModal)
 * para mantener consistencia visual en toda la aplicación.
 *
 * @param label - Etiqueta de la estadística
 * @param value - Valor a mostrar (puede ser número, string o ReactNode)
 * @param minWidth - Ancho mínimo personalizado (default: theme.tokens.stat.minWidth)
 * @param variant - "default" para flex container, "compact" para tamaño fijo
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  minWidth,
  variant = "default",
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        flex: variant === "default" ? "1 1 45%" : undefined,
        minWidth: minWidth ?? theme.tokens.stat.minWidth,
        p: 1,
        borderRadius: theme.tokens.borderRadius.sm,
        border: `1px solid ${alpha('#fff', theme.opacity.medium)}`,
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
};

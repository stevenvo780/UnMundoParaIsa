/**
 * Sistema de Diseño - Un Mundo Para Isa
 *
 * Este archivo centraliza todos los tokens de diseño de la aplicación:
 * - Paleta de colores semánticos (MUI + custom)
 * - Colores de dominio específico (emociones, estructuras)
 * - Escala de opacidades estandarizada
 * - Tokens de spacing/sizing
 *
 * IMPORTANTE: No hardcodear colores en componentes. Siempre usar theme.palette.
 *
 * Uso:
 * ```tsx
 * import { useTheme, alpha } from '@mui/material';
 *
 * const theme = useTheme();
 * const color = theme.palette.emotions.joy;
 * const border = alpha('#fff', theme.opacity.medium);
 * ```
 */

import { createTheme, alpha } from "@mui/material/styles";
import { STRUCTURE_COLORS } from "@shared/types";

// ============================================
// Module Augmentation TypeScript
// ============================================
declare module '@mui/material/styles' {
  interface Palette {
    emotions: {
      joy: string;
      love: string;
      sadness: string;
      nostalgia: string;
      neutral: string;
    };
    structures: {
      camp: string;
      shelter: string;
      settlement: string;
      storage: string;
      watchtower: string;
      farm: string;
      mine: string;
      workbench: string;
      default: string;
    };
  }

  interface PaletteOptions {
    emotions?: Palette['emotions'];
    structures?: Palette['structures'];
  }

  interface Theme {
    opacity: {
      subtle: number;
      light: number;
      medium: number;
      strong: number;
      border: number;
      overlay: number;
      appBar: number;
      dialog: number;
      bottomNav: number;
    };
    tokens: {
      borderRadius: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
        pill: number;
      };
      stat: {
        minWidth: number;
      };
    };
  }

  interface ThemeOptions {
    opacity?: Theme['opacity'];
    tokens?: Theme['tokens'];
  }
}

// ============================================
// Colores de Emociones (Diálogos)
// ============================================
// Mapeados desde DialogEmotion enum (shared/types.ts)
// Usado en: DialogOverlay.tsx
const emotionColors = {
  joy: "#FDB813",       // Amarillo/dorado
  love: "#fb2b76",      // Rosa/magenta
  sadness: "#4a90e2",   // Azul
  nostalgia: "#909090", // Gris medio
  neutral: "#666666",   // Gris oscuro
};

// ============================================
// Colores de Estructuras
// ============================================
// Sincronizados con STRUCTURE_COLORS (shared/types.ts)
// Convertidos de formato numérico (0xRRGGBB) a hex string (#RRGGBB)
// Usado en: StructureDetailsModal.tsx
const structureColors = Object.entries(STRUCTURE_COLORS).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [key]: `#${value.toString(16).padStart(6, '0')}`,
  }),
  {} as Record<string, string>
);

// ============================================
// Escala de Opacidades
// ============================================
// Unificada desde 15+ valores rgba() inconsistentes
// Valores: 0.05, 0.08, 0.12, 0.2, 0.3, 0.55, 0.95, 0.96, 0.98
const opacities = {
  subtle: 0.05,      // Fondos muy sutiles
  light: 0.08,       // Bordes ligeros, fondos de botones (consolida 0.08 y 0.1)
  medium: 0.12,      // Bordes estándar
  strong: 0.2,       // Énfasis medio
  border: 0.3,       // Bordes visibles
  overlay: 0.55,     // Sombras oscuras
  appBar: 0.95,      // Barra superior
  dialog: 0.96,      // Fondos de modales (consolida 0.95, 0.96, 0.97)
  bottomNav: 0.98,   // Navegación inferior (más opaco)
};

// ============================================
// Tokens de Diseño
// ============================================
const tokens = {
  borderRadius: {
    sm: 1,   // 8px (MUI multiplica por theme.shape.borderRadius)
    md: 2,   // 16px
    lg: 3,   // 24px
    xl: 4,   // 32px
    pill: 999, // Píldora completa
  },
  stat: {
    minWidth: 120, // Tamaño estándar para StatCard
  },
};

// ============================================
// Tema Principal
// ============================================
export const theme = createTheme({
  palette: {
    mode: "dark",
    // Colores MUI nativos
    primary: {
      main: "#e94560",  // Rojo vibrante, color principal
    },
    secondary: {
      main: "#4a90e2",  // Azul para acciones secundarias
    },
    error: {
      main: "#f44336",  // Rojo, estados críticos (<30% salud)
    },
    warning: {
      main: "#ff9800",  // Naranja, advertencias (30-60% salud)
    },
    info: {
      main: "#4a90e2",  // Azul, información
    },
    success: {
      main: "#4caf50",  // Verde, estados positivos (>60% salud)
    },
    background: {
      default: "#0a0a0a",
      paper: "#16213e",
    },
    // Colores custom
    emotions: emotionColors,
    structures: structureColors,
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
  shape: {
    borderRadius: 8, // Base radius
  },
  // Tokens custom
  opacity: opacities,
  tokens: tokens,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});

// ============================================
// Helpers Exportados
// ============================================
export { alpha };

// Type helpers para evitar repetición
export type StructureType = keyof typeof structureColors;
export type EmotionType = keyof typeof emotionColors;

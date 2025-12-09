import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#e94560",
    },
    background: {
      default: "#0a0a0a",
      paper: "#16213e",
    },
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
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

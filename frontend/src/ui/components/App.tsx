import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "../theme";
import { ControlPanel } from "./ControlPanel";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";

interface AppProps {
  client: WebSocketClient;
  renderer: Renderer;
}

export const App: React.FC<AppProps> = ({ client, renderer }) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Pointer events none allows clicks to pass through to canvas, 
            but we need to re-enable them for the controls */}
        <Box sx={{ pointerEvents: "auto" }}>
          <ControlPanel client={client} renderer={renderer} />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

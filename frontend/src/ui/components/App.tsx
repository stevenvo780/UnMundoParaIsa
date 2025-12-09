import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "../theme";
import { ControlPanel } from "./ControlPanel";
import { DialogOverlay } from "./DialogOverlay";
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
        id="ui-root-container"
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <DialogOverlay client={client} renderer={renderer} />
        <ControlPanel client={client} renderer={renderer} />
      </Box>
    </ThemeProvider>
  );
};

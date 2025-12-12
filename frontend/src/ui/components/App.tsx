import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "../theme";
import { ControlPanel } from "./ControlPanel";
import { DialogOverlay } from "./DialogOverlay";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";
import { EntityDetailsModal } from "./EntityDetailsModal";
import { Particle, ServerMessageType } from "../../types";

interface AppProps {
  client: WebSocketClient;
  renderer: Renderer;
}

export const App: React.FC<AppProps> = ({ client, renderer }) => {
  const [selectedEntityId, setSelectedEntityId] = React.useState<number | null>(
    null,
  );
  const [particles, setParticles] = React.useState<Particle[]>([]);

  React.useEffect((): (() => void) => {
    renderer.onEntitySelected = (entity): void => {
      setSelectedEntityId(entity ? entity.id : null);
    };

    // Subscribe to tick updates to get fresh particle data
    const handleTick = (data: { particles?: Particle[] }): void => {
      if (data.particles) {
        setParticles(data.particles);
      }
    };

    client.on(ServerMessageType.TICK, handleTick);

    // Cleanup
    return (): void => {
      renderer.onEntitySelected = undefined;
      client.off(ServerMessageType.TICK, handleTick);
    };
  }, [renderer, client]);

  // Find the selected entity from current particles
  const selectedEntity =
    selectedEntityId !== null
      ? particles.find((p) => p.id === selectedEntityId && p.alive) || null
      : null;

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
        <EntityDetailsModal
          open={!!selectedEntity}
          entity={selectedEntity}
          onClose={() => setSelectedEntityId(null)}
        />
      </Box>
    </ThemeProvider>
  );
};

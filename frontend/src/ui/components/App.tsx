import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "../theme";
import { ControlPanel } from "./ControlPanel";
import { DialogOverlay } from "./DialogOverlay";
import { WebSocketClient } from "../../network/WebSocketClient";
import { Renderer } from "../../render/Renderer";
import { EntityDetailsModal } from "./EntityDetailsModal";
import { StructureDetailsModal } from "./StructureDetailsModal";
import { Particle, ServerMessageType, StructureData } from "../../types";

interface AppProps {
  client: WebSocketClient;
  renderer: Renderer;
}

type SelectionState =
  | { kind: "particle"; id: number }
  | { kind: "structure"; id: number }
  | null;

export const App: React.FC<AppProps> = ({ client, renderer }) => {
  const [selection, setSelection] = React.useState<SelectionState>(null);
  const [particles, setParticles] = React.useState<Particle[]>([]);
  const [structures, setStructures] = React.useState<StructureData[]>([]);

  React.useEffect((): (() => void) => {
    renderer.onEntitySelected = (entity): void => {
      if (!entity) {
        setSelection(null);
        return;
      }

      if (entity.kind === "particle") {
        setSelection({ kind: "particle", id: entity.particle.id });
      } else {
        setSelection({ kind: "structure", id: entity.structure.id });
      }
    };

    // Subscribe to tick updates to get fresh particle data
    const handleTick = (data: {
      particles?: Particle[];
      structures?: StructureData[];
    }): void => {
      if (data.particles) {
        setParticles(data.particles);
      }
      if (data.structures) {
        setStructures(data.structures);
      }
    };

    client.on(ServerMessageType.TICK, handleTick);

    // Cleanup
    return (): void => {
      renderer.onEntitySelected = undefined;
      client.off(ServerMessageType.TICK, handleTick);
    };
  }, [renderer, client]);

  const selectedParticle =
    selection?.kind === "particle"
      ? particles.find((p) => p.id === selection.id && p.alive) || null
      : null;

  const selectedStructure =
    selection?.kind === "structure"
      ? structures.find((s) => s.id === selection.id) || null
      : null;

  const clearSelection = (): void => setSelection(null);

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
          open={!!selectedParticle}
          entity={selectedParticle}
          onClose={clearSelection}
        />
        <StructureDetailsModal
          open={!!selectedStructure}
          structure={selectedStructure}
          onClose={clearSelection}
        />
      </Box>
    </ThemeProvider>
  );
};

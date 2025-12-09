/**
 * Scale Module - Sistemas de optimización y escala
 * Para mundos infinitos con rendimiento constante
 */

export {
  type FlowVector,
  type FlowTarget,
  type FlowFieldConfig,
  FlowField,
  FlowFieldManager,
} from "./FlowFields.js";

export {
  type LODLevel,
  type LODConfig,
  type FocusPoint,
  type LODRegion,
  LODManager,
} from "./LOD.js";

export {
  type ThermostatType,
  type ThermostatReading,
  type ThermostatConfig,
  Thermostat,
  ThermostatBank,
  type WorldParameters,
  WorldBalancer,
} from "./Thermostats.js";

export {
  type MetricSample,
  type MetricDefinition,
  type MetricSnapshot,
  type DashboardData,
  MetricsCollector,
  metrics,
} from "./Metrics.js";

/**
 * Scale Module - Sistemas de optimización y escala
 * Para mundos infinitos con rendimiento constante
 */

export {
  type FlowVector,
  type FlowTarget,
  FlowTargetType,
  type FlowFieldConfig,
  FlowField,
  FlowFieldManager,
} from "./FlowFields";

export {
  LODLevel,
  type LODConfig,
  type FocusPoint,
  type LODRegion,
  LODManager,
} from "./LOD";

export {
  ThermostatType,
  ThermostatTrend,
  type ThermostatReading,
  type ThermostatConfig,
  Thermostat,
  ThermostatBank,
  type WorldParameters,
  WorldBalancer,
} from "./Thermostats";

export {
  type MetricSample,
  type MetricDefinition,
  MetricType,
  type MetricSnapshot,
  type DashboardData,
  MetricsCollector,
  metrics,
} from "./Metrics";

/**
 * Scale Module - Sistemas de optimización y escala
 * Para mundos infinitos con rendimiento constante
 */

// Flow Fields - Navegación eficiente
export {
  type FlowVector,
  type FlowTarget,
  type FlowFieldConfig,
  FlowField,
  FlowFieldManager
} from './FlowFields.js';

// LOD (Level of Detail) - Detalle adaptativo
export {
  type LODLevel,
  type LODConfig,
  type FocusPoint,
  type LODRegion,
  LODManager
} from './LOD.js';

// Thermostats - Control homeostático
export {
  type ThermostatType,
  type ThermostatReading,
  type ThermostatConfig,
  Thermostat,
  ThermostatBank,
  type WorldParameters,
  WorldBalancer
} from './Thermostats.js';

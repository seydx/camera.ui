import { SensorType } from '@camera.ui/sdk';

export const DETECTION_INFO_TYPES: ReadonlySet<SensorType> = new Set([
  SensorType.Motion,
  SensorType.Object,
  SensorType.Audio,
  SensorType.Face,
  SensorType.LicensePlate,
  SensorType.Classifier,
]);

export const BINARY_SENSOR_TYPES: ReadonlySet<SensorType> = new Set([
  SensorType.Gas,
  SensorType.CarbonMonoxide,
  SensorType.Heat,
  SensorType.Cold,
  SensorType.Vibration,
  SensorType.Tamper,
  SensorType.Problem,
  SensorType.Power,
]);

export const MEASUREMENT_UNITS: ReadonlyMap<SensorType, string> = new Map([
  [SensorType.Illuminance, 'lx'],
  [SensorType.CarbonDioxide, 'ppm'],
]);

const WIDGET_TYPES: ReadonlySet<SensorType> = new Set([
  ...DETECTION_INFO_TYPES,
  ...BINARY_SENSOR_TYPES,
  ...MEASUREMENT_UNITS.keys(),
  SensorType.Light,
  SensorType.Switch,
  SensorType.Lock,
  SensorType.Siren,
  SensorType.SecuritySystem,
  SensorType.Garage,
  SensorType.Doorbell,
  SensorType.Contact,
  SensorType.Occupancy,
  SensorType.Smoke,
  SensorType.Leak,
  SensorType.Temperature,
  SensorType.Humidity,
  SensorType.Battery,
]);

export function hasSensorControlWidget(type: SensorType | string): boolean {
  return WIDGET_TYPES.has(type as SensorType);
}

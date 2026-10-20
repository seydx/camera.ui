import { isEqual } from '@camera.ui/sdk/internal';

import { inject } from '../../container.js';
import { parseValue } from '../parseValue.js';

import type { ActionContext } from '../actions/types.js';
import type { ConditionResult } from './types.js';

export async function conditionSensorState(ctx: ActionContext, data: Record<string, unknown>): Promise<ConditionResult> {
  const registry = inject('sensorRegistry');
  const sensor = registry.getSensor(data.sensorId as string, { connectedOnly: true });
  if (!sensor) return { handle: 'false' };

  const conditions = (data.conditions as { property: string; expectedValue: string }[]) ?? [];
  if (conditions.length === 0) return { handle: 'true' };

  const logic = (data.logic as string) ?? 'AND';

  const results = conditions.map((cond) => {
    const value = sensor.getValue(cond.property);
    const expected = parseValue(ctx.resolve(cond.expectedValue));
    if (Array.isArray(value) && !Array.isArray(expected)) {
      return value.some((entry) => matchesLoose(entry, expected));
    }
    return isEqual(value, expected);
  });

  const result = logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  return { handle: result ? 'true' : 'false' };
}

function matchesLoose(value: unknown, expected: unknown): boolean {
  if (typeof value === 'string' && typeof expected === 'string') {
    return value.toLowerCase() === expected.toLowerCase();
  }
  return isEqual(value, expected);
}

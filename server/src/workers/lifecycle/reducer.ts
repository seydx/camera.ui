export interface Step<S, F> {
  state: S;
  effects: F[];
}

export type Reducer<S, E, F> = (state: S, event: E) => Step<S, F>;

export function stay<S, F>(state: S): Step<S, F> {
  return { state, effects: [] };
}

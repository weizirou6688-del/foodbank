import { useSyncExternalStore } from "react";
type StoreListener = () => void;
type StoreGetter<T> = () => T;
type StoreSelector<T, S> = (state: T) => S;
type StoreUpdater<T> = Partial<T> | ((state: T) => Partial<T>);
type StoreSetter<T> = (updater: StoreUpdater<T>) => void;
type PersistedEnvelope<T> = { state?: Partial<T>; version?: number };
type PersistOptions<T> = {
  key: string;
  partialize: (state: T) => Partial<T>;
  version?: number;
};
type StoreHook<T> = {
  (): T;
  <S>(selector: StoreSelector<T, S>): S;
  getState: StoreGetter<T>;
  setState: StoreSetter<T>;
  subscribe: (listener: StoreListener) => () => void;
};
type StoreInitializer<T> = (set: StoreSetter<T>, get: StoreGetter<T>) => T;
const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const extractPersistedState = <T>(value: unknown): Partial<T> | null => {
  if (!isRecord(value)) {
    return null;
  }
  if ("state" in value && isRecord(value.state)) {
    return value.state as Partial<T>;
  }
  return value as Partial<T>;
};
const readPersistedState = <T>(key: string): Partial<T> | null => {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }
    return extractPersistedState<T>(JSON.parse(rawValue));
  } catch {
    return null;
  }
};
const writePersistedState = <T>(
  key: string,
  value: Partial<T>,
  version: number,
) => {
  if (!canUseStorage()) {
    return;
  }
  try {
    const envelope: PersistedEnvelope<T> = { state: value, version };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    void 0;
  }
};
export function createStore<T>(
  initializer: StoreInitializer<T>,
  persist?: PersistOptions<T>,
): StoreHook<T> {
  // 简易 Zustand 风格 store wrapper
  const listeners = new Set<StoreListener>();
  let state = {} as T;
  const getState: StoreGetter<T> = () => state;
  const persistState = () => {
    if (!persist) {
      return;
    }
    writePersistedState(
      persist.key,
      persist.partialize(state),
      persist.version ?? 0,
    );
  };
  const setState: StoreSetter<T> = (updater) => {
    const partialState =
      typeof updater === "function" ? updater(state) : updater;
    if (!partialState || Object.keys(partialState).length === 0) {
      return;
    }
    state = { ...state, ...partialState };
    persistState();
    listeners.forEach((listener) => listener());
  };
  const initialState = initializer(setState, getState);
  const persistedState = persist ? readPersistedState<T>(persist.key) : null;
  state = persistedState
    ? { ...initialState, ...persistedState }
    : initialState;
  const subscribe = (listener: StoreListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function useStore(): T;
  function useStore<S>(selector: StoreSelector<T, S>): S;
  function useStore<S>(selector?: StoreSelector<T, S>) {
    return useSyncExternalStore(
      subscribe,
      () => (selector ? selector(state) : (state as unknown as S)),
      () => (selector ? selector(state) : (state as unknown as S)),
    );
  }
  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  return useStore as StoreHook<T>;
}

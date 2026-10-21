/**
 * Local profile store for the public site and the studio.
 *
 * Clerk owns authentication. This module only keeps the small, displayable
 * slice of a signed-in user (name, avatar, email, timestamps) on this device,
 * keyed by Clerk user id. No session token, password or capture ever lands
 * here. Captures live in IndexedDB and are scoped by the same id.
 */

export type AuthProvider = 'clerk' | 'local';

export interface LocalProfile {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  imageUrl?: string;
  provider: AuthProvider;
  createdAt: number;
  savedAt: number;
  lastSeenAt: number;
}

export interface ProfileInput {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  imageUrl?: string;
  provider: AuthProvider;
  createdAt?: number;
}

interface AuthState {
  version: 1;
  activeUserId: string | null;
  users: Record<string, LocalProfile>;
}

export const AUTH_KEY = 'shotinclean.auth.v1';
const AUTH_EVENT = 'shotinclean:auth';

const emptyState = (): AuthState => ({ version: 1, activeUserId: null, users: {} });

function isProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<LocalProfile>;
  return typeof p.id === 'string' && typeof p.fullName === 'string' && (p.provider === 'clerk' || p.provider === 'local');
}

export function readAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    const users: Record<string, LocalProfile> = {};
    for (const [id, profile] of Object.entries(parsed.users ?? {})) {
      if (isProfile(profile) && profile.id === id) users[id] = profile;
    }
    const activeUserId = parsed.activeUserId && users[parsed.activeUserId] ? parsed.activeUserId : null;
    return { version: 1, activeUserId, users };
  } catch {
    return emptyState();
  }
}

function writeAuthState(state: AuthState): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode. The UI still works for this page view.
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const localAuth = {
  key: AUTH_KEY,

  state: readAuthState,

  active(): LocalProfile | null {
    const state = readAuthState();
    return state.activeUserId ? (state.users[state.activeUserId] ?? null) : null;
  },

  all(): LocalProfile[] {
    return Object.values(readAuthState().users).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  },

  save(input: ProfileInput): LocalProfile {
    const state = readAuthState();
    const previous = state.users[input.id];
    const now = Date.now();
    const fullName =
      clean(input.fullName) ||
      [clean(input.firstName), clean(input.lastName)].filter(Boolean).join(' ') ||
      clean(input.username) ||
      clean(input.email) ||
      'ShotInClean member';
    const profile: LocalProfile = {
      id: input.id,
      fullName,
      firstName: clean(input.firstName),
      lastName: clean(input.lastName),
      username: clean(input.username),
      email: clean(input.email),
      imageUrl: clean(input.imageUrl),
      provider: input.provider,
      createdAt: previous?.createdAt ?? input.createdAt ?? now,
      savedAt: now,
      lastSeenAt: now,
    };
    state.users[input.id] = profile;
    state.activeUserId = input.id;
    writeAuthState(state);
    return profile;
  },

  activate(id: string): LocalProfile | null {
    const state = readAuthState();
    const profile = state.users[id];
    if (!profile) return null;
    profile.lastSeenAt = Date.now();
    state.activeUserId = id;
    writeAuthState(state);
    return profile;
  },

  touch(): void {
    const state = readAuthState();
    if (!state.activeUserId || !state.users[state.activeUserId]) return;
    state.users[state.activeUserId].lastSeenAt = Date.now();
    writeAuthState(state);
  },

  signOut(): void {
    const state = readAuthState();
    state.activeUserId = null;
    writeAuthState(state);
  },

  remove(id: string): void {
    const state = readAuthState();
    delete state.users[id];
    if (state.activeUserId === id) state.activeUserId = null;
    writeAuthState(state);
  },

  clear(): void {
    writeAuthState(emptyState());
  },

  onChange(listener: () => void): () => void {
    const handler = () => listener();
    const storage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY) listener();
    };
    window.addEventListener(AUTH_EVENT, handler);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(AUTH_EVENT, handler);
      window.removeEventListener('storage', storage);
    };
  },
};

/** Stable, filesystem-safe suffix for IndexedDB / settings keys. */
export function profileScope(profile: LocalProfile | null): string | null {
  return profile ? profile.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) : null;
}

export function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return (parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S').slice(0, 2);
}

export function formatMemberDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

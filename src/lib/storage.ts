import { createStore, del, get, set, values } from "idb-keyval";
import { DEFAULT_SCORING } from "./scoring";
import type { ScoringSettings, Session } from "./types";

const sessionStore = createStore("habitwrite", "sessions");

export async function saveSession(s: Session): Promise<void> {
  s.updatedAt = Date.now();
  await set(s.id, s, sessionStore);
}

export async function loadSession(id: string): Promise<Session | undefined> {
  return get<Session>(id, sessionStore);
}

export async function listSessions(): Promise<Session[]> {
  const all = await values<Session>(sessionStore);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string): Promise<void> {
  await del(id, sessionStore);
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AppSettings {
  apiKey: string;
  baseUrl: string; // optional proxy; empty = api.anthropic.com
  model: string;
  effort: Effort;
  scoring: ScoringSettings;
  examModeDefault: boolean;
}

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (paling akurat)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (lebih hemat)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (paling hemat)" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  baseUrl: "",
  model: "claude-opus-5-5",
  effort: "medium",
  scoring: DEFAULT_SCORING,
  examModeDefault: false,
};

const SETTINGS_KEY = "habitwrite.settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, scoring: { ...DEFAULT_SCORING, ...parsed.scoring } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function uid(): string {
  return crypto.randomUUID();
}

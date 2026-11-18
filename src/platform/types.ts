import type { SnapshotStore } from "@/lib/state";

/** Environment the application needs. Adapters read it from their platform. */
export interface Env {
  siteUrl: string;
  /** Overrides the default state document. */
  stateUrl?: string;
}

/**
 * The port. Application code imports this and nothing provider-specific.
 * Deploy is an adapter concern, because it is not something the running app does.
 */
export interface Platform {
  readonly name: string;
  env(): Env;
  /** Best-effort memory of the last good document. Never the store of record. */
  readonly snapshot: SnapshotStore;
}

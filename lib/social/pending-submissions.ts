type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export type Submission = { key: string; id: string };

// Keep unresolved requests alongside tab-scoped drafts. Only a digest and UUID
// are stored, never another copy of the post, political position, or reply.
export class PendingSubmissions {
  private memory = new Map<string, string>();
  private storage: () => Storage | null;
  constructor(storage: () => Storage | null) { this.storage = storage; }

  async start(userId: string, values: unknown, explicitId?: string): Promise<Submission> {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(values)));
    const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
    const key = "polis-pending:" + userId + ":" + digest;
    let stored: string | null = null;
    try { stored = this.storage()?.getItem(key) ?? null; } catch { /* Storage can be unavailable. */ }
    const valid = stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored);
    const id = explicitId ?? this.memory.get(key) ?? (valid ? stored! : crypto.randomUUID());
    this.memory.set(key, id);
    try { this.storage()?.setItem(key, id); } catch { /* Same-page retries still work. */ }
    return { key, id };
  }

  acknowledge({ key, id }: Submission) {
    if (this.memory.get(key) === id) this.memory.delete(key);
    try {
      const storage = this.storage();
      if (storage?.getItem(key) === id) storage.removeItem(key);
    } catch { /* No durable journal was available. */ }
  }
}

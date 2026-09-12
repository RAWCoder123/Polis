declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    POLIS_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}

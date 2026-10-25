/** Every error thrown on purpose by zk-core. `code` is stable; callers map it to user-facing text. */
export class ZkCoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ZkCoreError";
    this.code = code;
  }
}

/** Placeholder for public API members whose implementation belongs to a later task. Never silently succeeds. */
export function notImplemented(member: string, task: string): never {
  throw new ZkCoreError("NOT_IMPLEMENTED", `zk-core.${member} is not implemented yet (${task})`);
}

/** Every error thrown on purpose by zk-core. `code` is stable; callers map it to user-facing text. */
export class ZkCoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ZkCoreError";
    this.code = code;
  }
}

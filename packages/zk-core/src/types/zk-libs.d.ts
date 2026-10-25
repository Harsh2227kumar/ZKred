// Minimal typings for snarkjs and circomlibjs (neither ships a .d.ts). Only src/age.ts imports snarkjs;
// circomlibjs is a devDependency used by test/age.test.ts to cross-check Poseidon.
declare module "snarkjs" {
  /** A file argument: a path/URL string, or bytes wrapped as an in-memory fastfile. */
  type SnarkFile = string | Uint8Array | { type: "mem"; data: Uint8Array };

  export const groth16: {
    fullProve(
      input: Record<string, string | bigint>,
      wasmFile: SnarkFile,
      zkeyFile: SnarkFile,
    ): Promise<{ proof: object; publicSignals: string[] }>;
    verify(vkey: object, publicSignals: string[], proof: object): Promise<boolean>;
  };
}

declare module "circomlibjs" {
  interface PoseidonField {
    toString(x: unknown, radix?: number): string;
  }
  interface Poseidon {
    (inputs: bigint[]): unknown;
    F: PoseidonField;
  }
  export function buildPoseidon(): Promise<Poseidon>;
}

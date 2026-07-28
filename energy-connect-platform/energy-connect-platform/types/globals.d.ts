declare function require(name: string): any;
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
  on(event: string, listener: (...args: any[]) => void): void;
};
declare const Buffer: any;

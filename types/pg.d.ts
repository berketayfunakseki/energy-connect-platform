declare module "pg" {
  export class Pool {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }>;
    connect(): Promise<{ query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }>; release(): void }>;
    end(): Promise<void>;
  }
}

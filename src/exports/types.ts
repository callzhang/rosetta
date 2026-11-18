export type ExportMethod = 'download' | 'api' | 'storage';
export interface ExportHeader {
  name: string;
  value: string;
}
export interface ApiExportTarget {
  url: string;
  method: 'POST' | 'PUT';
  headers: ExportHeader[];
}
export interface StorageExportTarget {
  sourceId: string;
  prefix: string;
}
export interface ExportSettings {
  id: 'default';
  defaultMethod: ExportMethod;
  api?: ApiExportTarget;
  storage?: StorageExportTarget;
  updatedAt: number;
}

export const exportMethodLabels: Record<ExportMethod, string> = {
  download: '本地下载',
  api: 'API',
  storage: '对象存储',
};

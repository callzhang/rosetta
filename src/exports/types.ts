import { t } from '../i18n';
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
  get download() {
    return t('Local download');
  },
  api: 'API',
  get storage() {
    return t('Object storage');
  },
};

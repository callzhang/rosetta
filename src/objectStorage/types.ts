import { t } from '../i18n';
export type StorageProvider = 'oss' | 'obs' | 'tos';

export interface StorageSource {
  provider: StorageProvider;
  bucket: string;
  region: string;
  endpoint: string;
  prefix: string;
}

export interface StorageCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
}

export type StorageConnection = StorageSource & StorageCredentials;
export interface SavedStorageConnection {
  id: string;
  name: string;
  connection: StorageConnection;
  createdAt: number;
  updatedAt: number;
}
export interface StorageObject {
  key: string;
  size: number;
  lastModified?: string;
}
export interface StoragePage {
  objects: StorageObject[];
  directories: string[];
  nextCursor?: string;
}
export interface StorageListOptions {
  prefix: string;
  delimiter?: string;
  cursor?: string;
}
export interface StorageClient {
  list(options: StorageListOptions): Promise<StoragePage>;
  signedURL(key: string): Promise<string>;
  put?(key: string, body: Blob): Promise<void>;
}

export const providerLabels: Record<StorageProvider, string> = {
  get oss() {
    return t('Alibaba Cloud OSS');
  },
  get obs() {
    return t('Huawei Cloud OBS');
  },
  get tos() {
    return t('Volcengine TOS');
  },
};
export const defaultRegions: Record<StorageProvider, string> = {
  oss: 'cn-hangzhou',
  obs: 'cn-north-4',
  tos: 'cn-beijing',
};

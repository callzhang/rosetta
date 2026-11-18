import type { DataRecord } from '@stardustai/annotation-client';
import type { DataKind } from './files';

export const dataKindLabels: Record<DataKind, string> = {
  pointcloud: '点云',
  image: '图片',
  audio: '音频',
  video: '视频',
  text: '文本/文档',
};

export function kindFromRecord(record?: DataRecord): DataKind | undefined {
  const type = record?.attachmentType?.toUpperCase() || '';
  if (type.includes('POINTCLOUD')) return 'pointcloud';
  if (type.startsWith('IMAGE')) return 'image';
  if (type.startsWith('VIDEO')) return 'video';
  if (type.startsWith('AUDIO')) return 'audio';
  if (type === 'TEXT') return 'text';
}

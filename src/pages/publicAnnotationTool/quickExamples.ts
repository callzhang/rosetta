import type {
  DataRecord,
  DataRecordType,
  PublicAnnotationInput,
} from '@stardustai/annotation-client';
import type { DataKind } from '../../localData/files';
import { createDefaultOperators } from '../../localData/presets';

export interface QuickExample {
  id: string;
  name: string;
  kind: DataKind;
  description: string;
  tools: string;
  record: () => DataRecord;
}
const asset = (name: string) => `${import.meta.env.BASE_URL}examples/${name}`;
export const quickExamples: QuickExample[] = [
  {
    id: 'image',
    name: '图片目标标注',
    kind: 'image',
    description: '在路口场景中标记车辆与行人',
    tools: '矩形框 / 多边形 / 关键点',
    record: () => ({
      attachmentType: 'IMAGE' as DataRecordType.Image,
      attachment: asset('street.svg'),
      metadata: { title: '路口场景.svg' },
    }),
  },
  {
    id: 'pointcloud',
    name: '3D 点云标注',
    kind: 'pointcloud',
    description: '旋转点云，为车辆添加 3D 标注',
    tools: '3D 框 / 折线 / 3D 点',
    record: () =>
      ({
        attachmentType: 'POINTCLOUD' as DataRecordType.PointCloud,
        attachment: { url: asset('street.pcd'), name: 'street.pcd' },
        metadata: { title: '道路点云.pcd' },
      } as DataRecord),
  },
  {
    id: 'text',
    name: '文本实体标注',
    kind: 'text',
    description: '选择文本，为人物、地点等实体添加标记',
    tools: '文本选择 / 实体标注',
    record: () => ({
      attachmentType: 'TEXT' as DataRecordType.Text,
      attachment: asset('entities.txt'),
      metadata: { title: '出行记录.txt' },
    }),
  },
];

export function exampleInput(example: QuickExample): PublicAnnotationInput {
  return {
    taskParams: {
      type: 'multiple',
      operators: createDefaultOperators(example.kind),
      records: [example.record()],
    },
  };
}

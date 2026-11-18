import type {
  Operator,
  SlotSpecification,
} from '@stardustai/annotation-client';
import {
  DEFAULT_LINE_STYLE,
  OperatorType,
  ProjectTypeEnum,
  SlotType,
} from '@stardustai/annotation-client';
import i18next from 'i18next';
import type { DataKind } from './files';

export { dataKindLabels, kindFromRecord } from './recordKind';
export const projectTypeForKind: Record<DataKind, ProjectTypeEnum> = {
  pointcloud: ProjectTypeEnum.ThreeDAnnotation,
  image: ProjectTypeEnum.ImageAnnotation,
  audio: ProjectTypeEnum.AudioAnnotation,
  video: ProjectTypeEnum.VideoAnnotation,
  text: ProjectTypeEnum.TextAnnotation,
};

export function createDefaultOperators(kind: DataKind): Operator[] {
  const definitions: Record<DataKind, [SlotType, string][]> = {
    pointcloud: [
      [SlotType.Box3D, '3D框'],
      [SlotType.Line3D, '3D折线'],
      [SlotType.Point3D, '3D点'],
    ],
    image: [
      [SlotType.Box2D, '矩形框'],
      [SlotType.Polygon, '多边形'],
      [SlotType.Point, '关键点'],
    ],
    video: [
      [SlotType.Box2D, '矩形框'],
      [SlotType.Polygon, '多边形'],
      [SlotType.Point, '关键点'],
    ],
    audio: [[SlotType.TimeSlice, '音频片段']],
    text: [[SlotType.Text, '文本选择']],
  };
  return definitions[kind].map(([type, label]) => ({
    key: `default-${type}`,
    type: OperatorType.Slot,
    label: i18next.t(label) || label,
    slotSpecification: {
      type,
      ...(type === SlotType.Line3D ? { lineStyle: DEFAULT_LINE_STYLE } : {}),
      ...([SlotType.Box2D, SlotType.Polygon, SlotType.Point].includes(type)
        ? { restrictInsideCanvasBoundary: true }
        : {}),
      ...(type === SlotType.Box2D
        ? {
            topLeftMark: '1',
            topRightMark: '2',
            bottomRightMark: '3',
            bottomLeftMark: '4',
            sizeCheckSwitch: true,
          }
        : {}),
    } as SlotSpecification,
  }));
}

// Reimporting the same modality preserves the user's edited labels and tools.
export function operatorsForImport(
  kind: DataKind,
  previousKind: DataKind | undefined,
  operators?: Operator[] | null,
) {
  return kind === previousKind && operators?.length
    ? operators
    : createDefaultOperators(kind);
}

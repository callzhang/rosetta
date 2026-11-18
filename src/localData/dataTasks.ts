import type {
  DataRecord,
  PublicAnnotationInput,
} from '@stardustai/annotation-client';
import { kindFromRecord } from './recordKind';
import type { Operator } from '@stardustai/annotation-client';
import { recordName, sessionRecords } from './sessionInfo';
import type { NewTask } from './storage';
import { filterTaskInput, inputResults } from './taskInput';
import { getRecordOperators } from './recordPreprocessing';

export function tasksFromInput(
  input: PublicAnnotationInput,
  fallback = '导入数据',
  description = '',
): NewTask[] {
  const records = sessionRecords(input);
  if (!records.length) throw new Error('文件中没有可创建的数据');
  return records.map((record, index) => ({
    name: recordName(
      record,
      records.length === 1 ? fallback : `${fallback} · ${index + 1}`,
    ),
    description,
    submitted: inputResults(input)[index] != null,
    input: filterTaskInput(input, [index]),
  }));
}

export function inputsFromJSON(
  text: string,
  name: string,
  operatorsForRecord: (record: DataRecord) => Operator[] = () => [],
) {
  if (/\.jsonl$/i.test(name)) {
    return recordsFromJSONLines(text).map((record, index) => {
      if (!kindFromRecord(record))
        throw new Error(`JSONL 第 ${index + 1} 条缺少有效的数据类型`);
      return {
        taskParams: {
          type: 'multiple',
          records: [record],
          operators: getRecordOperators(record, operatorsForRecord(record)),
        },
      } as PublicAnnotationInput;
    });
  }
  let input: PublicAnnotationInput;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('请输入有效的 PublicAnnotationInput JSON');
  }
  if (
    !input?.taskParams ||
    !['include', 'multiple'].includes(input.taskParams.type)
  )
    throw new Error('JSON 需要包含有效的 PublicAnnotationInput.taskParams');
  return [input];
}

export function recordsFromJSONLines(text: string): DataRecord[] {
  return text.split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`JSONL 第 ${index + 1} 行不是有效 JSON`);
    }
    if (
      !value ||
      typeof value !== 'object' ||
      !('attachmentType' in value) ||
      typeof value.attachmentType !== 'string'
    )
      throw new Error(`JSONL 第 ${index + 1} 行缺少有效的数据类型`);
    return [value as DataRecord];
  });
}

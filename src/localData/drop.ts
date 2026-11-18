import { fromEvent } from 'file-selector';
import type { FileWithPath } from 'file-selector';
import type { DropEvent } from 'react-dropzone';
import type { LocalFile } from './files';
import { normalizePath } from './files';

export function droppedFiles(files: readonly File[]): LocalFile[] {
  return files.map((file) => ({
    file,
    path: normalizePath(
      (
        file.webkitRelativePath ||
        (file as FileWithPath).path ||
        file.name
      ).replace(/^\.\//, ''),
    ),
  }));
}

export async function filesFromDrop(
  transfer: DataTransfer,
): Promise<LocalFile[]> {
  const items = await selectFiles({ dataTransfer: transfer, type: 'drop' });
  const files = items.filter((item): item is FileWithPath => 'name' in item);
  return droppedFiles(files);
}

export function selectFiles(
  event: DropEvent | { dataTransfer: DataTransfer; type: 'drop' },
) {
  if (
    'dataTransfer' in event &&
    event.dataTransfer &&
    !event.dataTransfer.items?.length &&
    event.dataTransfer.files?.length
  )
    return Promise.resolve(Array.from(event.dataTransfer.files));
  return fromEvent(event);
}

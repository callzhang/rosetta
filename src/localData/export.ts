import { sessionRecords } from './sessionInfo';
import { loadSession } from './storage';

export async function prepareSessionExport(id: string) {
  const session = await loadSession(id);
  // Export the annotation protocol only. Saved AK/SK never belong in task JSON.
  const blob = new Blob([JSON.stringify(session.input, null, 2)], {
    type: 'application/json',
  });
  const stem =
    Array.from(session.name.replace(/[\\/:*?"<>|\0-\x1f]/g, '_'))
      .slice(0, 100)
      .join('') || 'annotation-task';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    taskId: session.id,
    taskName: session.name,
    filename: `${stem}.json`,
    objectFilename: `${stem}-${timestamp}-${crypto.randomUUID()}.json`,
    recordCount: sessionRecords(session.input).length,
    submittedCount: session.submittedIndices.length,
    legacyProgress: session.legacyProgress,
    lastSavedAt: session.lastSavedAt,
    blob,
  };
}

export type SessionExport = Awaited<ReturnType<typeof prepareSessionExport>>;

export async function downloadSessionExport(payload: SessionExport) {
  const url = URL.createObjectURL(payload.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = payload.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportSession(id: string) {
  await downloadSessionExport(await prepareSessionExport(id));
}

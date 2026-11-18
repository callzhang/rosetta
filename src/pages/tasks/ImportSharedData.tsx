import type { PublicAnnotationInput } from '@stardustai/annotation-client';
import { Button, message, validateSchema } from '@stardustai/annotation-client';
import { Alert } from 'antd';
import { useState } from 'react';
import { tasksFromInput } from '../../localData/dataTasks';
import { openSavedAnnotation } from '../../localData/openAnnotation';
import { sessionRecords } from '../../localData/sessionInfo';
import { createTasks } from '../../localData/storage';

export default function ImportSharedData({
  input,
}: {
  input: PublicAnnotationInput;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const count = sessionRecords(input).length;
  return (
    <div className="cloud-access-page">
      <div className="cloud-access-form">
        <h2>导入共享数据</h2>
        <p>
          这份标注数据包含 {count} 条数据，将分别创建 {count} 个任务。
          一同导入工具配置和标注结果。
        </p>
        <Button
          type="primary"
          disabled={!count}
          loading={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setFailure('');
            try {
              const check = validateSchema('PublicAnnotationInput', input);
              if (!check.valid) throw new Error(check.errorMessage);
              const tasks = await createTasks(
                tasksFromInput(input, '共享数据'),
              );
              await openSavedAnnotation(tasks[0].id, null);
              message.success(`已创建 ${tasks.length} 个任务`);
            } catch (error) {
              setFailure((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          导入为任务并标注
        </Button>
        {failure && (
          <Alert className="mt-3" type="error" showIcon message={failure} />
        )}
      </div>
    </div>
  );
}

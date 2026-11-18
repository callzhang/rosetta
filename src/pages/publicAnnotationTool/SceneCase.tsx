import { UploadOutlined } from '@ant-design/icons';
import {
  Button,
  message,
  validateSchema,
} from '@stardustai/annotation-client';
import { Upload } from 'antd';
import i18next from 'i18next';
import { observer } from 'mobx-react';
import {
  inputsFromJSON,
  recordsFromJSONLines,
} from '../../localData/dataTasks';
import CloudDataImport from '../../objectStorage/CloudDataImport';
import LocalDataUpload from './components/LocalDataUpload';
import type { PublicAnnotationToolStore } from './PublicAnnotationToolStore';

export const SceneCase = observer(
  ({ store }: { store: PublicAnnotationToolStore }) => {
    if (store.managedTask)
      return (
        <p className="task-editor-note">
          当前任务包含一条数据。在此配置标注工具；添加或批量导入数据请返回任务列表。
        </p>
      );
    async function importFile(file: File) {
      try {
        const text = await file.text();
        if (/\.jsonl$/i.test(file.name)) {
          const records = recordsFromJSONLines(text);
          for (const record of records) {
            const check = validateSchema('DataRecord', record);
            if (!check.valid) throw new Error(check.errorMessage);
          }
          store.setRecords(records);
        } else {
          const input = inputsFromJSON(text, file.name)[0];
          const check = validateSchema('PublicAnnotationInput', input);
          if (!check.valid) throw new Error(check.errorMessage);
          store.setData(input);
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : '读取数据失败');
      }
      return false as const;
    }
    function clear() {
      store.resetCustom();
      message.info(i18next.t('已清空数据, 请重新上传。'));
    }
    return (
      <>
        <LocalDataUpload store={store} />
        <CloudDataImport store={store} />
        <div className="flex items-center py-2 font-bold">
          <span className="mr-4 min-w-16">{i18next.t('上传数据:')}</span>
          <div className="flex flex-1">
            <Upload
              showUploadList
              accept=".json,application/json"
              beforeUpload={importFile}
              onRemove={clear}
            >
              <Button icon={<UploadOutlined />}>
                {i18next.t('上传 PublicAnnotationInput')}
              </Button>
            </Upload>
            <Upload
              showUploadList
              className={`ml-3${store.input == null ? ' opacity-50' : ''}`}
              disabled={store.input == null}
              accept=".jsonl"
              beforeUpload={importFile}
              onRemove={clear}
            >
              <Button icon={<UploadOutlined />}>
                {i18next.t('上传 JSONL')}
              </Button>
            </Upload>
          </div>
        </div>
      </>
    );
  },
);

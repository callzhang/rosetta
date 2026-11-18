import { useLanguage, t } from '../../i18n';
import { Alert, Form, Input, Modal } from 'antd';
import { useEffect, useState } from 'react';

export interface TaskDetails {
  name: string;
  description: string;
}

export default function TaskFormModal({
  open,
  initial,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initial?: TaskDetails & { id: string };
  onCancel: () => void;
  onSubmit: (details: TaskDetails) => Promise<void>;
}) {
  useLanguage();
  const [form] = Form.useForm<TaskDetails>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: initial?.name || '',
      description: initial?.description || '',
    });
    setError('');
  }, [open, initial?.id, form]);
  return (
    <Modal
      title={t('Edit task')}
      open={open}
      onCancel={onCancel}
      confirmLoading={busy}
      maskClosable={!busy}
      closable={!busy}
      cancelButtonProps={{ disabled: busy }}
      okText={t('Save changes')}
      onOk={() => form.submit()}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={async (details) => {
          setBusy(true);
          setError('');
          try {
            await onSubmit(details);
          } catch (error) {
            setError((error as Error).message || t('Save failed. Try again'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Form.Item
          name="name"
          label={t('Task name')}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('Enter a task name'),
            },
            { max: 100 },
          ]}
        >
          <Input
            autoFocus
            disabled={busy}
            maxLength={100}
            placeholder={t('For example, intersection point cloud annotation')}
          />
        </Form.Item>
        <Form.Item
          name="description"
          label={t('Annotation instructions')}
          rules={[{ max: 2000 }]}
        >
          <Input.TextArea
            disabled={busy}
            rows={4}
            maxLength={2000}
            showCount
            placeholder={t(
              'Record annotation requirements, data batches, or notes',
            )}
          />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </Modal>
  );
}

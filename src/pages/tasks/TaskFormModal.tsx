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
      title="编辑任务"
      open={open}
      onCancel={onCancel}
      confirmLoading={busy}
      maskClosable={!busy}
      closable={!busy}
      cancelButtonProps={{ disabled: busy }}
      okText="保存修改"
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
            setError((error as Error).message || '保存失败，请重试');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Form.Item
          name="name"
          label="任务名称"
          rules={[
            { required: true, whitespace: true, message: '请输入任务名称' },
            { max: 100 },
          ]}
        >
          <Input
            autoFocus
            disabled={busy}
            maxLength={100}
            placeholder="例如 路口点云目标标注"
          />
        </Form.Item>
        <Form.Item name="description" label="标注说明" rules={[{ max: 2000 }]}>
          <Input.TextArea
            disabled={busy}
            rows={4}
            maxLength={2000}
            showCount
            placeholder="记录标注要求、数据批次或注意事项"
          />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </Modal>
  );
}

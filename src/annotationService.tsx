import * as client from '@stardustai/annotation-client';
import { Alert } from 'antd';
import { forwardRef, type ComponentProps } from 'react';
import { t, useLanguage } from './i18n';

const configured =
  !import.meta.env.PROD || !!import.meta.env.VITE_ANNOTATION_URL;
function ServiceNotice() {
  useLanguage();
  return (
    <Alert
      showIcon
      type="info"
      message={t('Annotation service is not connected')}
      description={t(
        'You can import and manage tasks here. Ask the site administrator to connect the annotation service before editing annotations.',
      )}
    />
  );
}
export const RosettaAnnotation = forwardRef<
  client.RosettaAnnotationHandle,
  client.RosettaAnnotationProps
>((props, ref) =>
  configured ? (
    <client.RosettaAnnotation {...props} ref={ref} />
  ) : (
    <ServiceNotice />
  ),
);
export function OperatorsEditor(
  props: ComponentProps<typeof client.OperatorsEditor>,
) {
  return configured ? <client.OperatorsEditor {...props} /> : <ServiceNotice />;
}
export function AlgorithmEditor(
  props: ComponentProps<typeof client.AlgorithmEditor>,
) {
  return configured ? <client.AlgorithmEditor {...props} /> : <ServiceNotice />;
}

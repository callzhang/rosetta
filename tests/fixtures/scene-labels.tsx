import i18next from 'i18next';
import { createRoot } from 'react-dom/client';
import { useDemoData } from '../../src/pages/publicAnnotationTool/hooks/useDemoData';

export interface SceneLabelsHarness {
  initialize: () => Promise<unknown>;
  changeLanguage: (language: string) => Promise<unknown>;
  renderCount: () => number;
  unmount: () => void;
}

let renders = 0;
function Probe() {
  const data = useDemoData();
  renders++;
  return (
    <>
      <nav aria-label="场景类型">
        {data.map((category) => (
          <button key={category.id} data-id={category.id}>
            {category.name}
          </button>
        ))}
      </nav>
      <div aria-label="数据实例">
        {data.flatMap((category) =>
          category.sub.map((item) => (
            <button key={item.id} data-id={item.id}>
              {item.name}
            </button>
          )),
        )}
      </div>
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Probe />);
const harness: SceneLabelsHarness = {
  initialize: () => {
    i18next.addResource('en-US', 'translation', 'Autonomous driving', '');
    return i18next.changeLanguage('en-US');
  },
  changeLanguage: (language) => i18next.changeLanguage(language),
  renderCount: () => renders,
  unmount: () => root.unmount(),
};
Object.assign(window, { sceneLabelsTest: harness });

import type { PublicAnnotationInput } from '@stardustai/annotation-client';
import { Spin } from 'antd';
import i18next from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useDemoData } from './hooks/useDemoData';
import { useEnhancedDataFetcher } from './hooks/useEnhancedDataFetcher';
import type { PublicAnnotationToolStore } from './PublicAnnotationToolStore';
import { exampleInput, quickExamples } from './quickExamples';
import { SceneCase } from './SceneCase';

export default observer(function SceneSelect({
  store,
  onSelect,
}: {
  store: PublicAnnotationToolStore;
  onSelect: (input: PublicAnnotationInput, name: string) => void;
}) {
  const demoData = useDemoData();
  const [category, setCategory] = useState('custom');
  const [active, setActive] = useState('');
  useEffect(() => {
    if (!store.records.length) {
      setCategory('custom');
      setActive('');
    }
  }, [store.records.length]);
  const title = useRef('示例数据');
  const { loading, fetchPublicAnnotationInput, cancelDataLoad } =
    useEnhancedDataFetcher((input) =>
      onSelect(structuredClone(input), title.current),
    );
  function load(
    input: PublicAnnotationInput | string,
    name: string,
    id: string,
  ) {
    title.current = name;
    setActive(id);
    fetchPublicAnnotationInput(
      typeof input === 'string' && !i18next.language?.startsWith('zh')
        ? input.replace('/json/', '/json_en/')
        : input,
    );
  }
  const group = demoData.find((item) => item.id === category);
  return (
    <section className="annotation-scene-panel" aria-label="场景案例">
      <h2>场景案例</h2>
      <Spin spinning={loading}>
        <div className="annotation-scene-row">
          <span className="annotation-scene-label">场景类型:</span>
          <div
            className="annotation-scene-options"
            role="group"
            aria-label="场景类型"
          >
            <button
              type="button"
              className="scene-option"
              aria-pressed={category === 'custom'}
              onClick={() => {
                cancelDataLoad();
                setCategory('custom');
              }}
            >
              自定义
            </button>
            <button
              type="button"
              className="scene-option"
              aria-pressed={category === 'examples'}
              onClick={() => {
                setCategory('examples');
                const example = quickExamples[0];
                load(exampleInput(example), example.name, example.id);
              }}
            >
              默认示例
            </button>
            {demoData
              .filter((item) => item.sub.some((scene) => scene.input))
              .map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="scene-option"
                  aria-pressed={category === item.id}
                  onClick={() => {
                    setCategory(item.id);
                    const scene = item.sub.find((value) => value.input);
                    if (scene) load(scene.input!, scene.name, scene.id);
                  }}
                >
                  {item.name}
                </button>
              ))}
          </div>
        </div>
        {category === 'custom' || category === 'examples' ? (
          <div className="annotation-scene-row">
            <span className="annotation-scene-label">示例数据:</span>
            <div
              className="annotation-scene-options"
              role="group"
              aria-label="默认示例数据"
            >
              {quickExamples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={`scene-option annotation-example-${example.id}`}
                  aria-pressed={
                    active === example.id && category === 'examples'
                  }
                  onClick={() => {
                    setCategory('examples');
                    load(exampleInput(example), example.name, example.id);
                  }}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="annotation-scene-row">
            <span className="annotation-scene-label">典型场景:</span>
            <div
              className="annotation-scene-options"
              role="group"
              aria-label="典型场景"
            >
              {group?.sub
                .filter((item) => item.input)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="scene-option"
                    aria-pressed={active === item.id}
                    onClick={() => load(item.input!, item.name, item.id)}
                  >
                    {item.name}
                  </button>
                ))}
            </div>
          </div>
        )}
        {category === 'custom' && <SceneCase store={store} />}
      </Spin>
    </section>
  );
});

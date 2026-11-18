import type { PublicAnnotationInput } from '@stardustai/annotation-client';
import i18next from 'i18next';
import { v4 as uuid } from 'uuid';

export interface DemoScene {
  id: string;
  name: string;
  input?: PublicAnnotationInput | string;
  onlyChinese?: boolean;
}
export interface DemoCategory {
  id: string;
  name: string;
  sub: DemoScene[];
  onlyChinese?: boolean;
}

// Keep translation keys in the catalog. The SDK initializes i18next after this
// module can be imported, so translated labels must be resolved when displayed.
const demoData: DemoCategory[] = [
  {
    id: uuid(),
    name: '自动标注',
    sub: [
      {
        id: uuid(),
        name: 'OCR,PDF转Markdown',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/441772794830143488.json',
      },
      {
        id: uuid(),
        name: 'QA对提取',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/441789461077307392.json',
      },
      {
        id: uuid(),
        name: '多语种ASR',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/423665371392905216.json',
      },
      {
        id: uuid(),
        name: '交互式目标检测及分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/423681505882554368.json',
      },
      {
        id: uuid(),
        name: '图片描述',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/423681467173322752.json',
      },
      {
        id: uuid(),
        name: '3D交互式检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/246741262940639232.json',
      },
      {
        id: uuid(),
        name: '4D车道线标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/380981267438637056.json',
      },
      {
        id: uuid(),
        name: 'SAM分割算法',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/520920512965386240.json',
      },
      {
        id: uuid(),
        name: '人像分割算法',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/445843239917203456.json',
      },
      {
        id: uuid(),
        name: '小目标检测算法',
        input:
          'oss://stardust-public/rosetta/standalone/json/Auto Labeling/302384951205442531.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '自动驾驶',
    sub: [
      {
        id: uuid(),
        name: '4D车道线路沿&路面标识&红绿灯&拓扑关系标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/421963395660005376.json',
      },
      {
        id: uuid(),
        name: 'BEV车道线路沿标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/335372057519071232.json',
      },
      {
        id: uuid(),
        name: 'OCC-4D语义分割标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/412096689311326208.json',
      },
      {
        id: uuid(),
        name: 'OCC-3D连续帧合并帧语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/466062174972940288.json',
      },
      {
        id: uuid(),
        name: '2D车道线路沿分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/423682412397477888.json',
      },
      {
        id: uuid(),
        name: '3D&2D联合目标追踪（行车）',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/240959512364847104.json',
      },
      {
        id: uuid(),
        name: '2D障碍物&交通灯&路牌&路面标识追踪',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/388312402649034752.json',
      },
      {
        id: uuid(),
        name: '3D全景语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/326976501180809216.json',
      },
      {
        id: uuid(),
        name: '4D BEV泊车路面标识标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/350539503544438784.json',
      },
      {
        id: uuid(),
        name: '4D 可行使区域标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/396132842201161728.json',
      },
      {
        id: uuid(),
        name: 'BEV图可行驶区域分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/387787431250112512.json',
      },
      {
        id: uuid(),
        name: '4D BEV停车位与障碍物追踪',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/390382764446593024.json',
      },
      {
        id: uuid(),
        name: '3D&2D联合目标追踪（泊车）',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/386055494840107008.json',
      },
      {
        id: uuid(),
        name: 'BEV图目标语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/227688885336020879.json',
      },
      {
        id: uuid(),
        name: 'BEV图与环视鱼眼图像联合目标追踪',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/260597269458470768.json',
      },
      {
        id: uuid(),
        name: '环视鱼眼图目标检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/339666629678350336.json',
      },
      {
        id: uuid(),
        name: '数据挖掘多模态大模型标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/370452242593091584.json',
      },
      {
        id: uuid(),
        name: '决策控制端到端-行为描述与预测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/393700385200029696.json',
      },
      {
        id: uuid(),
        name: 'DMS行为检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/213265129406599168.json',
      },
      {
        id: uuid(),
        name: '激光雷达和毫米波雷达融合标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/融合点云.json',
      },
      {
        id: uuid(),
        name: '5R1V融合标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/5R1V.json',
      },
      {
        id: uuid(),
        name: '超声波雷达标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/247289142541697840.json',
      },
      {
        id: uuid(),
        name: '3D&2D联合目标追踪（人类反馈）',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/355540836202848256.json',
      },
      {
        id: uuid(),
        name: '3D目标检测（车、交通灯和交通牌）',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/552757465171759104.json',
      },
      {
        id: uuid(),
        name: '新4D模式标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Autonomous Driving/595445096791678976.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧零售',
    sub: [
      {
        id: uuid(),
        name: '饮品SKU标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Retail/307361105347483650.json',
      },
      {
        id: uuid(),
        name: '衣服图像分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Retail/422938301251993600.json',
      },
      {
        id: uuid(),
        name: '方便面SKU标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Retail/22030311002432150908.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智能安防',
    sub: [
      {
        id: uuid(),
        name: '人脸关键点检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Security/289707807878955049.json',
      },
      {
        id: uuid(),
        name: '人物区分 - ReID',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Security/368690343870607360.json',
      },
      {
        id: uuid(),
        name: '人体姿态估计 - 关键点检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Security/428813781008003072.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧城市',
    sub: [
      {
        id: uuid(),
        name: '遥感图像语义分割标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart City/236400144021602894.json',
      },
      {
        id: uuid(),
        name: '高塔智慧摄像头目标检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart City/302311939214943018.json',
      },
      {
        id: uuid(),
        name: '港口目标分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart City/529600156358942720.json',
      },
      {
        id: uuid(),
        name: '输电塔检测&关键点标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart City/561821009867845632.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧医疗',
    sub: [
      {
        id: uuid(),
        name: '医疗点云语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/235305624219557390.json',
      },
      {
        id: uuid(),
        name: '医疗图像语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/245965144457351168.json',
      },
      {
        id: uuid(),
        name: 'B超或造影图像标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/438291539639410688.json',
      },
      {
        id: uuid(),
        name: '医疗超大像素图像语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/340120548451291136.json',
      },
      {
        id: uuid(),
        name: '医疗票据OCR',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/122278631.json',
      },
      {
        id: uuid(),
        name: '医疗门诊病历OCR',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/266215881474097152.json',
      },
      {
        id: uuid(),
        name: '医疗多轮对话标注',
        onlyChinese: true,
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Healthcare/511732051297443840.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '具身智能',
    sub: [
      {
        id: uuid(),
        name: '4D园区点云语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/228491114083131392.json',
      },
      {
        id: uuid(),
        name: '室内语义分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/253410824448788376.json',
      },
      {
        id: uuid(),
        name: '电源开关检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/6970133015919830007_120.json',
      },
      {
        id: uuid(),
        name: '手势控制识别-手掌分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/T163163520020IR_zswL_036_C.json',
      },

      {
        id: uuid(),
        name: '机械臂分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/533524248254623744.json',
      },
      {
        id: uuid(),
        name: '机器狗语义分割&目标检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Embodied Intelligence/563963569973104640.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧物流',
    sub: [
      {
        id: uuid(),
        name: '物流分拣快递单检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Logistics/224972691793383424.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧交通',
    sub: [
      {
        id: uuid(),
        name: '点云机场目标检测',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Transportation/550209894343913472.json',
      },
      {
        id: uuid(),
        name: '2D机场目标检测&分割&飞机关键点标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Transportation/545150957873807360.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧工业',
    sub: [],
  },
  {
    id: uuid(),
    name: '大模型',
    onlyChinese: true,
    sub: [
      {
        id: uuid(),
        name: 'PDF文档转换Markdown',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/380160134552358912.json',
      },
      {
        id: uuid(),
        name: 'QA对抽取',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/412874940136824832.json',
      },
      {
        id: uuid(),
        name: 'Instruction Following',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/293412966827829577.json',
      },
      {
        id: uuid(),
        name: 'RLHF排序打分',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/386340511143047168.json',
      },
      {
        id: uuid(),
        name: '图像描述',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/423681505261797376.json',
      },
      {
        id: uuid(),
        name: '数学题拆分LaTeX',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/429888434186883072.json',
      },
      {
        id: uuid(),
        name: '物理题拆分',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/482841645457612800.json',
      },
      {
        id: uuid(),
        name: '阿拉伯语菜单标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/435624393918922752.json',
      },
      {
        id: uuid(),
        name: '化学试卷ocr（手写）',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/530679851343294464.json',
      },
      {
        id: uuid(),
        name: 'Excel表格标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/5306798513432944649.json',
      },
      {
        id: uuid(),
        name: 'GUI指令执行',
        input:
          'oss://stardust-public/rosetta/standalone/json/LLM/533105031978037248.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '低空经济',
    sub: [
      {
        id: uuid(),
        name: '无人机避障刹停标注',
        input:
          'oss://stardust-public/rosetta/standalone/json/Low-altitude Economy/562576461794648064.json',
      },
      {
        id: uuid(),
        name: '红外目标识别',
        input:
          'oss://stardust-public/rosetta/standalone/json/Low-altitude Economy/562486870584598528.json',
      },
      {
        id: uuid(),
        name: '底图大点云',
        input:
          'oss://stardust-public/rosetta/standalone/json/Low-altitude Economy/561393493604843520.json',
      },
    ],
  },
  {
    id: uuid(),
    name: '智慧融媒体',
    sub: [
      {
        id: uuid(),
        name: '艺术字分割',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Converged Media/487137533252616192.json',
      },
      {
        id: uuid(),
        name: '视频质量分析',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Converged Media/502411505003151360.json',
      },
      {
        id: uuid(),
        name: '图片美学评分',
        input:
          'oss://stardust-public/rosetta/standalone/json/Smart Converged Media/561811589905387520.json',
      },
    ],
  },
];

function displayName(key: string) {
  if (!i18next.isInitialized) return key;
  const value = i18next.t(key, { defaultValue: key });
  return typeof value === 'string' && value.trim() ? value : key;
}

export function getDemoData(): DemoCategory[] {
  const chinese = (
    i18next.resolvedLanguage ||
    i18next.language ||
    'zh-CN'
  ).startsWith('zh');
  return demoData
    .filter((category) => !category.onlyChinese || chinese)
    .map((category) => ({
      ...category,
      name: displayName(category.name),
      sub: category.sub
        .filter((scene) => !scene.onlyChinese || chinese)
        .map((scene) => ({
          ...scene,
          name: displayName(scene.name),
        })),
    }));
}

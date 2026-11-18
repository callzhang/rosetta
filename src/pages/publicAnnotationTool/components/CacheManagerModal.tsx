import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  Modal,
  Progress,
  Space,
  Tag,
  theme,
  Typography,
} from 'antd';
import i18next from 'i18next';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useCacheManager, type CacheItem } from '../hooks/useCacheManager';
import { getDemoData } from '../demoData';

const { Text } = Typography;

// 优化的缓存列表项组件，避免不必要的重新渲染
const CacheListItem = React.memo<{
  item: CacheItem;
  getStatusColor: (status: CacheItem['status']) => string;
  getStatusIcon: (status: CacheItem['status']) => React.ReactNode;
  formatCacheSize: (size: number) => string;
  onCancel: (id: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  token: ReturnType<typeof theme.useToken>['token'];
}>(
  ({
    item,
    getStatusColor,
    getStatusIcon,
    formatCacheSize,
    onCancel,
    onRefresh,
    onDelete,
    token,
  }) => {
    const isCompleted =
      item.status === 'success' || (item.size > 0 && item.status === 'idle');
    const isCaching = item.status === 'caching';

    return (
      <div
        className="p-4 border rounded-lg"
        style={{
          borderColor:
            item.status !== 'success' && item.status !== 'idle'
              ? getStatusColor(item.status)
              : token.colorBorder,
          backgroundColor: token.colorBgContainer,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <DatabaseOutlined
              className="text-xl mr-3"
              style={{
                color: isCompleted ? '#52c41a' : getStatusColor(item.status),
              }}
            />
            <div className="flex-1">
              <div className="flex items-center mb-1">
                <Text strong>{item.name}</Text>
                {item.size > 0 && (
                  <Tag color="blue" className="ml-2 text-xs">
                    {formatCacheSize(item.size)}
                  </Tag>
                )}
                {item.status === 'error' && (
                  <span className="ml-2">{getStatusIcon(item.status)}</span>
                )}
                {item.status === 'cancelled' && (
                  <span className="ml-2">{getStatusIcon(item.status)}</span>
                )}
              </div>
              <div>
                {item.url && (
                  <Text type="secondary" className="text-xs block">
                    {item.url}
                  </Text>
                )}
              </div>

              {/* 缓存状态信息区域 */}
              <div>
                {isCaching ? (
                  <div className="mb-0.5">
                    <Progress
                      percent={item.progress}
                      size="small"
                      status="active"
                      strokeWidth={4}
                      className="m-0"
                      format={(percent) => {
                        if (item.downloadedSize && item.totalSize) {
                          const downloaded = formatCacheSize(
                            item.downloadedSize,
                          );
                          const total = formatCacheSize(item.totalSize);
                          return `${downloaded}/${total}`;
                        } else if (item.downloadedSize) {
                          return formatCacheSize(item.downloadedSize);
                        }
                        return `${Math.round(percent || 0)}%`;
                      }}
                    />
                  </div>
                ) : isCompleted ? (
                  <Text type="secondary" className="text-xs">
                    {i18next.t('缓存时间')}:{' '}
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                ) : null}

                {item.error && (
                  <Text type="danger" className="text-xs block">
                    {item.error}
                  </Text>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isCaching && (
              <Button
                type="text"
                size="small"
                icon={<StopOutlined />}
                onClick={() => onCancel(item.id)}
                className="text-red-500"
              >
                {i18next.t('取消')}
              </Button>
            )}
            {isCompleted && item.url && (
              <Button
                type="link"
                icon={<SyncOutlined />}
                onClick={() => onRefresh(item.id)}
                title={i18next.t('刷新缓存')}
              >
                {i18next.t('刷新')}
              </Button>
            )}
            {isCompleted && (
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(item.id)}
                title={i18next.t('删除缓存')}
              >
                {i18next.t('删除')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

CacheListItem.displayName = 'CacheListItem';

interface CacheManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

// 从 demoData 中获取所有可缓存的数据资源
const getCacheableResources = () => {
  const resources: Array<{ url: string; name: string }> = [];

  getDemoData().forEach((category) => {
    category.sub.forEach((item) => {
      if (typeof item.input === 'string' && item.input.startsWith('oss://')) {
        resources.push({
          url: item.input,
          name: `${category.name} - ${item.name}`,
        });
      }
    });
  });

  return resources;
};

const CacheManagerModal: React.FC<CacheManagerModalProps> = ({
  visible,
  onClose,
}) => {
  const { token } = theme.useToken();

  const {
    cacheItems,
    batchProgress,
    initializeCacheItems,
    refreshSingleCache,
    deleteCachedData,
    clearAllCache,
    cancelCaching,
    formatCacheSize,
    batchCacheFromURLs,
  } = useCacheManager();

  // 直接从 cacheItems 计算统计信息
  const cacheStats = useMemo(() => {
    const count = cacheItems.length;
    const totalSize = cacheItems.reduce((sum, item) => sum + item.size, 0);
    return { count, totalSize };
  }, [cacheItems]);

  // 删除缓存
  const handleDeleteCache = useCallback(
    async (cacheId: string) => {
      await deleteCachedData(cacheId);
    },
    [deleteCachedData],
  );

  // 清空所有缓存
  const handleClearAllCache = useCallback(async () => {
    await clearAllCache();
  }, [clearAllCache]);

  // 批量缓存所有数据
  const handleBatchCache = useCallback(async () => {
    const resources = getCacheableResources();
    await batchCacheFromURLs(resources);
  }, [batchCacheFromURLs]);

  useEffect(() => {
    if (visible) {
      initializeCacheItems();
    }
  }, [visible, initializeCacheItems]);

  // 获取状态颜色
  const getStatusColor = (status: CacheItem['status']) => {
    switch (status) {
      case 'success':
      case 'idle':
        return '#52c41a';
      case 'error':
        return '#ff4d4f';
      case 'cancelled':
        return '#d9d9d9';
      default:
        return '#1890ff';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: CacheItem['status']) => {
    switch (status) {
      case 'success':
      case 'idle':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'cancelled':
        return <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;
      default:
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // 创建稳定的回调函数
  const handleCancel = useCallback(
    (id: string) => {
      cancelCaching(id);
    },
    [cancelCaching],
  );

  const handleRefresh = useCallback(
    (id: string) => {
      refreshSingleCache(id);
    },
    [refreshSingleCache],
  );

  const handleDelete = useCallback(
    (id: string) => {
      handleDeleteCache(id);
    },
    [handleDeleteCache],
  );

  // 排序缓存项：正在缓存的在前，其他按时间排序
  const sortedCacheItems = useMemo(() => {
    return [...cacheItems].sort((a, b) => {
      const aIsCaching = a.status === 'caching';
      const bIsCaching = b.status === 'caching';

      // 正在缓存的排在最前面
      if (aIsCaching && !bIsCaching) return -1;
      if (!aIsCaching && bIsCaching) return 1;

      // 其他按时间戳排序
      return b.timestamp - a.timestamp;
    });
  }, [cacheItems]);

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined />
          {i18next.t('数据缓存管理')}
          <div>
            <Tag color="blue">
              {cacheStats.count} {i18next.t('项')}
            </Tag>
            <Tag color="green">{formatCacheSize(cacheStats.totalSize)}</Tag>
            {batchProgress && (
              <Tag color="processing">
                {i18next.t('批量缓存')}: {batchProgress.completed}/
                {batchProgress.total}
                {batchProgress.failed > 0 && (
                  <span style={{ color: '#ff4d4f' }}>
                    {' '}
                    ({i18next.t('失败')}: {batchProgress.failed})
                  </span>
                )}
              </Tag>
            )}
          </div>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button
          key="batch"
          type="primary"
          icon={<CloudDownloadOutlined />}
          onClick={handleBatchCache}
        >
          {i18next.t('批量缓存')}
        </Button>,
        <Button
          key="clear"
          icon={<DeleteOutlined />}
          danger
          onClick={handleClearAllCache}
        >
          {i18next.t('清空所有')}
        </Button>,
        <Button key="cancel" onClick={onClose}>
          {i18next.t('关闭')}
        </Button>,
      ]}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {/* 统一的缓存列表 */}
        {sortedCacheItems.length === 0 ? (
          <Empty
            description={i18next.t('暂无缓存数据')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="py-15"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {sortedCacheItems.map((item) => (
              <CacheListItem
                key={`${item.id}-${item.timestamp}-${item.size}-${
                  item.status
                }-${item.progress || 0}`}
                item={item}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                formatCacheSize={formatCacheSize}
                onCancel={handleCancel}
                onRefresh={handleRefresh}
                onDelete={handleDelete}
                token={token}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

CacheManagerModal.displayName = 'CacheManagerModal';

export default CacheManagerModal;

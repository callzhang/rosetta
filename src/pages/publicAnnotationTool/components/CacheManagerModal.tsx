import { useLanguage, getLanguage, t } from '../../../i18n';
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
import React, { useCallback, useEffect, useMemo } from 'react';
import { useCacheManager, type CacheItem } from '../hooks/useCacheManager';
import { getDemoData } from '../demoData';

const { Text } = Typography;

// Memoize cache list items to avoid unnecessary renders.
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
    useLanguage();
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

              {/* Cache status information. */}
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
                    {t('Cached at')}:{' '}
                    {new Date(item.timestamp).toLocaleString(getLanguage())}
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
                {t('Cancel')}
              </Button>
            )}
            {isCompleted && item.url && (
              <Button
                type="link"
                icon={<SyncOutlined />}
                onClick={() => onRefresh(item.id)}
                title={t('Refresh cache')}
              >
                {t('Refresh')}
              </Button>
            )}
            {isCompleted && (
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(item.id)}
                title={t('Delete cache')}
              >
                {t('Delete')}
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

// Collect cacheable resources from the demo catalog.
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
  useLanguage();
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

  // Compute statistics directly from cacheItems.
  const cacheStats = useMemo(() => {
    const count = cacheItems.length;
    const totalSize = cacheItems.reduce((sum, item) => sum + item.size, 0);
    return { count, totalSize };
  }, [cacheItems]);

  // Delete a cache entry.
  const handleDeleteCache = useCallback(
    async (cacheId: string) => {
      await deleteCachedData(cacheId);
    },
    [deleteCachedData],
  );

  // Clear every cache entry.
  const handleClearAllCache = useCallback(async () => {
    await clearAllCache();
  }, [clearAllCache]);

  // Cache all data in a batch.
  const handleBatchCache = useCallback(async () => {
    const resources = getCacheableResources();
    await batchCacheFromURLs(resources);
  }, [batchCacheFromURLs]);

  useEffect(() => {
    if (visible) {
      initializeCacheItems();
    }
  }, [visible, initializeCacheItems]);

  // Get the status color.
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

  // Get the status icon.
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

  // Create stable callbacks.
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

  // Sort active downloads first, then sort by timestamp.
  const sortedCacheItems = useMemo(() => {
    return [...cacheItems].sort((a, b) => {
      const aIsCaching = a.status === 'caching';
      const bIsCaching = b.status === 'caching';

      // Place active downloads first.
      if (aIsCaching && !bIsCaching) return -1;
      if (!aIsCaching && bIsCaching) return 1;

      // Sort remaining items by timestamp.
      return b.timestamp - a.timestamp;
    });
  }, [cacheItems]);

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined />
          {t('Data cache management')}
          <div>
            <Tag color="blue">
              {cacheStats.count} {t('items')}
            </Tag>
            <Tag color="green">{formatCacheSize(cacheStats.totalSize)}</Tag>
            {batchProgress && (
              <Tag color="processing">
                {t('Batch cache')}: {batchProgress.completed}/
                {batchProgress.total}
                {batchProgress.failed > 0 && (
                  <span style={{ color: '#ff4d4f' }}>
                    {' '}
                    ({t('Failed')}: {batchProgress.failed})
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
          {t('Batch cache')}
        </Button>,
        <Button
          key="clear"
          icon={<DeleteOutlined />}
          danger
          onClick={handleClearAllCache}
        >
          {t('Clear all')}
        </Button>,
        <Button key="cancel" onClick={onClose}>
          {t('Close')}
        </Button>,
      ]}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {/* Unified cache list. */}
        {sortedCacheItems.length === 0 ? (
          <Empty
            description={t('No cached data')}
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

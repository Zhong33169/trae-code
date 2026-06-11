'use client';

import React from 'react';
import { Timeline, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { OperationLogDetail, NODE_LABELS } from '@/types';
import dayjs from 'dayjs';

interface OperationTimelineProps {
  logs: OperationLogDetail[];
}

const OperationTimeline: React.FC<OperationTimelineProps> = ({ logs }) => {
  const getIcon = (action: string) => {
    if (action.includes('提交') || action.includes('送审')) {
      return <SendOutlined className="text-blue-500" />;
    }
    if (action.includes('通过') || action.includes('核准') || action.includes('归档') || action.includes('复核')) {
      return <CheckCircleOutlined className="text-green-500" />;
    }
    if (action.includes('打回') || action.includes('驳回')) {
      return <CloseCircleOutlined className="text-red-500" />;
    }
    if (action.includes('创建')) {
      return <FileTextOutlined className="text-purple-500" />;
    }
    return <ClockCircleOutlined className="text-gray-500" />;
  };

  const getColor = (action: string) => {
    if (action.includes('通过') || action.includes('核准') || action.includes('归档') || action.includes('复核')) {
      return 'green';
    }
    if (action.includes('打回') || action.includes('驳回')) {
      return 'red';
    }
    if (action.includes('提交') || action.includes('送审')) {
      return 'blue';
    }
    if (action.includes('创建') || action.includes('补正')) {
      return 'purple';
    }
    return 'gray';
  };

  const getNodeLabel = (log: OperationLogDetail): string | null => {
    const node = log.to_node || log.from_node;
    if (node && NODE_LABELS[node as keyof typeof NODE_LABELS]) {
      return NODE_LABELS[node as keyof typeof NODE_LABELS];
    }
    return null;
  };

  const sortedLogs = [...logs].sort((a, b) =>
    dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
  );

  return (
    <Timeline
      mode="left"
      items={sortedLogs.map((log) => ({
        color: getColor(log.action),
        dot: getIcon(log.action),
        label: (
          <span className="text-gray-500 text-sm">
            {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        ),
        children: (
          <div>
            <div className="font-medium">
              {log.user_name || '系统'}
              {getNodeLabel(log) && (
                <Tag color="blue" className="ml-2">
                  {getNodeLabel(log)}
                </Tag>
              )}
              <span className="ml-2">{log.action}</span>
            </div>
            {log.detail && (
              <div className="text-gray-500 text-sm mt-1">{log.detail}</div>
            )}
          </div>
        ),
      }))}
    />
  );
};

export default OperationTimeline;

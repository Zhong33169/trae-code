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
import { OperationLog, NODE_LABELS } from '@/types';
import dayjs from 'dayjs';

interface OperationTimelineProps {
  logs: OperationLog[];
}

const OperationTimeline: React.FC<OperationTimelineProps> = ({ logs }) => {
  const getIcon = (action: string) => {
    if (action.includes('提交') || action.includes('送审')) {
      return <SendOutlined className="text-blue-500" />;
    }
    if (action.includes('通过') || action.includes('核准') || action.includes('归档')) {
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
    if (action.includes('通过') || action.includes('核准') || action.includes('归档')) {
      return 'green';
    }
    if (action.includes('打回') || action.includes('驳回')) {
      return 'red';
    }
    if (action.includes('提交') || action.includes('送审')) {
      return 'blue';
    }
    if (action.includes('创建')) {
      return 'purple';
    }
    return 'gray';
  };

  const sortedLogs = [...logs].sort((a, b) => 
    dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  );

  return (
    <Timeline
      mode="left"
      items={sortedLogs.map((log) => ({
        color: getColor(log.action),
        dot: getIcon(log.action),
        label: (
          <span className="text-gray-500 text-sm">
            {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        ),
        children: (
          <div>
            <div className="font-medium">
              {log.operatorName}
              <Tag color="blue" className="ml-2">
                {NODE_LABELS[log.node]}
              </Tag>
              <span className="ml-2">{log.action}</span>
            </div>
            {log.remark && (
              <div className="text-gray-500 text-sm mt-1">备注：{log.remark}</div>
            )}
          </div>
        ),
      }))}
    />
  );
};

export default OperationTimeline;

'use client';

import React from 'react';
import { Steps, Tag, Tooltip } from 'antd';
import { WarningOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { TaskDetail, TaskNode, NodeRecordDetail, NODE_LABELS, NODE_ORDER, STATUS_LABELS, getStatusColor } from '@/types';
import { formatTimeoutDisplay } from '@/lib/auth';
import dayjs from 'dayjs';

interface TaskFlowStepsProps {
  task: TaskDetail;
}

const TaskFlowSteps: React.FC<TaskFlowStepsProps> = ({ task }) => {
  const getNodeRecord = (node: TaskNode): NodeRecordDetail | undefined => {
    return task.node_records.find((r) => r.node_type === node);
  };

  const getNodeStatus = (node: TaskNode): 'wait' | 'process' | 'finish' | 'error' => {
    const record = getNodeRecord(node);
    const currentIndex = NODE_ORDER.indexOf(task.current_node);
    const nodeIndex = NODE_ORDER.indexOf(node);

    if (!record) {
      return nodeIndex < currentIndex ? 'finish' : 'wait';
    }

    if (record.action === 'reject') {
      return 'error';
    }

    if (record.completed_at) {
      return 'finish';
    }

    if (node === task.current_node) {
      return 'process';
    }

    return nodeIndex < currentIndex ? 'finish' : 'wait';
  };

  const getNodeIcon = (node: TaskNode) => {
    const record = getNodeRecord(node);
    const status = getNodeStatus(node);

    if ((record && record.is_timeout === 1) || status === 'error') {
      return (
        <div className="animate-pulse">
          <WarningOutlined className="text-red-500 text-xl" />
        </div>
      );
    }

    if (status === 'finish') {
      return <CheckOutlined className="text-green-500" />;
    }

    if (status === 'process') {
      return <ClockCircleOutlined className="text-blue-500" />;
    }

    return undefined;
  };

  const getNodeDescription = (node: TaskNode): React.ReactNode => {
    const record = getNodeRecord(node);
    if (!record) return null;

    return (
      <div className="text-xs text-gray-500 mt-1">
        <div>责任人：{record.operator_name || '-'}</div>
        {record.started_at && (
          <div>开始时间：{dayjs(record.started_at).format('YYYY-MM-DD HH:mm')}</div>
        )}
        {record.completed_at && (
          <div>完成时间：{dayjs(record.completed_at).format('YYYY-MM-DD HH:mm')}</div>
        )}
        {record.is_timeout === 1 && record.timeout_hours > 0 && (
          <Tooltip title={formatTimeoutDisplay(record.timeout_hours)}>
            <Tag color="red" className="mt-1">
              {formatTimeoutDisplay(record.timeout_hours)}
            </Tag>
          </Tooltip>
        )}
        {record.action && (
          <Tag
            color={record.action === 'reject' ? 'red' : record.completed_at ? 'green' : 'blue'}
            className="mt-1"
          >
            {record.action === 'create' ? '创建' :
             record.action === 'submit' ? '提交' :
             record.action === 'approve' ? '通过' :
             record.action === 'reject' ? '打回' :
             record.action === 'process' ? '处理中' : record.action}
          </Tag>
        )}
      </div>
    );
  };

  const steps = NODE_ORDER.map((node) => ({
    title: NODE_LABELS[node],
    description: getNodeDescription(node),
    status: getNodeStatus(node),
    icon: getNodeIcon(node),
  }));

  return (
    <div className="overflow-x-auto pb-4">
      <Steps
        current={NODE_ORDER.indexOf(task.current_node)}
        items={steps}
        size="default"
        className="min-w-[600px]"
      />
    </div>
  );
};

export default TaskFlowSteps;

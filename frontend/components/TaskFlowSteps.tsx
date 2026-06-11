'use client';

import React from 'react';
import { Steps, Tag, Tooltip } from 'antd';
import { WarningOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Task, TaskNode, TaskNodeRecord, NODE_LABELS, NODE_ORDER, STATUS_LABELS } from '@/types';
import { formatTimeoutDuration } from '@/lib/auth';
import dayjs from 'dayjs';

interface TaskFlowStepsProps {
  task: Task;
}

const TaskFlowSteps: React.FC<TaskFlowStepsProps> = ({ task }) => {
  const getNodeRecord = (node: TaskNode): TaskNodeRecord | undefined => {
    return task.nodeRecords.find((r) => r.node === node);
  };

  const getNodeStatus = (node: TaskNode): 'wait' | 'process' | 'finish' | 'error' => {
    const record = getNodeRecord(node);
    const currentIndex = NODE_ORDER.indexOf(task.currentNode);
    const nodeIndex = NODE_ORDER.indexOf(node);

    if (!record) {
      return nodeIndex < currentIndex ? 'finish' : 'wait';
    }

    if (record.status === 'rejected') {
      return 'error';
    }

    if (record.status === 'approved' || record.status === 'completed') {
      return 'finish';
    }

    if (node === task.currentNode) {
      return 'process';
    }

    return nodeIndex < currentIndex ? 'finish' : 'wait';
  };

  const getNodeIcon = (node: TaskNode) => {
    const record = getNodeRecord(node);
    const status = getNodeStatus(node);

    if (record?.isTimeout || status === 'error') {
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
        <div>责任人：{record.assigneeName}</div>
        {record.startedAt && (
          <div>开始时间：{dayjs(record.startedAt).format('YYYY-MM-DD HH:mm')}</div>
        )}
        {record.completedAt && (
          <div>完成时间：{dayjs(record.completedAt).format('YYYY-MM-DD HH:mm')}</div>
        )}
        {record.isTimeout && record.timeoutDuration !== undefined && (
          <Tooltip title={formatTimeoutDuration(record.timeoutDuration)}>
            <Tag color="red" className="mt-1">
              {formatTimeoutDuration(record.timeoutDuration)}
            </Tag>
          </Tooltip>
        )}
        {record.status && (
          <Tag
            color={
              record.status === 'approved' || record.status === 'completed'
                ? 'green'
                : record.status === 'rejected'
                ? 'red'
                : record.status === 'processing'
                ? 'blue'
                : 'default'
            }
            className="mt-1"
          >
            {STATUS_LABELS[record.status]}
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
        current={NODE_ORDER.indexOf(task.currentNode)}
        items={steps}
        size="default"
        className="min-w-[600px]"
      />
    </div>
  );
};

export default TaskFlowSteps;

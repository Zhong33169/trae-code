import { useState } from 'react';
import { Input, Form } from 'antd';

interface Props {
  value?: string;
  onChange?: (val: string) => void;
}

const ProcessingOpinion: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">处理意见</label>
      <Input.TextArea
        rows={3}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="请输入处理意见（必填）"
        maxLength={500}
        showCount
      />
    </div>
  );
};

export default ProcessingOpinion;

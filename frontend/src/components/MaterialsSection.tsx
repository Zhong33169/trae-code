import { Upload, Button, message } from 'antd';
import { Upload as UploadIcon } from 'lucide-react';
import { uploadMaterial } from '@/api/client';
import type { Material } from '@/types';
import dayjs from 'dayjs';

interface Props {
  invitationId: string;
  materials: Material[];
  canUpload: boolean;
  operatorId: string;
  onUploaded: () => void;
}

const MaterialsSection: React.FC<Props> = ({ invitationId, materials, canUpload, operatorId, onUploaded }) => {
  const handleUpload = async (file: File) => {
    try {
      await uploadMaterial(invitationId, file, operatorId);
      message.success('上传成功');
      onUploaded();
    } catch {
      // handled by interceptor
    }
    return false;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">材料附件</h3>
        {canUpload && (
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
          >
            <Button icon={<UploadIcon size={14} />} size="small">上传材料</Button>
          </Upload>
        )}
      </div>
      {materials.length === 0 ? (
        <div className="text-gray-400 text-sm py-4 text-center">暂无附件</div>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{m.fileName}</span>
                <span className="text-gray-400 text-xs">{m.category}</span>
              </div>
              <span className="text-gray-400 text-xs">{dayjs(m.uploadedAt).format('YYYY-MM-DD HH:mm')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialsSection;

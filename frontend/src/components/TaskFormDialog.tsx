import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { SamplingTask, EvidenceType } from "../types";

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => void;
  task?: SamplingTask | null;
  loading?: boolean;
  mode?: "create" | "edit";
}

export interface TaskFormData {
  task_no: string;
  project_name: string;
  sample_location: string;
  sample_type: string;
  evidences: EvidenceFormItem[];
}

interface EvidenceFormItem {
  title: string;
  description: string;
  file_url: string;
  type: EvidenceType;
}

export function TaskFormDialog({
  isOpen,
  onClose,
  onSubmit,
  task,
  loading = false,
  mode = "create",
}: TaskFormDialogProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    task_no: "",
    project_name: "",
    sample_location: "",
    sample_type: "",
    evidences: [],
  });

  useEffect(() => {
    if (task && mode === "edit" && isOpen) {
      const registrationEvidences =
        task.evidences
          ?.filter((e) => e.type === "registration")
          .map((e) => ({
            title: e.title,
            description: e.description,
            file_url: e.file_url,
            type: e.type as EvidenceType,
          })) || [];

      setFormData({
        task_no: task.task_no,
        project_name: task.project_name,
        sample_location: task.sample_location,
        sample_type: task.sample_type,
        evidences: registrationEvidences,
      });
    } else if (isOpen && mode === "create") {
      setFormData({
        task_no: "",
        project_name: "",
        sample_location: "",
        sample_type: "",
        evidences: [],
      });
    }
  }, [task, mode, isOpen]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const handleFieldChange = (field: keyof TaskFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const addEvidence = () => {
    setFormData({
      ...formData,
      evidences: [
        ...formData.evidences,
        { title: "", description: "", file_url: "", type: "registration" },
      ],
    });
  };

  const removeEvidence = (index: number) => {
    setFormData({
      ...formData,
      evidences: formData.evidences.filter((_, i) => i !== index),
    });
  };

  const updateEvidence = (
    index: number,
    field: keyof EvidenceFormItem,
    value: string
  ) => {
    const newEvidences = [...formData.evidences];
    (newEvidences[index] as any)[field] = value;
    setFormData({ ...formData, evidences: newEvidences });
  };

  const sampleTypes = ["水样", "土壤样", "大气样", "噪声样", "固体废物样"];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "新建采样任务" : "编辑采样任务"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务编号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.task_no}
              onChange={(e) => handleFieldChange("task_no", e.target.value)}
              placeholder="请输入任务编号"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              采样类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.sample_type}
              onChange={(e) =>
                handleFieldChange("sample_type", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">请选择采样类型</option>
              {sampleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            项目名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.project_name}
            onChange={(e) => handleFieldChange("project_name", e.target.value)}
            placeholder="请输入项目名称"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            采样地点 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.sample_location}
            onChange={(e) =>
              handleFieldChange("sample_location", e.target.value)
            }
            placeholder="请输入采样地点"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              登记证据 <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addEvidence}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + 添加证据
            </button>
          </div>
          <div className="space-y-3">
            {formData.evidences.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-md">
                暂无登记证据，点击上方按钮添加
              </p>
            )}
            {formData.evidences.map((evidence, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    证据 {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEvidence(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    删除
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="证据标题"
                  value={evidence.title}
                  onChange={(e) =>
                    updateEvidence(index, "title", e.target.value)
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <textarea
                  placeholder="证据描述"
                  value={evidence.description}
                  onChange={(e) =>
                    updateEvidence(index, "description", e.target.value)
                  }
                  rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <input
                  type="text"
                  placeholder="文件路径（模拟）"
                  value={evidence.file_url}
                  onChange={(e) =>
                    updateEvidence(index, "file_url", e.target.value)
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

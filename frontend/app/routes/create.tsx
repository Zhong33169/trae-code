import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { apiFetch } from "~/api/client";

export default function CreateDemand() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    client_name: "",
    brief_opinion: "",
    remarks: "",
    brief_materials: [""] as string[],
    attachments: [""] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.client_name.trim()) {
      alert("请填写标题和客户名称");
      return;
    }

    setLoading(true);
    try {
      const briefMaterials = formData.brief_materials.filter((m) => m.trim());
      const attachments = formData.attachments.filter((a) => a.trim());

      const data: Record<string, any> = {
        title: formData.title,
        client_name: formData.client_name,
      };

      if (briefMaterials.length > 0) {
        data.brief_materials = briefMaterials;
      }
      if (attachments.length > 0) {
        data.attachments = attachments;
      }
      if (formData.brief_opinion.trim()) {
        data.brief_opinion = formData.brief_opinion;
      }
      if (formData.remarks.trim()) {
        data.remarks = formData.remarks;
      }

      const result = await apiFetch<any>("/api/creative-demands", {
        method: "POST",
        body: JSON.stringify(data),
      });

      alert("创建成功");
      navigate(`/demand/${result.id}`);
    } catch (err: any) {
      alert(`创建失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          className="btn btn-secondary text-sm"
          onClick={() => navigate("/")}
        >
          ← 返回列表
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新建创意需求单</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">
              需求单标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="input"
              placeholder="请输入需求单标题"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">
              客户名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="input"
              placeholder="请输入客户名称"
              value={formData.client_name}
              onChange={(e) =>
                setFormData({ ...formData, client_name: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">brief接收材料</label>
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-800"
              onClick={() =>
                setFormData({
                  ...formData,
                  brief_materials: [...formData.brief_materials, ""],
                })
              }
            >
              + 添加材料
            </button>
          </div>
          <div className="space-y-2">
            {formData.brief_materials.map((m, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="材料文件名"
                  value={m}
                  onChange={(e) => {
                    const newMaterials = [...formData.brief_materials];
                    newMaterials[idx] = e.target.value;
                    setFormData({ ...formData, brief_materials: newMaterials });
                  }}
                />
                {formData.brief_materials.length > 1 && (
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 px-2"
                    onClick={() => {
                      const newMaterials = formData.brief_materials.filter(
                        (_, i) => i !== idx
                      );
                      setFormData({ ...formData, brief_materials: newMaterials });
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">brief处理意见</label>
          <textarea
            className="input"
            rows={3}
            placeholder="请填写brief接收的处理意见（如后续提交审核，此项为必填）"
            value={formData.brief_opinion}
            onChange={(e) =>
              setFormData({ ...formData, brief_opinion: e.target.value })
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">附件</label>
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-800"
              onClick={() =>
                setFormData({
                  ...formData,
                  attachments: [...formData.attachments, ""],
                })
              }
            >
              + 添加附件
            </button>
          </div>
          <div className="space-y-2">
            {formData.attachments.map((a, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="附件文件名"
                  value={a}
                  onChange={(e) => {
                    const newAttachments = [...formData.attachments];
                    newAttachments[idx] = e.target.value;
                    setFormData({ ...formData, attachments: newAttachments });
                  }}
                />
                {formData.attachments.length > 1 && (
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 px-2"
                    onClick={() => {
                      const newAttachments = formData.attachments.filter(
                        (_, i) => i !== idx
                      );
                      setFormData({ ...formData, attachments: newAttachments });
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">备注</label>
          <textarea
            className="input"
            rows={3}
            placeholder="请输入备注信息（可选）"
            value={formData.remarks}
            onChange={(e) =>
              setFormData({ ...formData, remarks: e.target.value })
            }
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "创建中..." : "创建需求单"}
          </button>
        </div>
      </form>
    </div>
  );
}

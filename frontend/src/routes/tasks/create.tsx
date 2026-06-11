import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";
import { authStore } from "~/store/auth";
import { showToast } from "~/store/toast";

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(false);
  const [formData, setFormData] = createSignal({
    taskName: "",
    cropType: "rice",
    plantingArea: "",
    location: "",
    planterName: "",
    planterPhone: "",
    description: "",
  });
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  onMount(() => {
    if (!authStore.hasRole("registrar")) {
      showToast("只有种植登记员可以创建任务", "warning");
      navigate("/tasks", { replace: true });
    }
  });

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData(), [field]: value });
    if (errors()[field]) {
      setErrors({ ...errors(), [field]: "" });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const data = formData();

    if (!data.taskName.trim()) {
      newErrors.taskName = "请输入任务名称";
    }
    if (!data.cropType) {
      newErrors.cropType = "请选择作物类型";
    }
    if (!data.plantingArea || parseFloat(data.plantingArea) <= 0) {
      newErrors.plantingArea = "请输入有效的种植面积";
    }
    if (!data.location.trim()) {
      newErrors.location = "请输入种植地点";
    }
    if (!data.planterName.trim()) {
      newErrors.planterName = "请输入种植户姓名";
    }
    if (!data.planterPhone.trim()) {
      newErrors.planterPhone = "请输入联系电话";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await api.createTask({
        ...formData(),
        plantingArea: parseFloat(formData().plantingArea),
      });
      showToast("任务创建成功", "success");
      navigate(`/tasks/${result.data.id}`);
    } catch (err: any) {
      showToast(err.message || "创建失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">新建种植任务</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="form-row">
            <div class="form-item">
              <label class="form-label required">任务名称</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入任务名称"
                value={formData().taskName}
                onInput={(e) => handleChange("taskName", e.target.value)}
              />
              {errors().taskName && <div class="error-message">{errors().taskName}</div>}
            </div>

            <div class="form-item">
              <label class="form-label required">作物类型</label>
              <select
                class="form-select"
                value={formData().cropType}
                onChange={(e) => handleChange("cropType", e.target.value)}
              >
                <option value="rice">水稻</option>
                <option value="wheat">小麦</option>
                <option value="corn">玉米</option>
                <option value="soybean">大豆</option>
                <option value="vegetable">蔬菜</option>
                <option value="fruit">水果</option>
                <option value="other">其他</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-item">
              <label class="form-label required">种植面积（亩）</label>
              <input
                type="number"
                class="form-input"
                placeholder="请输入种植面积"
                value={formData().plantingArea}
                onInput={(e) => handleChange("plantingArea", e.target.value)}
                min="0"
                step="0.01"
              />
              {errors().plantingArea && <div class="error-message">{errors().plantingArea}</div>}
            </div>

            <div class="form-item">
              <label class="form-label required">种植地点</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入种植地点"
                value={formData().location}
                onInput={(e) => handleChange("location", e.target.value)}
              />
              {errors().location && <div class="error-message">{errors().location}</div>}
            </div>
          </div>

          <div class="form-row">
            <div class="form-item">
              <label class="form-label required">种植户姓名</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入种植户姓名"
                value={formData().planterName}
                onInput={(e) => handleChange("planterName", e.target.value)}
              />
              {errors().planterName && <div class="error-message">{errors().planterName}</div>}
            </div>

            <div class="form-item">
              <label class="form-label required">联系电话</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入联系电话"
                value={formData().planterPhone}
                onInput={(e) => handleChange("planterPhone", e.target.value)}
              />
              {errors().planterPhone && <div class="error-message">{errors().planterPhone}</div>}
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">任务描述</label>
            <textarea
              class="form-textarea"
              placeholder="请输入任务描述（选填）"
              value={formData().description}
              onInput={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div class="action-bar">
            <button type="button" class="btn btn-default" onClick={() => navigate("/tasks")}>
              取消
            </button>
            <button type="submit" class="btn btn-primary" disabled={loading()}>
              {loading() ? "创建中..." : "创建任务"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

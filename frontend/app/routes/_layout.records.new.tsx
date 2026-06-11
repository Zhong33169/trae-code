import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useActionData, useNavigate, Link } from "@remix-run/react";
import { useState } from "react";
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Row,
  Col,
  Space,
  Select,
  App,
  Modal,
  Tag,
} from "antd";
import { ArrowLeftOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiPost } from "~/utils/api.server";
import dayjs from "dayjs";
import type { UploadProps } from "antd";

const { TextArea } = Input;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await requireAuth(request);
  if (user.role !== "registrar") {
    throw redirect("/");
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { token } = await requireAuth(request);
  const formData = await request.formData();

  const data = {
    projectName: formData.get("projectName") as string,
    constructionUnit: formData.get("constructionUnit") as string,
    supervisionUnit: formData.get("supervisionUnit") as string,
    location: formData.get("location") as string,
    recordDate: formData.get("recordDate") as string,
    weather: formData.get("weather") as string,
    temperature: formData.get("temperature") as string,
    content: formData.get("content") as string,
    issues: formData.get("issues") as string,
    requirement: formData.get("requirement") as string,
    evidences: JSON.parse(formData.get("evidences") as string || "[]"),
  };

  const response = await apiPost<{ id: number; recordNo: string }>(token, "/api/records", data);
  
  if (response.code === 200) {
    const submitNow = formData.get("submitNow") === "on";
    if (submitNow) {
      await apiPost(token, `/api/records/${response.data.id}/operate`, {
        operation: "submit",
        version: 1,
      });
    }
    return redirect(`/records/${response.data.id}`);
  }

  return json(response);
};

export default function NewRecord() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [evidenceForm] = Form.useForm();

  if (actionData && "code" in actionData && actionData.code !== 200) {
    messageApi.error(actionData.message || "创建失败");
  }

  const [evidences, setEvidences] = useState<any[]>([]);

  const uploadProps: UploadProps = {
    fileList: evidences.map((e, idx) => ({
      uid: `-${idx}`,
      name: e.name,
      status: "done",
      url: e.fileUrl,
      type: e.type,
    })),
    beforeUpload: () => false,
    onRemove: (file) => {
      const idx = evidences.findIndex((_, i) => `-${i}` === file.uid);
      if (idx > -1) {
        setEvidences(evidences.filter((_, i) => i !== idx));
      }
    },
  };

  const handleAddEvidence = () => {
    const typeOptions = [
      { value: "photo", label: "照片" },
      { value: "video", label: "视频" },
      { value: "document", label: "文档" },
      { value: "signature", label: "签字" },
      { value: "other", label: "其他" },
    ];
    evidenceForm.resetFields();
    Modal.confirm({
      title: "添加证据",
      content: (
        <Form form={evidenceForm} layout="vertical" preserve={false}>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: "请选择证据类型" }]}>
            <Select placeholder="请选择证据类型" options={typeOptions} />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入证据名称" }]}>
            <Input placeholder="请输入证据名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="请输入证据描述（可选）" />
          </Form.Item>
          <Form.Item label="文件标识" name="fileUrl" rules={[{ required: true, message: "请输入文件标识" }]}>
            <Input placeholder="请输入文件标识或URL（演示用）" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        try {
          const values = await evidenceForm.validateFields();
          setEvidences([...evidences, values]);
          messageApi.success("证据已添加");
        } catch {
          return Promise.reject();
        }
      },
    });
  };

  const handleSubmit = async (values: any, submitNow: boolean) => {
    const formEl = document.createElement('form');
    formEl.method = 'post';
    formEl.style.display = 'none';
    
    const addField = (name: string, value: any) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      formEl.appendChild(input);
    };
    
    addField('projectName', values.projectName);
    addField('constructionUnit', values.constructionUnit || '');
    addField('supervisionUnit', values.supervisionUnit || '');
    addField('location', values.location || '');
    addField('recordDate', dayjs(values.recordDate).format('YYYY-MM-DD'));
    addField('weather', values.weather || '');
    addField('temperature', values.temperature || '');
    addField('content', values.content);
    addField('issues', values.issues || '');
    addField('requirement', values.requirement || '');
    addField('evidences', JSON.stringify(evidences));
    if (submitNow) {
      addField('submitNow', 'on');
    }
    
    document.body.appendChild(formEl);
    formEl.submit();
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields(["projectName", "recordDate", "content"]);
      handleSubmit(values, false);
    } catch (err) {
      messageApi.error("请填写必填项");
    }
  };

  const handleSaveAndSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (evidences.length === 0) {
        messageApi.warning("请至少上传一份证据材料（照片）");
        return;
      }
      if (!evidences.some(e => e.type === "photo")) {
        messageApi.warning("必须包含照片证据");
        return;
      }
      handleSubmit(values, true);
    } catch (err) {
      messageApi.error("请填写完整信息");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/records" style={{ color: "#1890ff" }}>
          <ArrowLeftOutlined /> 返回列表
        </Link>
      </div>

      <Card title="新建旁站记录单">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            recordDate: dayjs(),
            supervisionUnit: "中正监理有限公司",
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="工程名称"
                name="projectName"
                rules={[
                  { required: true, message: "请输入工程名称" },
                  { max: 200, message: "最多200个字符" },
                ]}
              >
                <Input placeholder="请输入工程名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="施工单位" name="constructionUnit">
                <Input placeholder="请输入施工单位" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="监理单位" name="supervisionUnit">
                <Input placeholder="请输入监理单位" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="施工部位/地点" name="location">
                <Input placeholder="请输入施工部位或地点" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="旁站日期"
                name="recordDate"
                rules={[{ required: true, message: "请选择旁站日期" }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="天气" name="weather">
                <Select 
                  placeholder="请选择天气" 
                  options={[
                    { value: "晴", label: "晴" },
                    { value: "多云", label: "多云" },
                    { value: "阴", label: "阴" },
                    { value: "小雨", label: "小雨" },
                    { value: "中雨", label: "中雨" },
                    { value: "大雨", label: "大雨" },
                    { value: "雪", label: "雪" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="气温" name="temperature">
                <Input placeholder="如：25℃" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="旁站内容"
            name="content"
            rules={[
              { required: true, message: "请填写旁站内容" },
              { min: 10, message: "内容不少于10个字符" },
              { max: 2000, message: "最多2000个字符" },
            ]}
          >
            <TextArea
              rows={5}
              placeholder="请详细描述旁站监督的内容、过程、检查项目等..."
              showCount
            />
          </Form.Item>

          <Form.Item
            label="发现问题"
            name="issues"
            rules={[{ max: 1000, message: "最多1000个字符" }]}
          >
            <TextArea
              rows={3}
              placeholder="如发现问题，请详细描述问题情况（无问题可留空）..."
              showCount
            />
          </Form.Item>

          <Form.Item
            label="整改要求"
            name="requirement"
            rules={[{ max: 1000, message: "最多1000个字符" }]}
          >
            <TextArea
              rows={3}
              placeholder="请填写对发现问题的整改要求（无问题可留空）..."
              showCount
            />
          </Form.Item>

          <Form.Item label="证据材料">
            <div style={{ marginBottom: 8 }}>
              <Button icon={<PlusOutlined />} onClick={handleAddEvidence}>
                添加证据
              </Button>
              <span style={{ marginLeft: 8, color: "#999", fontSize: 12 }}>
                必须包含至少1份照片证据
              </span>
            </div>
            {evidences.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {evidences.map((e, idx) => (
                  <Tag
                    key={idx}
                    closable
                    onClose={() => setEvidences(evidences.filter((_, i) => i !== idx))}
                    color="blue"
                    style={{ padding: "4px 8px", fontSize: 14 }}
                  >
                    {e.type === "photo" ? "📷" :
                     e.type === "video" ? "🎬" :
                     e.type === "document" ? "📄" :
                     e.type === "signature" ? "✍️" : "📎"}
                    {" "}{e.name}
                  </Tag>
                ))}
              </div>
            )}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={handleSaveDraft}>保存草稿</Button>
              <Button type="primary" onClick={handleSaveAndSubmit}>
                保存并提交审核
              </Button>
              <Button onClick={() => navigate("/records")}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

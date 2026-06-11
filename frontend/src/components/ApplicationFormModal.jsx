import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, Button, message, Space, Table, Checkbox } from 'antd'
import { PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { applicationAPI } from '../api'
import { INSURANCE_TYPES, getMaterialsByType } from '../utils/constants'

const { Option } = Select
const { TextArea } = Input

export default function ApplicationFormModal({ visible, app, onCancel, onSuccess }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState([])
  const [insuranceType, setInsuranceType] = useState('')

  useEffect(() => {
    if (visible) {
      if (app) {
        form.setFieldsValue({
          applicant_name: app.applicant_name,
          applicant_id_card: app.applicant_id_card,
          applicant_phone: app.applicant_phone,
          insurance_type: app.insurance_type,
          insurance_amount: app.insurance_amount,
          premium: app.premium,
          notes: app.notes,
        })
        setInsuranceType(app.insurance_type)
        if (app.materials) {
          try {
            setMaterials(JSON.parse(app.materials))
          } catch {
            setMaterials(getMaterialsByType(app.insurance_type))
          }
        } else {
          setMaterials(getMaterialsByType(app.insurance_type))
        }
      } else {
        form.resetFields()
        setMaterials([])
        setInsuranceType('')
      }
    }
  }, [visible, app])

  const handleInsuranceTypeChange = (value) => {
    setInsuranceType(value)
    setMaterials(getMaterialsByType(value))
  }

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...materials]
    newMaterials[index][field] = value
    setMaterials(newMaterials)
  }

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const materialsJSON = JSON.stringify(materials)

      let res
      if (app) {
        res = await applicationAPI.update(app.id, {
          ...values,
          materials: materialsJSON,
        })
        message.success('更新成功')
      } else {
        res = await applicationAPI.create({
          ...values,
          materials: materialsJSON,
        })
        message.success('创建成功')
      }
      onSuccess()
    } catch (error) {
      message.error(error.response?.data?.error || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const materialColumns = [
    {
      title: '材料名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 80,
      render: (v) => v ? '是' : '否',
    },
    {
      title: '已提供',
      dataIndex: 'provided',
      key: 'provided',
      width: 100,
      render: (v, record, index) => (
        <Checkbox
          checked={v}
          onChange={(e) => handleMaterialChange(index, 'provided', e.target.checked)}
        />
      ),
    },
    {
      title: '已核验',
      dataIndex: 'verified',
      key: 'verified',
      width: 100,
      render: (v, record, index) => (
        <Checkbox
          checked={v}
          onChange={(e) => handleMaterialChange(index, 'verified', e.target.checked)}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (v, record, index) => (
        <Input
          value={v}
          onChange={(e) => handleMaterialChange(index, 'notes', e.target.value)}
          placeholder="备注"
        />
      ),
    },
  ]

  return (
    <Modal
      title={app ? '编辑投保申请' : '新增投保申请'}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="applicant_name"
            label="投保人姓名"
            rules={[{ required: true, message: '请输入投保人姓名' }]}
          >
            <Input placeholder="请输入投保人姓名" />
          </Form.Item>

          <Form.Item
            name="applicant_id_card"
            label="身份证号"
            rules={[{ required: true, message: '请输入身份证号' }]}
          >
            <Input placeholder="请输入18位身份证号" maxLength={18} />
          </Form.Item>

          <Form.Item
            name="applicant_phone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入11位手机号" maxLength={11} />
          </Form.Item>

          <Form.Item
            name="insurance_type"
            label="险种"
            rules={[{ required: true, message: '请选择险种' }]}
          >
            <Select placeholder="请选择险种" onChange={handleInsuranceTypeChange}>
              {INSURANCE_TYPES.map(t => (
              <Option key={t.value} value={t.value}>{t.label}</Option>
            ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="insurance_amount"
            label="保险金额（元）"
            rules={[{ required: true, message: '请输入保险金额' }]}
          >
            <InputNumber
              placeholder="请输入保险金额"
              style={{ width: '100%' }}
              min={0}
            />
          </Form.Item>

          <Form.Item
            name="premium"
            label="保费（元）"
            rules={[{ required: true, message: '请输入保费' }]}
          >
            <InputNumber
              placeholder="请输入保费"
              style={{ width: '100%' }}
              min={0}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="notes"
          label="备注"
        >
          <TextArea rows={2} placeholder="备注信息" />
        </Form.Item>

        {insuranceType && (
          <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>投保材料清单</div>
          <Table
            className="material-table"
            columns={materialColumns}
            dataSource={materials}
            rowKey="name"
            pagination={false}
            size="small"
          />
          </div>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
              {app ? '保存修改' : '创建申请'}
            </Button>
            <Button onClick={onCancel}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

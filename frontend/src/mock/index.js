let mockTickets = [
  {
    id: 1,
    ticketNo: 'TK202401001',
    customerName: '张三',
    phone: '13800138001',
    problemType: 'consult',
    priority: 'medium',
    status: 'pending_sign',
    handler: '',
    creator: '李四',
    createdAt: '2024-01-15 09:30:00',
    deadline: '2024-01-16 18:00:00',
    description: '咨询产品使用方法，对新功能不太熟悉，需要详细指导。'
  },
  {
    id: 2,
    ticketNo: 'TK202401002',
    customerName: '王五',
    phone: '13800138002',
    problemType: 'complaint',
    priority: 'high',
    status: 'processing',
    handler: '赵六',
    creator: '李四',
    createdAt: '2024-01-15 10:15:00',
    deadline: '2024-01-15 18:00:00',
    description: '投诉服务态度问题，客户表示上次沟通中客服态度不好。'
  },
  {
    id: 3,
    ticketNo: 'TK202401003',
    customerName: '钱七',
    phone: '13800138003',
    problemType: 'repair',
    priority: 'urgent',
    status: 'abnormal_return',
    handler: '孙八',
    creator: '李四',
    createdAt: '2024-01-15 11:00:00',
    deadline: '2024-01-15 14:00:00',
    description: '设备故障报修，无法正常开机，影响正常使用。'
  },
  {
    id: 4,
    ticketNo: 'TK202401004',
    customerName: '周九',
    phone: '13800138004',
    problemType: 'suggestion',
    priority: 'low',
    status: 'pending_visit',
    handler: '吴十',
    creator: '李四',
    createdAt: '2024-01-15 14:20:00',
    deadline: '2024-01-17 18:00:00',
    description: '建议增加夜间模式功能，方便晚上使用。'
  },
  {
    id: 5,
    ticketNo: 'TK202401005',
    customerName: '郑十一',
    phone: '13800138005',
    problemType: 'consult',
    priority: 'medium',
    status: 'closed',
    handler: '王十二',
    creator: '李四',
    signer: '王十二',
    signTime: '2024-01-15 09:00:00',
    closer: '王十二',
    closeTime: '2024-01-15 16:30:00',
    createdAt: '2024-01-15 08:30:00',
    deadline: '2024-01-16 18:00:00',
    description: '咨询账户余额查询方式，已指导操作。',
    visitResult: 'customer_satisfied',
    satisfaction: 5,
    visitRemark: '客户表示满意，问题已解决。'
  },
  {
    id: 6,
    ticketNo: 'TK202401006',
    customerName: '冯十三',
    phone: '13800138006',
    problemType: 'repair',
    priority: 'high',
    status: 'processing',
    handler: '赵六',
    creator: '李四',
    signer: '赵六',
    signTime: '2024-01-15 10:30:00',
    createdAt: '2024-01-15 10:00:00',
    deadline: '2024-01-16 12:00:00',
    description: '产品退换货问题，需要尽快处理。'
  },
  {
    id: 7,
    ticketNo: 'TK202401007',
    customerName: '陈十四',
    phone: '13800138007',
    problemType: 'complaint',
    priority: 'urgent',
    status: 'pending_sign',
    handler: '',
    creator: '李四',
    createdAt: '2024-01-15 15:45:00',
    deadline: '2024-01-15 20:00:00',
    description: '强烈投诉产品质量问题，要求立即处理，否则媒体曝光。'
  },
  {
    id: 8,
    ticketNo: 'TK202401008',
    customerName: '褚十五',
    phone: '13800138008',
    problemType: 'consult',
    priority: 'low',
    status: 'pending_sign',
    handler: '',
    creator: '李四',
    createdAt: '2024-01-15 16:00:00',
    deadline: '2024-01-17 18:00:00',
    description: '咨询会员积分兑换规则。'
  }
]

let mockTracksMap = {
  1: [
    { id: 1, type: 'create', title: '工单创建', time: '2024-01-15 09:30:00', operator: '李四', remark: '客户来电咨询产品使用方法' }
  ],
  2: [
    { id: 1, type: 'create', title: '工单创建', time: '2024-01-15 10:15:00', operator: '李四', remark: '客户投诉服务态度问题' },
    { id: 2, type: 'assign', title: '工单派单', time: '2024-01-15 10:30:00', operator: '客服经理', remark: '派单给赵六处理，请优先处理' },
    { id: 3, type: 'sign', title: '工单签收', time: '2024-01-15 10:45:00', operator: '赵六', remark: '' },
    { id: 4, type: 'process', title: '处理中', time: '2024-01-15 11:00:00', operator: '赵六', remark: '已联系客户了解情况，正在核实中' }
  ],
  3: [
    { id: 1, type: 'create', title: '工单创建', time: '2024-01-15 11:00:00', operator: '李四', remark: '设备故障报修' },
    { id: 2, type: 'assign', title: '工单派单', time: '2024-01-15 11:10:00', operator: '客服经理', remark: '紧急工单，尽快处理' },
    { id: 3, type: 'sign', title: '工单签收', time: '2024-01-15 11:15:00', operator: '孙八', remark: '' },
    { id: 4, type: 'abnormal', title: '异常回传', time: '2024-01-15 13:00:00', operator: '孙八', remark: '客户不在家，无法上门维修，已联系改约' }
  ],
  4: [
    { id: 1, type: 'create', title: '工单创建', time: '2024-01-15 14:20:00', operator: '李四', remark: '功能建议' },
    { id: 2, type: 'assign', title: '工单派单', time: '2024-01-15 14:30:00', operator: '质检主管', remark: '产品建议类工单' },
    { id: 3, type: 'sign', title: '工单签收', time: '2024-01-15 14:45:00', operator: '吴十', remark: '' },
    { id: 4, type: 'process', title: '处理完成', time: '2024-01-15 16:00:00', operator: '吴十', remark: '已记录客户建议，反馈给产品部门' }
  ],
  5: [
    { id: 1, type: 'create', title: '工单创建', time: '2024-01-15 08:30:00', operator: '李四', remark: '账户查询咨询' },
    { id: 2, type: 'assign', title: '工单派单', time: '2024-01-15 08:35:00', operator: '客服经理', remark: '' },
    { id: 3, type: 'sign', title: '工单签收', time: '2024-01-15 09:00:00', operator: '王十二', remark: '' },
    { id: 4, type: 'process', title: '处理完成', time: '2024-01-15 10:00:00', operator: '王十二', remark: '已电话指导客户操作' },
    { id: 5, type: 'close', title: '工单关闭', time: '2024-01-15 16:30:00', operator: '质检主管', remark: '回访客户，问题已解决，客户满意' }
  ]
}

const mockUsers = [
  { id: 1, name: '张三', role: 'agent' },
  { id: 2, name: '李四', role: 'agent' },
  { id: 3, name: '王五', role: 'agent' },
  { id: 4, name: '赵六', role: 'agent' },
  { id: 5, name: '孙八', role: 'agent' },
  { id: 6, name: '吴十', role: 'agent' },
  { id: 7, name: '王十二', role: 'agent' },
  { id: 10, name: '质检主管A', role: 'quality_supervisor' },
  { id: 11, name: '客服经理B', role: 'service_manager' }
]

function getNowTime() {
  const now = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function addTrack(ticketId, type, title, operator, remark = '') {
  if (!mockTracksMap[ticketId]) {
    mockTracksMap[ticketId] = []
  }
  mockTracksMap[ticketId].push({
    id: Date.now(),
    type,
    title,
    time: getNowTime(),
    operator,
    remark
  })
}

function getStats() {
  const total = mockTickets.length
  const pendingSign = mockTickets.filter(t => t.status === 'pending_sign').length
  const abnormalReturn = mockTickets.filter(t => t.status === 'abnormal_return').length
  const signCompleted = mockTickets.filter(t => t.status === 'closed' || t.status === 'pending_visit').length
  return { total, pendingSign, abnormalReturn, signCompleted }
}

function getHandlerName(handlerId) {
  const user = mockUsers.find(u => u.id === handlerId)
  return user ? user.name : '未知处理人'
}

export function mockRequest(config) {
  const { url, method, data, params } = config

  return new Promise((resolve) => {
    setTimeout(() => {
      let result = { code: 200, message: 'success', data: null }

      if (url.includes('/auth/login') && method === 'post') {
        const userInfo = {
          id: 1,
          username: data.username,
          role: data.role,
          name: data.role === 'agent' ? '坐席小王' : data.role === 'quality_supervisor' ? '质检主管' : '客服经理'
        }
        result.data = {
          token: 'mock-token-' + Date.now(),
          userInfo
        }
      } else if (url.includes('/auth/logout')) {
        result.data = null
      } else if (url.includes('/tickets/stats')) {
        result.data = getStats()
      } else if (url.includes('/tickets') && url.includes('/tracks')) {
        const id = parseInt(url.match(/\/tickets\/(\d+)\/tracks/)?.[1] || 1)
        result.data = mockTracksMap[id] || []
      } else if (url.includes('/tickets') && /\/tickets\/\d+/.test(url) && method === 'get') {
        const id = parseInt(url.match(/\/tickets\/(\d+)/)?.[1] || 1)
        const ticket = mockTickets.find(t => t.id === id)
        if (ticket) {
          result.data = {
            ...ticket,
            tracks: mockTracksMap[id] || []
          }
        }
      } else if (url.includes('/tickets') && method === 'get') {
        const page = params?.page || 1
        const pageSize = params?.pageSize || 10
        const keyword = params?.keyword || ''
        const status = params?.status || ''
        const priority = params?.priority || ''

        let filtered = [...mockTickets]

        if (keyword) {
          filtered = filtered.filter(t =>
            t.ticketNo.includes(keyword) ||
            t.customerName.includes(keyword) ||
            t.phone.includes(keyword)
          )
        }
        if (status) {
          filtered = filtered.filter(t => t.status === status)
        }
        if (priority) {
          filtered = filtered.filter(t => t.priority === priority)
        }

        const start = (page - 1) * pageSize
        const end = start + pageSize
        const list = filtered.slice(start, end)

        result.data = {
          list,
          total: filtered.length
        }
      } else if (url.includes('/tickets/call-register')) {
        const newId = Math.max(...mockTickets.map(t => t.id)) + 1
        const newTicket = {
          id: newId,
          ticketNo: `TK${new Date().getFullYear()}${String(newId).padStart(5, '0')}`,
          customerName: data.customerName,
          phone: data.phone,
          problemType: data.problemType,
          priority: data.priority,
          status: 'pending_sign',
          handler: '',
          creator: '当前用户',
          createdAt: getNowTime(),
          deadline: data.deadline || '',
          description: data.description
        }
        mockTickets.unshift(newTicket)
        mockTracksMap[newId] = [
          { id: Date.now(), type: 'create', title: '工单创建', time: getNowTime(), operator: '当前用户', remark: data.description }
        ]
        result.data = newTicket
      } else if (url.includes('/assign') && method === 'post') {
        const id = parseInt(url.match(/\/tickets\/(\d+)\/assign/)?.[1] || 1)
        const ticket = mockTickets.find(t => t.id === id)
        if (ticket) {
          ticket.handler = getHandlerName(data.handlerId)
          ticket.status = 'processing'
          ticket.deadline = data.deadline || ticket.deadline
          addTrack(id, 'assign', '工单派单', '当前用户', data.remark || '')
        }
        result.data = { success: true }
      } else if (url.includes('/close') && method === 'post') {
        const id = parseInt(url.match(/\/tickets\/(\d+)\/close/)?.[1] || 1)
        const ticket = mockTickets.find(t => t.id === id)
        if (ticket) {
          ticket.status = 'closed'
          ticket.visitResult = data.visitResult
          ticket.satisfaction = data.satisfaction
          ticket.visitRemark = data.remark
          ticket.closer = '当前用户'
          ticket.closeTime = getNowTime()
          addTrack(id, 'close', '工单关闭', '当前用户', data.remark || '')
        }
        result.data = { success: true }
      } else if (url.includes('/sign') && method === 'post') {
        const id = parseInt(url.match(/\/tickets\/(\d+)\/sign/)?.[1] || 1)
        const ticket = mockTickets.find(t => t.id === id)
        if (ticket) {
          ticket.status = 'processing'
          ticket.signer = '当前用户'
          ticket.signTime = getNowTime()
          if (!ticket.handler) {
            ticket.handler = '当前用户'
          }
          addTrack(id, 'sign', '工单签收', '当前用户', '')
        }
        result.data = { success: true }
      } else if (url.includes('/tickets/handover') && method === 'post') {
        result.data = { success: true }
      } else if (url.includes('/users')) {
        const role = params?.role
        let users = mockUsers
        if (role) {
          users = users.filter(u => u.role === role)
        }
        result.data = users
      }

      resolve(result)
    }, 300)
  })
}

export function isMockMode() {
  return true
}

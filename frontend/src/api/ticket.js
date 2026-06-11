import request from './request'

export function getTicketList(params) {
  return request({
    url: '/tickets',
    method: 'get',
    params
  })
}

export function getTicketDetail(id) {
  return request({
    url: `/tickets/${id}`,
    method: 'get'
  })
}

export function getStatistics() {
  return request({
    url: '/statistics',
    method: 'get'
  })
}

export function createTicket(data) {
  return request({
    url: '/tickets',
    method: 'post',
    data
  })
}

export function updateTicketStatus(id, data) {
  return request({
    url: `/tickets/${id}/status`,
    method: 'put',
    data
  })
}

export function submitHandover(data) {
  return request({
    url: '/handover',
    method: 'post',
    data
  })
}

export function acceptHandover(id) {
  return request({
    url: `/handover/${id}/accept`,
    method: 'post'
  })
}

export function rejectHandover(id, data) {
  return request({
    url: `/handover/${id}/reject`,
    method: 'post',
    data
  })
}

export function getMyHandover(params) {
  return request({
    url: '/handover/my',
    method: 'get',
    params
  })
}

export function getOperationLogs(params) {
  return request({
    url: '/logs',
    method: 'get',
    params
  })
}

export function getQaManagers() {
  return request({
    url: '/users/qa-managers',
    method: 'get'
  })
}

export function getCsManagers() {
  return request({
    url: '/users/cs-managers',
    method: 'get'
  })
}

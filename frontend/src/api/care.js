import api from './index'

export function getCareRecords(params) {
  return api.get('/care-records', { params })
}

export function getCareRecord(id) {
  return api.get(`/care-records/${id}`)
}

export function createCareRecord(data) {
  return api.post('/care-records', data)
}

export function updateCareRecord(id, data) {
  return api.put(`/care-records/${id}`, data)
}

export function updateCareRecordStatus(id, data) {
  return api.put(`/care-records/${id}/status`, data)
}

export function getMedications(careRecordId) {
  return api.get(`/medications/${careRecordId}`)
}

export function addMedication(careRecordId, data) {
  return api.post(`/medications/${careRecordId}`, data)
}

export function updateMedication(id, data) {
  return api.put(`/medications/${id}`, data)
}

export function getDischarges(careRecordId) {
  return api.get(`/discharge/${careRecordId}`)
}

export function createDischarge(careRecordId, data) {
  return api.post(`/discharge/${careRecordId}`, data)
}

export function confirmDischarge(id, data) {
  return api.put(`/discharge/${id}/confirm`, data)
}

export function getAttachments(careRecordId) {
  return api.get(`/attachments/${careRecordId}`)
}

export function uploadAttachment(careRecordId, formData) {
  return api.post(`/attachments/${careRecordId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function reviewAttachment(id, data) {
  return api.put(`/attachments/${id}/review`, data)
}

export function supplementAttachment(id, data) {
  return api.put(`/attachments/${id}/supplement`, data)
}

export function getAuditLogs(careRecordId) {
  return api.get(`/audit/care-record/${careRecordId}`)
}

export function searchAuditLogs(params) {
  return api.get('/audit', { params })
}

export function getUsers() {
  return api.get('/users')
}

export function login(username) {
  return api.post('/users/login', { username })
}

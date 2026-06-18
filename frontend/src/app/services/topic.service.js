var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@angular/core';
let TopicService = class TopicService {
    constructor(http, auth) {
        this.http = http;
        this.auth = auth;
    }
    opts() {
        return { headers: this.auth.getAuthHeaders() };
    }
    listTopics(params) {
        let query = '';
        if (params) {
            const parts = [];
            if (params.status)
                parts.push(`status=${encodeURIComponent(params.status)}`);
            if (params.anomaly)
                parts.push(`anomaly=${encodeURIComponent(params.anomaly)}`);
            if (params.keyword)
                parts.push(`keyword=${encodeURIComponent(params.keyword)}`);
            if (parts.length)
                query = '?' + parts.join('&');
        }
        return this.http.get('/api/topics' + query, this.opts());
    }
    getTopic(id) {
        return this.http.get(`/api/topics/${id}`, this.opts());
    }
    createTopic(data) {
        return this.http.post('/api/topics', data, this.opts());
    }
    reviewTopic(id, data) {
        return this.http.post(`/api/topics/${id}/review`, data, this.opts());
    }
    archiveTopic(id, data) {
        return this.http.post(`/api/topics/${id}/archive`, data, this.opts());
    }
    rectifyTopic(id, data) {
        return this.http.post(`/api/topics/${id}/rectify`, data, this.opts());
    }
    listAttachments(topicId) {
        return this.http.get(`/api/topics/${topicId}/attachments`, this.opts());
    }
    addAttachment(topicId, data) {
        return this.http.post(`/api/topics/${topicId}/attachments`, data, this.opts());
    }
    listBatches() {
        return this.http.get('/api/import/batches', this.opts());
    }
    batchRecords(id) {
        return this.http.get(`/api/import/batches/${id}/records`, this.opts());
    }
    executeImport(data) {
        return this.http.post('/api/import/execute', data, this.opts());
    }
    listAudit(topicId) {
        const q = topicId ? `?topic_id=${encodeURIComponent(topicId)}` : '';
        return this.http.get(`/api/audit/logs` + q, this.opts());
    }
};
TopicService = __decorate([
    Injectable({ providedIn: 'root' })
], TopicService);
export { TopicService };
//# sourceMappingURL=topic.service.js.map
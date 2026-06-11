import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export const API_BASE = '';

function rp<T>(o: any): Promise<T> {
  return firstValueFrom(o) as Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  async login(username: string, password: string) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/auth/login`, { username, password }));
    return res;
  }
  async me() {
    const res: any = await rp(this.http.get(`${API_BASE}/api/auth/me`));
    return res;
  }
  async constants() {
    const res: any = await rp(this.http.get(`${API_BASE}/api/constants`));
    return res.data;
  }
  async users() {
    const res: any = await rp(this.http.get(`${API_BASE}/api/users`));
    return res.data;
  }

  async queue(params: any = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]: any) => { if (v !== undefined && v !== '' && v !== null) p = p.set(k, v); });
    const res: any = await rp(this.http.get(`${API_BASE}/api/plans/queue`, { params: p }));
    return res.data;
  }
  async stats() {
    const res: any = await rp(this.http.get(`${API_BASE}/api/plans/stats`));
    return res.data;
  }
  async planDetail(id: number) {
    const res: any = await rp(this.http.get(`${API_BASE}/api/plans/${id}`));
    return res.data;
  }
  async createPlan(data: any) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/plans`, data));
    return res;
  }
  async editPlan(id: number, data: any) {
    const res: any = await rp(this.http.patch(`${API_BASE}/api/plans/${id}`, data));
    return res;
  }
  async planAction(id: number, data: any) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/plans/${id}/action`, data));
    return res;
  }
  async uploadEvidence(id: number, data: any) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/plans/${id}/evidence`, data));
    return res;
  }
  async planAudit(id: number) {
    const res: any = await rp(this.http.get(`${API_BASE}/api/plans/${id}/audit`));
    return res.data;
  }

  async batchAction(data: any) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/batch/action`, data));
    return res;
  }
  async batchRetry(batchId: number, data: any = {}) {
    const res: any = await rp(this.http.post(`${API_BASE}/api/batch/${batchId}/retry`, data));
    return res;
  }
  async batches(params: any = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]: any) => { if (v !== undefined && v !== '' && v !== null) p = p.set(k, v); });
    const res: any = await rp(this.http.get(`${API_BASE}/api/batches`, { params: p }));
    return res.data;
  }
  async batchDetail(batchId: number) {
    const res: any = await rp(this.http.get(`${API_BASE}/api/batches/${batchId}`));
    return res.data;
  }
  async auditLogs(params: any = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]: any) => { if (v !== undefined && v !== '' && v !== null) p = p.set(k, v); });
    const res: any = await rp(this.http.get(`${API_BASE}/api/audit-logs`, { params: p }));
    return res.data;
  }
}

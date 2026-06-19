import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { ReleaseApplication } from '../../models/release.model';

@Component({
  selector: 'app-release-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn-default" routerLink="/releases">← 返回列表</button>
        <h1 class="page-title">{{ isEdit ? '编辑发布申请' : '新建发布申请' }}</h1>
      </div>
    </div>

    <div class="card" style="max-width: 800px;">
      <div *ngIf="loading" class="loading">加载中...</div>

      <form *ngIf="!loading" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label class="form-label">申请标题 *</label>
          <input type="text" class="form-input" [(ngModel)]="formData.title" name="title" placeholder="请输入申请标题" required>
        </div>

        <div style="display: flex; gap: 16px;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">项目名称 *</label>
            <input type="text" class="form-input" [(ngModel)]="formData.project_name" name="project_name" placeholder="请输入项目名称" required>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">版本号 *</label>
            <input type="text" class="form-input" [(ngModel)]="formData.version" name="version" placeholder="如：v1.0.0" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">影响范围</label>
          <input type="text" class="form-input" [(ngModel)]="formData.impact_scope" name="impact_scope" placeholder="请输入影响范围">
        </div>

        <div class="form-group">
          <label class="form-label">计划发布时间</label>
          <input type="datetime-local" class="form-input" [(ngModel)]="formData.planned_release_time" name="planned_release_time">
        </div>

        <div class="form-group">
          <label class="form-label">申请描述</label>
          <textarea class="form-textarea" [(ngModel)]="formData.description" name="description" placeholder="请输入申请描述"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">发布内容</label>
          <textarea class="form-textarea" [(ngModel)]="formData.release_content" name="release_content" placeholder="请输入详细的发布内容" style="min-height: 150px;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
          <button type="button" class="btn-default" routerLink="/releases">取消</button>
          <button type="button" class="btn-default" (click)="saveDraft()">保存草稿</button>
          <button type="submit" class="btn-primary">{{ isEdit ? '保存修改' : '提交审核' }}</button>
        </div>
      </form>
    </div>
  `
})
export class ReleaseFormComponent implements OnInit {
  isEdit = false;
  id: number = 0;
  loading = true;
  formData: any = {
    title: '',
    project_name: '',
    version: '',
    description: '',
    release_content: '',
    impact_scope: '',
    planned_release_time: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    if (idParam) {
      this.isEdit = true;
      this.id = Number(idParam);
      this.loadData();
    } else {
      this.loading = false;
    }
  }

  loadData(): void {
    this.loading = true;
    this.apiService.getReleaseApplication(this.id).subscribe({
      next: (data) => {
        this.formData = {
          title: data.title,
          project_name: data.project_name,
          version: data.version,
          description: data.description || '',
          release_content: data.release_content || '',
          impact_scope: data.impact_scope || '',
          planned_release_time: data.planned_release_time ? data.planned_release_time.slice(0, 16) : ''
        };
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '加载失败');
      }
    });
  }

  onSubmit(): void {
    if (!this.formData.title || !this.formData.project_name || !this.formData.version) {
      this.toastService.warning('请填写必填项');
      return;
    }

    const submitData = this.prepareData();

    if (this.isEdit) {
      this.apiService.updateReleaseApplication(this.id, submitData).subscribe({
        next: () => {
          this.toastService.success('保存成功');
          this.router.navigate(['/releases', this.id]);
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '保存失败');
        }
      });
    } else {
      this.apiService.createReleaseApplication(submitData).subscribe({
        next: (data: ReleaseApplication) => {
          this.toastService.success('创建成功，正在提交审核...');
          this.apiService.submitForReview(data.id).subscribe({
            next: () => {
              this.toastService.success('已提交审核');
              this.router.navigate(['/releases', data.id]);
            },
            error: () => {
              this.router.navigate(['/releases', data.id]);
            }
          });
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '创建失败');
        }
      });
    }
  }

  saveDraft(): void {
    if (!this.formData.title) {
      this.toastService.warning('请至少填写标题');
      return;
    }

    const submitData = this.prepareData();

    if (this.isEdit) {
      this.apiService.updateReleaseApplication(this.id, submitData).subscribe({
        next: () => {
          this.toastService.success('草稿已保存');
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '保存失败');
        }
      });
    } else {
      this.apiService.createReleaseApplication(submitData).subscribe({
        next: (data: ReleaseApplication) => {
          this.toastService.success('草稿已保存');
          this.router.navigate(['/releases', data.id]);
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '创建失败');
        }
      });
    }
  }

  prepareData(): any {
    const data: any = { ...this.formData };
    if (data.planned_release_time) {
      data.planned_release_time = new Date(data.planned_release_time).toISOString();
    } else {
      data.planned_release_time = null;
    }
    return data;
  }
}

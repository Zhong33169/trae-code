import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckinService } from '../../services/checkin.service';
import { AuthService } from '../../services/auth.service';
import { ConsistencyIssue } from '../../models';

@Component({
  selector: 'app-create',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <button routerLink="/" class="btn-back">← 返回列表</button>
          <h2 style="margin-top: 12px;">登记值机记录</h2>
        </div>
      </div>

      <div *ngIf="!auth.hasRole(['initiator', 'admin'])" class="alert-danger">
        ⚠️ 当前角色无权登记新记录，请使用发起岗（initiator1）或管理员账号登录。
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-card" *ngIf="auth.hasRole(['initiator', 'admin'])">
        <div class="form-section">
          <h3 class="section-title">📝 基本信息</h3>
          <div class="grid">
            <div class="form-group">
              <label>批次号 <span class="required">*</span></label>
              <input type="text" formControlName="batch_no" placeholder="如 BATCH20250101001" />
              <span class="error" *ngIf="form.get('batch_no')?.touched && form.get('batch_no')?.hasError('required')">必填</span>
            </div>
            <div class="form-group">
              <label>航班号 <span class="required">*</span></label>
              <input type="text" formControlName="flight_no" placeholder="如 CA1234" />
              <span class="error" *ngIf="form.get('flight_no')?.touched && form.get('flight_no')?.hasError('required')">必填</span>
            </div>
            <div class="form-group">
              <label>航班日期 <span class="required">*</span></label>
              <input type="date" formControlName="flight_date" />
              <span class="error" *ngIf="form.get('flight_date')?.touched && form.get('flight_date')?.hasError('required')">必填</span>
            </div>
            <div class="form-group">
              <label>值机时间</label>
              <input type="datetime-local" formControlName="checkin_time" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">👤 旅客信息</h3>
          <div class="grid">
            <div class="form-group">
              <label>旅客姓名 <span class="required">*</span></label>
              <input type="text" formControlName="passenger_name" placeholder="姓名" />
              <span class="error" *ngIf="form.get('passenger_name')?.touched && form.get('passenger_name')?.hasError('required')">必填</span>
            </div>
            <div class="form-group">
              <label>身份证号 <span class="required">*</span></label>
              <input type="text" formControlName="id_card_no" placeholder="18位身份证号" />
              <span class="error" *ngIf="form.get('id_card_no')?.touched && form.get('id_card_no')?.hasError('required')">必填</span>
              <span class="error" *ngIf="form.get('id_card_no')?.touched && form.get('id_card_no')?.hasError('pattern')">身份证号格式不正确</span>
            </div>
            <div class="form-group">
              <label>座位号</label>
              <input type="text" formControlName="seat_no" placeholder="如 12A" />
            </div>
            <div class="form-group">
              <label>登机口</label>
              <input type="text" formControlName="boarding_gate" placeholder="如 A01" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">✅ 材料核验</h3>
          <div class="grid">
            <div class="form-group">
              <label>材料完整性</label>
              <select formControlName="material_complete">
                <option [ngValue]="1">材料完整</option>
                <option [ngValue]="0">材料缺失</option>
              </select>
            </div>
            <div class="form-group">
              <label>是否超时</label>
              <select formControlName="is_overtime">
                <option [ngValue]="0">正常</option>
                <option [ngValue]="1">超时</option>
              </select>
            </div>
            <div class="form-group col-span-2">
              <label>异常说明（可选）</label>
              <input type="text" formControlName="abnormal_reason" placeholder="如有异常请说明" />
            </div>
          </div>
        </div>

        <div *ngIf="submitIssues.length > 0" class="alert-warning">
          <h4>⚠️ 检测到数据一致性问题（记录已创建但标记为异常）：</h4>
          <ul>
            <li *ngFor="let iss of submitIssues">{{ iss.message }}</li>
          </ul>
          <button type="button" class="btn-secondary" style="margin-top: 10px;" (click)="router.navigate(['/'])">返回列表</button>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-ghost" (click)="form.reset()">重置</button>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || submitting">
            {{ submitting ? '提交中...' : '提交登记' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .page-header h2 { font-size: 20px; color: #1e293b; }
    .btn-back { background: transparent; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; padding: 4px 0; }
    .btn-back:hover { text-decoration: underline; }
    .btn-primary { background: #3b82f6; color: white; padding: 10px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
    .btn-primary:hover:not(:disabled) { background: #2563eb; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: white; color: #334155; padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-ghost { background: transparent; color: #64748b; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-ghost:hover { background: #f1f5f9; }
    .alert-danger { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; color: #991b1b; }
    .alert-warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; color: #92400e; margin-top: 16px; }
    .alert-warning h4 { margin: 0 0 6px; }
    .alert-warning ul { margin: 0; padding-left: 20px; }
    .alert-warning li { font-size: 13px; line-height: 1.6; }
    .form-card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .form-section { margin-bottom: 24px; }
    .section-title { margin: 0 0 14px; font-size: 15px; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group.col-span-2 { grid-column: span 2; }
    .form-group label { font-size: 13px; color: #475569; font-weight: 500; }
    .form-group .required { color: #dc2626; }
    .form-group input, .form-group select {
      padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 14px;
      transition: all 0.2s;
    }
    .form-group input:focus, .form-group select:focus {
      outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
    }
    .form-group input.ng-invalid.ng-touched, .form-group select.ng-invalid.ng-touched {
      border-color: #dc2626;
    }
    .error { color: #dc2626; font-size: 12px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    `,
  ],
})
export class CreateComponent {
  form: FormGroup;
  submitting = false;
  submitIssues: ConsistencyIssue[] = [];

  constructor(
    public router: Router,
    private fb: FormBuilder,
    private service: CheckinService,
    public auth: AuthService
  ) {
    this.form = this.fb.group({
      batch_no: ['', Validators.required],
      flight_no: ['', Validators.required],
      flight_date: ['', Validators.required],
      checkin_time: [''],
      passenger_name: ['', Validators.required],
      id_card_no: ['', [Validators.required, Validators.pattern(/^\d{17}[\dXx]$/)]],
      seat_no: [''],
      boarding_gate: [''],
      material_complete: [1],
      is_overtime: [0],
      abnormal_reason: [''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.submitIssues = [];

    const value = { ...this.form.value };
    if (value.checkin_time) {
      value.checkin_time = value.checkin_time.replace('T', ' ') + ':00';
    }

    this.service.create(value).subscribe({
      next: res => {
        if (res.consistency_issues?.length) {
          this.submitIssues = res.consistency_issues;
        } else {
          alert('登记成功');
          this.router.navigate(['/orders', res.id]);
        }
        this.submitting = false;
      },
      error: err => {
        const msg = err.error?.error || '提交失败';
        if (err.error?.details) {
          alert(msg + '\n\n' + err.error.details.map((d: any) => d.field + ': ' + d.message).join('\n'));
        } else {
          alert(msg);
        }
        this.submitting = false;
      },
    });
  }
}

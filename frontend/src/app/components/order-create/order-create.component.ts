import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { APPOINTMENT_TYPES, EVIDENCE_OPTIONS } from '../../models';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-order-create',
  templateUrl: './order-create.component.html',
  styleUrls: ['./order-create.component.css'],
})
export class OrderCreateComponent {
  form: FormGroup;
  submitting = false;
  readonly APPOINTMENT_TYPES = APPOINTMENT_TYPES;
  readonly EVIDENCE_OPTIONS = EVIDENCE_OPTIONS;
  selectedEvidence: string[] = [];

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService,
    private router: Router
  ) {
    this.form = this.fb.group({
      customer_name: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      vehicle_plate: ['', [Validators.required]],
      vehicle_model: ['', [Validators.required]],
      mileage: [0, [Validators.min(0)]],
      appointment_type: ['', [Validators.required]],
      problem_description: ['', [Validators.required]],
      assigned_technician: [''],
      repair_items: [''],
      estimated_cost: [0, [Validators.min(0)]],
      deadline: [''],
      evidence_submitted: [false],
    });
  }

  toggleEvidence(item: string): void {
    const idx = this.selectedEvidence.indexOf(item);
    if (idx >= 0) {
      this.selectedEvidence.splice(idx, 1);
    } else {
      this.selectedEvidence.push(item);
    }
    if (this.selectedEvidence.length > 0 && !this.form.get('evidence_submitted')?.value) {
      this.form.patchValue({ evidence_submitted: true });
    } else if (this.selectedEvidence.length === 0 && this.form.get('evidence_submitted')?.value) {
      this.form.patchValue({ evidence_submitted: false });
    }
  }

  hasEvidence(item: string): boolean {
    return this.selectedEvidence.includes(item);
  }

  private buildPayload(): any {
    const val = this.form.value;
    const payload: any = {
      customer_name: val.customer_name,
      phone: val.phone,
      vehicle_plate: val.vehicle_plate,
      vehicle_model: val.vehicle_model,
      mileage: val.mileage,
      appointment_type: val.appointment_type,
      problem_description: val.problem_description,
      repair_items: val.repair_items || undefined,
      estimated_cost: val.estimated_cost || undefined,
      evidence_submitted: !!val.evidence_submitted || this.selectedEvidence.length > 0,
    };
    if (val.assigned_technician) {
      payload.assigned_technician = val.assigned_technician;
    }
    if (val.deadline) {
      payload.deadline = val.deadline;
    }
    payload.evidence_list = JSON.stringify(this.selectedEvidence);
    return payload;
  }

  submit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((key) =>
        this.form.get(key)?.markAsTouched()
      );
      return;
    }
    this.submitting = true;
    this.orderService.createOrder(this.buildPayload()).subscribe({
      next: (o) => {
        this.submitting = false;
        this.router.navigate(['/orders', o.id]);
      },
      error: (e) => {
        this.submitting = false;
        alert('创建失败：' + (e?.error?.message || e?.message || '请稍后再试'));
      },
    });
  }

  saveDraftAndSubmit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((key) =>
        this.form.get(key)?.markAsTouched()
      );
      return;
    }
    this.submitting = true;
    this.orderService.createOrder(this.buildPayload()).subscribe({
      next: (o) => {
        const version = o.version ?? 0;
        this.orderService.submitOrder(o.id, { version }).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/orders', o.id]);
          },
          error: () => {
            this.submitting = false;
            this.router.navigate(['/orders', o.id]);
          },
        });
      },
      error: (e) => {
        this.submitting = false;
        alert('创建失败：' + (e?.error?.message || e?.message || '请稍后再试'));
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/orders']);
  }
}

import { Component, Input } from '@angular/core';
import { TaskStatus, STATUS_LABELS } from '../core/models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="pill st-{{status}}"><span class="dot"></span>{{ label }}</span>`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: TaskStatus;
  get label(): string { return STATUS_LABELS[this.status] ?? this.status; }
}

import { Component, Input } from '@angular/core';
import { Evidence } from '../core/models';

@Component({
  selector: 'app-evidence-card',
  standalone: true,
  template: `
    @if (evi) {
      <div class="evi-card ok">
        <div class="evi-head">
          <span class="t">{{ title }}</span>
          <span class="lamp ok"><span class="b"></span>已记录</span>
        </div>
        <div class="evi-body">{{ evi.content }}</div>
        <div class="evi-meta">{{ evi.operator }} · {{ evi.ts }}</div>
      </div>
    } @else {
      <div class="evi-card miss">
        <div class="evi-head">
          <span class="t">{{ title }}</span>
          <span class="lamp miss"><span class="b"></span>未提交</span>
        </div>
        <div class="evi-body muted">{{ hint }}</div>
      </div>
    }
  `,
})
export class EvidenceCardComponent {
  @Input({ required: true }) title!: string;
  @Input() evi: Evidence | null = null;
  @Input() hint = '该环节尚未补充证据。';
}

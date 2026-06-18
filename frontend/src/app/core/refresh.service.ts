import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly _dirty = signal(0);
  readonly generation = this._dirty.asReadonly();

  markDirty(): void {
    this._dirty.update(v => (v + 1) & 0xffff);
  }
}

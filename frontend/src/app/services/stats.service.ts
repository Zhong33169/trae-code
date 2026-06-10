import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OverviewStats } from '../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/stats`;

  constructor(private http: HttpClient) {}

  getOverview(): Observable<OverviewStats> {
    return this.http.get<OverviewStats>(`${this.baseUrl}/overview`);
  }
}

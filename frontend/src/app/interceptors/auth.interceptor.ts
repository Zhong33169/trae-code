import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    let clone = req.clone({
      headers: req.headers.set('Content-Type', 'application/json')
    });
    if (token) {
      clone = clone.clone({ headers: clone.headers.set('Authorization', `Bearer ${token}`) });
    }
    return next.handle(clone).pipe(
      catchError(err => {
        if (err.status === 401 && !req.url.includes('/api/auth/login')) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}

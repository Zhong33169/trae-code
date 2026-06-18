var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, signal, computed } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { tap } from 'rxjs';
let AuthService = class AuthService {
    constructor(http, router) {
        this.http = http;
        this.router = router;
        this._token = signal(localStorage.getItem('token'));
        this._user = signal(localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);
        this.token = this._token.asReadonly();
        this.currentUser = this._user.asReadonly();
        this.isLoggedIn = computed(() => !!this._token());
    }
    getAuthHeaders() {
        return this._token()
            ? new HttpHeaders({ Authorization: this._token() })
            : new HttpHeaders();
    }
    login(username, password) {
        return this.http
            .post('/api/auth/login', { username, password })
            .pipe(tap((res) => {
            if (res.code === 0 && res.data) {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                this._token.set(res.data.token);
                this._user.set(res.data.user);
            }
        }));
    }
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this._token.set(null);
        this._user.set(null);
    }
    hasRole(roles) {
        return !!this._user() && roles.includes(this._user().role);
    }
};
AuthService = __decorate([
    Injectable({ providedIn: 'root' })
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map
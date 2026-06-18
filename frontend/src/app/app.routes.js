import { LoginComponent } from './pages/login/login.component';
import { TopicListComponent } from './pages/topic-list/topic-list.component';
import { TopicDetailComponent } from './pages/topic-detail/topic-detail.component';
import { ImportPageComponent } from './pages/import-page/import-page.component';
import { AuditPageComponent } from './pages/audit-page/audit-page.component';
import { authGuard } from './guards/auth.guard';
export const routes = [
    { path: 'login', component: LoginComponent },
    { path: '', redirectTo: 'topics', pathMatch: 'full' },
    { path: 'topics', component: TopicListComponent, canActivate: [authGuard] },
    { path: 'topics/:id', component: TopicDetailComponent, canActivate: [authGuard] },
    { path: 'import', component: ImportPageComponent, canActivate: [authGuard] },
    { path: 'audit', component: AuditPageComponent, canActivate: [authGuard] },
];
//# sourceMappingURL=app.routes.js.map
import { importProvidersFrom } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { routes } from './app.routes';
export const appConfig = {
    providers: [
        provideRouter(routes, withHashLocation()),
        importProvidersFrom(HttpClientModule, FormsModule),
    ],
};
//# sourceMappingURL=app.config.js.map
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { RepriceStore } from './core/services/reprice.store';
import { RepriceThemeService } from './core/services/reprice-theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const store = inject(RepriceStore);
      inject(RepriceThemeService);
      return store.load().catch(() => undefined);
    })
  ]
};

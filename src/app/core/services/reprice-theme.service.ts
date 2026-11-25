import { DestroyRef, DOCUMENT, effect, inject, Injectable, PLATFORM_ID } from "@angular/core";
import { RepriceSettingsService } from "./reprice-settings.service";
import { isPlatformBrowser } from "@angular/common";
import { RepriceTheme } from "../models/reprice-settings.model";

@Injectable({
    providedIn: 'root'
})
export class RepriceThemeService {
    private readonly document = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly destroyRef = inject(DestroyRef);
    private readonly settingsSvc = inject(RepriceSettingsService);

    private mediaQuery: MediaQueryList | null = null;

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.mediaQuery = window.matchMedia('prefers-color-scheme:dark');

            this.mediaQuery.addEventListener(
                'change',
                this.onSystemThemeChange
            )

            this.destroyRef.onDestroy(() => {
                this.mediaQuery?.removeEventListener(
                    'change',
                    this.onSystemThemeChange
                )
            })
        }

        effect(() => {
            this.applyTheme(this.settingsSvc.theme());
        })
    }

    private readonly onSystemThemeChange = (): void => {
        if (this.settingsSvc.theme() === 'system') this.applyTheme('system');
    }

    private applyTheme(theme: RepriceTheme) {
        const resolvedTheme = theme === 'system'
            ? this.mediaQuery?.matches ? 'dark' : 'light' : theme;

        const root = this.document.documentElement;

        root.setAttribute('data-theme', resolvedTheme);
        root.style.colorScheme = resolvedTheme;
    }
}
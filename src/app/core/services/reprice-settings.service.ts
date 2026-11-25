import { computed, Injectable, signal } from "@angular/core";
import { DEFAULT_REPRICE_SETTINGS, RepriceSettings } from "../models/reprice-settings.model";

const SETTINGS_STORAGE_KEY = 'reprice-settings';

@Injectable({
    providedIn: 'root'
})
export class RepriceSettingsService {
    private readonly _settings = signal<RepriceSettings>(this.loadSettings());

    readonly settings = this._settings.asReadonly();

    readonly theme = computed(() => this.settings().theme);
    readonly dateFormat = computed(() => this.settings().dateFormat);
    readonly confirmBeforeDelete = computed(() => this.settings().confirmBeforeDelete);

    updateSettings(update: Partial<RepriceSettings>) {
        this._settings.update(settings => ({
            ...settings,
            ...update
        }))

        this.saveSettings();
    }

    resetSettings() {
        this._settings.set({ ...DEFAULT_REPRICE_SETTINGS });
        this.saveSettings();
    }

    private loadSettings(): RepriceSettings {
        try {
            const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!rawSettings) return { ...DEFAULT_REPRICE_SETTINGS };

            const parsed: unknown = JSON.parse(rawSettings);

            return this.validateSettings(parsed);
        } catch {
            return { ...DEFAULT_REPRICE_SETTINGS };
        }
    }

    private saveSettings() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings()));
        } catch (error) {
            console.error('Failed to save Reprice settings: ', error);
        }
    }

    private validateSettings(value: unknown): RepriceSettings {
        if (!value || typeof value !== 'object') return { ...DEFAULT_REPRICE_SETTINGS };

        const settings = value as Partial<RepriceSettings>;

        return {
            theme: this.isTheme(settings.theme)
                ? settings.theme : DEFAULT_REPRICE_SETTINGS.theme,
            dateFormat: this.isDateFormat(settings.dateFormat)
                ? settings.dateFormat : DEFAULT_REPRICE_SETTINGS.dateFormat,
            confirmBeforeDelete: typeof settings.confirmBeforeDelete === 'boolean'
                ? settings.confirmBeforeDelete : DEFAULT_REPRICE_SETTINGS.confirmBeforeDelete
        }
    }

    private isTheme(value: unknown): value is RepriceSettings['theme'] {
        return value === 'system' || value === 'light' || value === 'dark';
    }

    private isDateFormat(value: unknown): value is RepriceSettings['dateFormat'] {
        return value === 'dd.MM.yyyy' || value === 'yyyy-MM-dd';
    }
}
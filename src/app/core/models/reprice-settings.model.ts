export type RepriceTheme = 'system' | 'light' | 'dark';

export type RepriceDateFormat = 'dd.MM.yyyy' | 'yyyy-MM-dd';

export interface RepriceSettings {
    theme: RepriceTheme;
    dateFormat: RepriceDateFormat;
    confirmBeforeDelete: boolean;
}

export const DEFAULT_REPRICE_SETTINGS: RepriceSettings = {
    theme: 'system',
    dateFormat: 'dd.MM.yyyy',
    confirmBeforeDelete: true
}
import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        title: 'RePrice',
        loadComponent: () => import('./features/home/home')
            .then(m => m.Home)
    },
    {
        path: 'documents/new',
        title: 'Новая переоценка',
        loadComponent: () => import('./features/document-editor/document-editor')
            .then(m => m.DocumentEditor)
    },
    {
        path: 'documents/:id',
        title: 'Переоценка',
        loadComponent: () => import('./features/document-editor/document-editor')
            .then(m => m.DocumentEditor)
    },
    {
        path: 'settings',
        title: 'Настройки',
        loadComponent: () => import('./features/settings/settings')
            .then(m => m.Settings)
    },
    {
        path: '**',
        redirectTo: ''
    }
];

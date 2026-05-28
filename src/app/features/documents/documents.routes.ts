import { Routes } from '@angular/router';

export const documentsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'list',
  },
  {
    path: 'list',
    loadComponent: () =>
      import('./pages/documents-page.component').then(
        (module) => module.DocumentsPageComponent,
      ),
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./pages/documents-upload-page.component').then(
        (module) => module.DocumentsUploadPageComponent,
      ),
  },
  {
    path: 'manual',
    loadComponent: () =>
      import('./pages/documents-manual-page.component').then(
        (module) => module.DocumentsManualPageComponent,
      ),
  },
  {
    path: 'submitted/:id',
    loadComponent: () =>
      import('./pages/documents-submitted-detail-page.component').then(
        (module) => module.DocumentsSubmittedDetailPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/documents-draft-detail-page.component').then(
        (module) => module.DocumentsDraftDetailPageComponent,
      ),
  },
];

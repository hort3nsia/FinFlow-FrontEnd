import { Routes } from '@angular/router';
import { DocumentDetailPageComponent } from './pages/document-detail-page/document-detail-page.component';
import { DocumentManualEntryPageComponent } from './pages/document-manual-entry-page/document-manual-entry-page.component';
import { DocumentUploadPageComponent } from './pages/document-upload-page/document-upload-page.component';
import { DocumentsListPageComponent } from './pages/documents-list-page/documents-list-page.component';

export const documentsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'list',
  },
  {
    path: 'list',
    component: DocumentsListPageComponent,
  },
  {
    path: 'upload',
    component: DocumentUploadPageComponent,
  },
  {
    path: 'manual',
    component: DocumentManualEntryPageComponent,
  },
  {
    path: ':id',
    component: DocumentDetailPageComponent,
  },
];

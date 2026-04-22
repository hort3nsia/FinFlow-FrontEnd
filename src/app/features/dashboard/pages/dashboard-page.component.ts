import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrentWorkspaceFacade } from '../data/current-workspace.facade';

interface DashboardKpi {
  testId: string;
  label: string;
  value: string;
  icon: 'documents' | 'approvals' | 'expenses' | 'ocr';
  accent?: string;
  tone?: 'default' | 'critical';
}

interface DashboardActivityItem {
  title: string;
  detail: string;
  meta: string;
  statusLabel?: string;
  statusTone?: 'default' | 'success';
  cta?: string;
  iconTone?: 'document' | 'success' | 'alert' | 'entry';
}

interface DashboardExpenseSummaryItem {
  vendor: string;
  date: string;
  amount: string;
  status: string;
  statusTone: 'success' | 'pending';
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);

  protected readonly state = this.currentWorkspaceFacade.state;
  protected readonly overviewCopy = 'Operational task management and document processing';
  protected readonly statusItems = [
    'Workspace Status: Healthy',
    'AI Assistant: Active',
    'OCR Engine: Healthy',
    'Integrations: Synced',
  ];
  protected readonly kpis: DashboardKpi[] = [
    {
      testId: 'kpi-documents',
      label: 'Documents Pending Review',
      value: '42',
      icon: 'documents',
    },
    {
      testId: 'kpi-approvals',
      label: 'Approvals Waiting',
      value: '12',
      icon: 'approvals',
    },
    {
      testId: 'kpi-expenses',
      label: 'Flagged Expenses',
      value: '3',
      accent: 'Urgent',
      tone: 'critical',
      icon: 'expenses',
    },
    {
      testId: 'kpi-ocr',
      label: 'OCR Extraction Accuracy',
      value: '98.4%',
      accent: '+1.2%',
      icon: 'ocr',
    },
  ];
  protected readonly activityItems: DashboardActivityItem[] = [
    {
      title: 'New document intake: INV-2024-001',
      detail: 'Vendor: Global Cloud Services • Amount: $1,240.00',
      meta: '12m ago',
      statusLabel: 'OCR COMPLETE',
      statusTone: 'default',
      cta: 'PENDING REVIEW',
      iconTone: 'document',
    },
    {
      title: 'Expense Approved',
      detail: 'Sarah Jenkins approved travel expense for NYC Summit.',
      meta: '45m ago',
      cta: 'View Transaction #TXN-9981',
      iconTone: 'success',
    },
    {
      title: 'Duplicate Flag Detected',
      detail: 'Potential duplicate for INV-8829 detected by AI Assistant.',
      meta: '2h ago',
      cta: 'REVIEW MATCH',
      iconTone: 'alert',
    },
    {
      title: 'New expense submitted',
      detail: 'Manual entry created by Mark R. for Office Supplies.',
      meta: '4h ago',
      statusLabel: 'MANUAL',
      statusTone: 'default',
      iconTone: 'entry',
    },
  ];
  protected readonly priorityActions = [
    'Review incoming documents',
    'Process pending approvals',
    'Review flagged expenses',
    'Reconcile OCR exceptions',
  ];
  protected readonly recentExpenses: DashboardExpenseSummaryItem[] = [
    {
      vendor: 'AWS Infrastructure',
      date: 'Oct 12, 2024',
      amount: '$12,450',
      status: 'Cleared',
      statusTone: 'success',
    },
    {
      vendor: 'United Airlines',
      date: 'Oct 11, 2024',
      amount: '$840',
      status: 'Pending',
      statusTone: 'pending',
    },
    {
      vendor: 'Blue Ginger Bistro',
      date: 'Oct 10, 2024',
      amount: '$128',
      status: 'Cleared',
      statusTone: 'success',
    },
  ];

  ngOnInit(): void {
    this.currentWorkspaceFacade.refresh();
  }
}

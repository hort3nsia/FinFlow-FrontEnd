import { computed, Signal, signal, WritableSignal } from '@angular/core';

/**
 * Client-side pagination utility.
 * Creates pagination signals from a source signal of filtered items.
 *
 * Usage:
 *   const pg = createPagination(this.filteredRows, 20);
 *   // pg.paginatedItems() — items for current page
 *   // pg.currentPage — writable signal
 *   // pg.totalPages() — computed
 *   // pg.label() — "1–20 / 53"
 *   // pg.goToPage(n) — navigate
 *   // pg.resetPage() — go to page 1
 */
export interface PaginationState<T> {
  currentPage: WritableSignal<number>;
  pageSize: WritableSignal<number>;
  totalPages: Signal<number>;
  paginatedItems: Signal<T[]>;
  label: Signal<string>;
  goToPage: (page: number) => void;
  resetPage: () => void;
  hasPrevious: Signal<boolean>;
  hasNext: Signal<boolean>;
}

export function createPagination<T>(
  source: Signal<T[]>,
  defaultPageSize = 20,
): PaginationState<T> {
  const currentPage = signal(1);
  const pageSize = signal(defaultPageSize);

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(source().length / pageSize())),
  );

  const paginatedItems = computed(() => {
    const items = source();
    const page = currentPage();
    const size = pageSize();
    // Clamp page if source shrinks
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(items.length / size)));
    if (clampedPage !== page) {
      // Can't set inside computed — handled by goToPage logic
    }
    const start = (clampedPage - 1) * size;
    return items.slice(start, start + size);
  });

  const label = computed(() => {
    const total = source().length;
    if (total === 0) return '0 mục';
    const page = Math.min(currentPage(), totalPages());
    const size = pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return `${start}–${end} / ${total}`;
  });

  const hasPrevious = computed(() => currentPage() > 1);
  const hasNext = computed(() => currentPage() < totalPages());

  const goToPage = (page: number) => {
    currentPage.set(Math.max(1, Math.min(page, totalPages())));
  };

  const resetPage = () => currentPage.set(1);

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems,
    label,
    goToPage,
    resetPage,
    hasPrevious,
    hasNext,
  };
}

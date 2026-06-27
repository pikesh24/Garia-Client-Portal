"use client";

import { useEffect, useState } from "react";

export function PaginatedCardGrid<T>({
  items,
  pageSize = 6,
  renderItem,
  emptyMessage = "No items found.",
}: {
  items: T[];
  pageSize?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [items.length, totalPages, page]);

  if (items.length === 0) {
    return (
      <div className="border-4 border-border-strong border-dashed p-12 text-center bg-bg-panel-alt">
        <p className="font-data-mono uppercase tracking-widest font-bold text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  const start = page * pageSize;
  const visible = items.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {visible.map((item, i) => renderItem(item, start + i))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t-4 border-border-strong pt-6">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-data-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-2 border-border-strong disabled:opacity-40 disabled:cursor-not-allowed hover:bg-border-strong/10"
          >
            ← Prev
          </button>
          <span className="font-data-mono text-xs uppercase tracking-widest text-text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-data-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-2 border-border-strong disabled:opacity-40 disabled:cursor-not-allowed hover:bg-border-strong/10"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// DataTable (§8.2): TanStack Table 9 + TanStack Virtual, sortable headers, sticky header, row actions,
// keyboard row navigation. Sorting is owned by the caller (`sorting` + `onSortingChange`, e.g. from the
// URL) and done by the server, so the table never re-sorts rows itself (`manualSorting`).
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createColumnHelper, rowSortingFeature, tableFeatures, useTable, type ColumnDef, type OnChangeFn, type RowData, type SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { t } from '@nimbus/messages';
import { Skeleton } from './States';

export const dataTableFeatures = tableFeatures({ rowSortingFeature });
export type DataTableFeatures = typeof dataTableFeatures;
export type { SortingState };

/** `const col = dataTableColumns<Tenant>()` then `col.columns([col.accessor('name', { header: … })])`. */
export const dataTableColumns = <TData extends RowData>() => createColumnHelper<DataTableFeatures, TData>();

export interface DataTableProps<TData extends RowData> {
  /** Accessible name of the grid, e.g. "Tenants". */
  label: string;
  // reason: TanStack Table types mixed column arrays with `any` values itself (ColumnHelper.columns).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ReadonlyArray<ColumnDef<DataTableFeatures, TData, any>>;
  data: readonly TData[];
  getRowId: (row: TData) => string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Enter on a focused row, or a click on it. */
  onRowActivate?: (row: TData) => void;
  /** Rendered in a trailing "Actions" column. */
  rowActions?: (row: TData) => ReactNode;
  loading?: boolean;
  /** Shown instead of the body when there are no rows (and not loading). */
  empty?: ReactNode;
  /** Scroll viewport height; rows outside it aren't rendered. */
  height?: number;
  rowHeight?: number;
}

const EMPTY_SORTING: SortingState = [];

export function DataTable<TData extends RowData>({
  label,
  columns,
  data,
  getRowId,
  sorting = EMPTY_SORTING,
  onSortingChange,
  onRowActivate,
  rowActions,
  loading = false,
  empty,
  height = 480,
  rowHeight = 40,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row: TData) => getRowId(row),
    state: { sorting },
    onSortingChange: onSortingChange ?? (() => undefined),
    manualSorting: true,
    sortDescFirst: false, // every column sorts ascending first; a column may override (R35, Day 5)
    enableSorting: Boolean(onSortingChange),
  });
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingFocus = useRef<number | null>(null);

  // Keep the roving tab stop on a row that exists.
  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(Math.max(rows.length - 1, 0));
  }, [rows.length, activeIndex]);

  // Focus the target row once the virtualizer has rendered it.
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`tr[data-index="${pendingFocus.current}"]`);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const moveTo = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), rows.length - 1);
    pendingFocus.current = clamped;
    setActiveIndex(clamped);
    virtualizer.scrollToIndex(clamped, { align: 'auto' });
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number, original: TData) => {
    if (event.target !== event.currentTarget) return; // keys inside row actions belong to them
    const page = Math.max(Math.floor(height / rowHeight) - 1, 1);
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: rows.length - 1, PageDown: index + page, PageUp: index - page };
    const target = moves[event.key];
    if (target !== undefined) {
      event.preventDefault();
      moveTo(target);
    } else if (event.key === 'Enter' && onRowActivate) {
      event.preventDefault();
      onRowActivate(original);
    }
  };

  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0) : 0;
  const columnCount = columns.length + (rowActions ? 1 : 0);
  const showEmpty = !loading && rows.length === 0 && empty !== undefined;

  return (
    <div ref={scrollRef} className="nui-table-scroll" style={{ maxBlockSize: height }}>
      <table className="nui-table" aria-label={label} aria-rowcount={rows.length + 1} aria-busy={loading || undefined}>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} aria-rowindex={1}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const sortable = header.column.getCanSort();
                return (
                  <th key={header.id} scope="col" aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : sortable ? 'none' : undefined}>
                    {header.isPlaceholder ? null : sortable ? (
                      <button type="button" className="nui-sort" onClick={header.column.getToggleSortingHandler()}>
                        <table.FlexRender header={header} />
                        <span aria-hidden="true">{sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}</span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col">
                  <span className="nui-visually-hidden">{t('common.actions')}</span>
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columnCount}>
                <Skeleton lines={5} />
              </td>
            </tr>
          ) : showEmpty ? (
            <tr>
              <td colSpan={columnCount}>{empty}</td>
            </tr>
          ) : (
            <>
              {padTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={columnCount} style={{ blockSize: padTop, padding: 0, border: 0 }} />
                </tr>
              )}
              {items.map((item) => {
                const row = rows[item.index];
                if (!row) return null;
                return (
                  <tr
                    key={row.id}
                    data-index={item.index}
                    aria-rowindex={item.index + 2}
                    aria-selected={item.index === activeIndex}
                    tabIndex={item.index === activeIndex ? 0 : -1}
                    style={{ blockSize: rowHeight }}
                    onFocus={() => setActiveIndex(item.index)}
                    onKeyDown={(e) => onRowKeyDown(e, item.index, row.original)}
                    onClick={onRowActivate ? () => onRowActivate(row.original) : undefined}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                    {rowActions && <td>{rowActions(row.original)}</td>}
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={columnCount} style={{ blockSize: padBottom, padding: 0, border: 0 }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

import * as React from "react";

/** Cards below `md`, the caller's own `<Table>` from `md` up. */
function DataList<T>({
  rows,
  getKey,
  card,
  children,
}: {
  rows: T[];
  getKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getKey(row)} className="rounded-lg border p-4">
            {card(row)}
          </li>
        ))}
      </ul>
      <div className="hidden md:block">{children}</div>
    </>
  );
}

export { DataList };

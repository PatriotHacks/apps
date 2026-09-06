/** Header cell ids, shared so both grids name their cells the same way. */

export function gridRowHeaderId(controlId: string, rowId: string): string {
  return `${controlId}-row-${rowId}`;
}

export function gridColumnHeaderId(
  controlId: string,
  columnId: string,
): string {
  return `${controlId}-column-${columnId}`;
}

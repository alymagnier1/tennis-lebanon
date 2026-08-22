/**
 * Whether the grid on screen differs from what is stored.
 *
 * Compared by content rather than by "has the user touched anything", because
 * toggling a cell on and then off again leaves local state populated but the
 * selection identical to the server's. Treating that as unsaved would offer a
 * Save that writes exactly what is already there.
 */
export function availabilitySelectionChanged(
  selected: ReadonlySet<string>,
  saved: ReadonlySet<string>,
): boolean {
  if (selected.size !== saved.size) {
    return true;
  }

  for (const cell of selected) {
    if (!saved.has(cell)) {
      return true;
    }
  }

  return false;
}

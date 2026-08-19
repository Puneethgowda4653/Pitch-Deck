/**
 * Immutable path-based update for a TemplateDeckData draft.
 *
 * Path segments are an array (["probsol","problem",0,"t"]), never a
 * dot-string — every segment is one of our own fixed schema keys/indices,
 * built by our own code (never parsed from user content), so there's no
 * ambiguity to guard against. Structurally shares everything off the edited
 * path; only the objects/arrays along the path get new references.
 */
export type PathSegment = string | number;

export function setByPath<T>(obj: T, path: PathSegment[], value: unknown): T {
  if (path.length === 0) return value as T;

  const [head, ...rest] = path;
  const isIndex = typeof head === "number";
  const base: any = obj ?? (isIndex ? [] : {});

  if (isIndex) {
    const arr = Array.isArray(base) ? base.slice() : [];
    arr[head as number] = setByPath(arr[head as number], rest, value);
    return arr as unknown as T;
  }

  const copy: any = { ...base };
  copy[head] = setByPath(copy[head], rest, value);
  return copy as T;
}

/**
 * Normalize a user-supplied redirect target to a safe internal-only path.
 *
 * Blocks open-redirect vectors:
 *   - Non-absolute paths (no leading `/`)            → fallback `/`
 *   - Protocol-relative URLs (e.g. `//evil.com`)     → fallback `/`
 *   - Backslash bypass (e.g. `/\evil.com`)           → fallback `/`
 *
 * The backslash variant is critical because most browsers normalize `/\foo`
 * to `//foo` when the URL is set via Location header — silently turning a
 * blocked `//` into an allowed prefix without this check.
 *
 * Used by auth actions (login, signup) and the OAuth callback route to
 * ensure attacker-controlled `?redirect=` / `?next=` cannot send users to
 * arbitrary external hosts after authentication.
 */
export function safePath(path: string | undefined | null): string {
  if (!path) return '/'
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('//')) return '/'
  if (path.startsWith('/\\')) return '/'
  return path
}

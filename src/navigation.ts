// Keep new annotation tabs under the deployed application prefix.
export function getPathWithBase(path: string) {
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

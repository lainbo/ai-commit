export function joinUrl(baseUrl: string, suffix: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = joinUrlPath(url.pathname, suffix);
    return url.toString();
  } catch {
    return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
  }
}

export function joinUrlPath(basePath: string, suffix: string): string {
  const a = (basePath || '').replace(/\/+$/, '');
  const b = (suffix || '').replace(/^\/+/, '');
  if (!a) {
    return `/${b}`;
  }
  return `${a}/${b}`;
}

export function withQuery(urlString: string, params: Record<string, string>): string {
  try {
    const url = new URL(urlString);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    const qs = new URLSearchParams(params).toString();
    return `${urlString}${urlString.includes('?') ? '&' : '?'}${qs}`;
  }
}

type Content = { genres?: unknown; genre?: unknown; content_rating?: unknown; [key: string]: unknown };
export function isHentai(value: Content): boolean {
  const labels = [value.genre, value.content_rating, ...(Array.isArray(value.genres) ? value.genres : [])];
  return labels.some(label => typeof label === 'string' && label.trim().toLowerCase() === 'hentai');
}
export function filterMatureContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(filterMatureContent).filter(item => item !== null);
  if (!value || typeof value !== 'object') return value;
  const record = value as Content;
  if (isHentai(record)) return null;
  const result = { ...record };
  for (const [key, child] of Object.entries(record)) {
    if (child && typeof child === 'object') {
      const filtered = filterMatureContent(child);
      // A joined title hidden by the preference also hides its episode/history row.
      if (filtered === null && !Array.isArray(child)) return null;
      result[key] = filtered;
    }
  }
  return result;
}

/** Add classification to projected anime joins, without changing wildcard selects. */
export function includeClassification(selection: string, table: string): string {
  let result = selection.replace(/((?:anime:)?anime(?:_id)?\()([^()]*)\)/g, (match, prefix: string, fields: string) =>
    fields.includes('*') || /\bgenres\b/.test(fields) ? match : `${prefix}${fields},genres)`);
  if (table === 'anime' && !result.includes('*') && !/\bgenres\b/.test(result)) result += ',genres';
  return result;
}

/** Presentation preference only. Database access rules remain authoritative. */
export function installMatureContentFilter(client: { from: Function; rpc: Function }) {
  const originalFrom = client.from.bind(client);
  const originalRpc = client.rpc.bind(client);
  const wrap = (builder: object, table: string, read = true): object => new Proxy(builder, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'then') return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        member.call(target, (response: { data: unknown }) => resolve(read && localStorage.getItem('pref_mature_filter') === '1'
          ? { ...response, data: filterMatureContent(response.data) } : response), reject);
      return (...args: unknown[]) => {
        const isRead = read && !['insert', 'update', 'upsert', 'delete'].includes(String(property));
        if (property === 'select' && isRead) args[0] = includeClassification(typeof args[0] === 'string' ? args[0] : '*', table);
        const next = member.apply(target, args);
        return next && typeof next === 'object' ? wrap(next, table, isRead) : next;
      };
    },
  });
  client.from = (table: string) => wrap(originalFrom(table), table);
  client.rpc = (name: string, ...args: unknown[]) => name === 'home_latest_catalogue'
    ? wrap(originalRpc(name, ...args), '') : originalRpc(name, ...args);
}
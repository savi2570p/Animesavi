export function select1080Variant(manifest: string, baseUrl: string): string | null {
  const lines = manifest.split(/\r?\n/);
  const variants: { height: number; url: string }[] = [];
  lines.forEach((line, index) => {
    if (!line.startsWith('#EXT-X-STREAM-INF:')) return;
    const height = Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1]);
    const path = lines.slice(index + 1).find(value => value.trim() && !value.startsWith('#'));
    if (height > 0 && height <= 1080 && path) variants.push({ height, url: new URL(path.trim(), baseUrl).href });
  });
  return variants.find(value => value.height === 1080)?.url ?? variants.sort((a, b) => b.height - a.height)[0]?.url ?? null;
}
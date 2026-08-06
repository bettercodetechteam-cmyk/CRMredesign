/**
 * Normalize a Firebase service account private key from .env.
 * Handles quoted values and escaped newlines common in Windows .env files.
 */
export function formatFirebasePrivateKey(
  raw: string | undefined,
): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  let key = raw.trim().replace(/^\uFEFF/, '');

  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  key = key.replace(/\\x([a-zA-Z])/g, '\n$1');

  if (!key.includes('\n') && key.includes('-----BEGIN')) {
    key = key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----\n');
  }

  const pemMatch = key.match(
    /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/,
  );

  if (pemMatch) {
    const body = pemMatch[1].replace(/\s/g, '');
    if (body.length > 0) {
      const lines = body.match(/.{1,64}/g) ?? [];
      key = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }

  if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
    return undefined;
  }

  return key;
}

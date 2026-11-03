import { env } from '@/lib/env';

/**
 * Uploads a product file (API.md §9): multipart `file`, the session cookie, and `X-POS-CSRF: 1`,
 * which only the web app's origin may send (CORS preflight). Resolves with the new job's id.
 */
export async function uploadImport(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${env.apiUrl}/v1/imports/products`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-POS-CSRF': '1' },
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as {
    importJobId?: string;
    message?: string;
  };
  if (response.status === 413) {
    throw new Error('The file is larger than 5 MB.');
  }
  if (!response.ok || body.importJobId === undefined) {
    throw new Error(body.message ?? 'The upload failed. Try again.');
  }
  return body.importJobId;
}

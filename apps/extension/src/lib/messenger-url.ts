export function isMessengerUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === "messenger.com" || u.hostname.endsWith(".messenger.com");
  } catch {
    return false;
  }
}

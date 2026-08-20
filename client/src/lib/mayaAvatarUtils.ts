export function shouldUseMayaAvatarFallback(src?: string | null) {
  return !src?.trim();
}

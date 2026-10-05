/** Base URL for the guest QR ordering app (dawat-order-web). */
export const ORDER_WEB_BASE_URL = (
  import.meta.env.VITE_ORDER_WEB_BASE_URL || "http://localhost:8081"
).replace(/\/$/, "");

export function tableOrderUrl(qrToken: string): string {
  return `${ORDER_WEB_BASE_URL}/t/${encodeURIComponent(qrToken)}`;
}

export function qrImageUrl(data: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

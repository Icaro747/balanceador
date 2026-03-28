export function formatNumber(value, digits = 3) {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function parsePositiveFloat(input, fallback = 0) {
  const n = Number.parseFloat(input);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getFactoryColor(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return `hsl(${hue}deg 80% 65%)`;
}

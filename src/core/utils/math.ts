export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
};

export function scaleLinear(x: number, fromStart: number, fromStop: number, toStart: number, toStop: number) {
  x = clamp(x, fromStart, fromStop);
  let y = (x - fromStart) / (fromStop - fromStart);
  return y * (toStop - toStart)  + toStart;
};
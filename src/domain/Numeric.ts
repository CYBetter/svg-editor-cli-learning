export class Numeric {
  static parse(value: string, name: string): number {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`${name} must be a finite number`);
    }
    return Numeric.finite(Number(value), name);
  }

  static finite(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
    return value;
  }

  static positive(value: number, name: string): number {
    Numeric.finite(value, name);
    if (value <= 0) throw new Error(`${name} must be positive`);
    return value;
  }

  static nonNegative(value: number, name: string): number {
    Numeric.finite(value, name);
    if (value < 0) throw new Error(`${name} must not be negative`);
    return value;
  }
}

export abstract class Shape {
  constructor(private readonly shapeId: string) {
    if (shapeId.length === 0) throw new Error('id must not be empty');
  }

  get id(): string { return this.shapeId; }

  abstract get label(): string;
  abstract move(dx: number, dy: number): void;
  abstract describe(): string;
}

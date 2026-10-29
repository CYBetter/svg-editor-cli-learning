import { Numeric } from '../../domain/Numeric';
import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class ScaleCommand extends EditCommand {
  private readonly id: string;
  private readonly factor: number;

  constructor(args: readonly string[]) {
    super();
    ScaleCommand.checkArguments(args, 2, 2, 'scale <id> <factor>');
    this.id = args[0];
    this.factor = Numeric.parse(args[1], 'scale factor');
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    shape.scale(this.factor);
    return `${shape.label} scaled by ${this.factor}`;
  }
}

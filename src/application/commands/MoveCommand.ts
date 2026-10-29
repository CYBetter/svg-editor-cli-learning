import { Numeric } from '../../domain/Numeric';
import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class MoveCommand extends EditCommand {
  private readonly id: string;
  private readonly dx: number;
  private readonly dy: number;

  constructor(args: readonly string[]) {
    super();
    MoveCommand.checkArguments(args, 3, 3, 'move <id> <dx> <dy>');
    this.id = args[0];
    this.dx = Numeric.parse(args[1], 'dx');
    this.dy = Numeric.parse(args[2], 'dy');
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    shape.move(this.dx, this.dy);
    return `moved ${shape.describe()}`;
  }
}

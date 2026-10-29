import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class FrontCommand extends EditCommand {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    FrontCommand.checkArguments(args, 1, 1, 'front <id>');
    this.id = args[0];
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.bringToFront(this.id);
    return `${shape.label} brought to front`;
  }
}

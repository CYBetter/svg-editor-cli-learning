import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class BackCommand extends EditCommand {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    BackCommand.checkArguments(args, 1, 1, 'back <id>');
    this.id = args[0];
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.sendToBack(this.id);
    return `${shape.label} sent to back`;
  }
}

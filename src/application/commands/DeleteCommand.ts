import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class DeleteCommand extends EditCommand {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    DeleteCommand.checkArguments(args, 1, 1, 'delete <id>');
    this.id = args[0];
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.remove(this.id);
    return `${shape.label} deleted`;
  }
}

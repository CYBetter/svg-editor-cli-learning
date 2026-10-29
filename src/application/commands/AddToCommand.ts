import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class AddToCommand extends EditCommand {
  private readonly containerId: string;
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    AddToCommand.checkArguments(args, 2, 2, 'addto <gid> <id>');
    [this.containerId, this.id] = args;
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.addTo(this.containerId, this.id);
    return `${shape.label} moved into ${document.find(this.containerId).label}`;
  }
}

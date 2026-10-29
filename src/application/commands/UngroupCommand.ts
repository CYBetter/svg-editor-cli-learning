import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class UngroupCommand extends EditCommand {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    UngroupCommand.checkArguments(args, 1, 1, 'ungroup <gid>');
    this.id = args[0];
  }

  protected override apply(document: SvgDocument): string {
    const group = document.ungroup(this.id);
    return `${group.label} ungrouped`;
  }
}

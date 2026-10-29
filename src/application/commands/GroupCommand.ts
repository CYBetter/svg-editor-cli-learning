import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class GroupCommand extends EditCommand {
  private readonly id: string;
  private readonly members: readonly string[];

  constructor(args: readonly string[]) {
    super();
    GroupCommand.checkArguments(args, 3, Number.MAX_SAFE_INTEGER, 'group <newGid> <id1> <id2>...');
    this.id = args[0];
    this.members = args.slice(1);
  }

  protected override apply(document: SvgDocument): string {
    const group = document.group(this.id, this.members);
    return `${group.label} created with ${group.getChildren().length} children`;
  }
}

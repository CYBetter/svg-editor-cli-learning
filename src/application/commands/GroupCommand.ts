import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class GroupCommand extends Command {
  private readonly id: string;
  private readonly members: readonly string[];

  constructor(args: readonly string[]) {
    super();
    GroupCommand.checkArguments(args, 3, Number.MAX_SAFE_INTEGER, 'group <newGid> <id1> <id2>...');
    this.id = args[0];
    this.members = args.slice(1);
  }

  override execute(session: EditorSession): string {
    const group = session.document.group(this.id, this.members);
    return `${group.label} created with ${group.getChildren().length} children`;
  }
}

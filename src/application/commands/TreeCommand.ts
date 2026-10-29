import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class TreeCommand extends Command {
  private readonly id?: string;

  constructor(args: readonly string[]) {
    super();
    TreeCommand.checkArguments(args, 0, 1, 'tree [id]');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    return session.document.tree(this.id);
  }
}

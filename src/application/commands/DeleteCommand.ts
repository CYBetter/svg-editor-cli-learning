import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class DeleteCommand extends Command {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    DeleteCommand.checkArguments(args, 1, 1, 'delete <id>');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    const shape = session.document.remove(this.id);
    return `${shape.label} deleted`;
  }
}

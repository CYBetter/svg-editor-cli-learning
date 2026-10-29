import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class ShowCommand extends Command {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    ShowCommand.checkArguments(args, 1, 1, 'show <id>');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    return session.document.show(this.id);
  }
}

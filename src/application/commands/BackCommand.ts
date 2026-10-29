import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class BackCommand extends Command {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    BackCommand.checkArguments(args, 1, 1, 'back <id>');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    const shape = session.document.sendToBack(this.id);
    return `${shape.label} sent to back`;
  }
}

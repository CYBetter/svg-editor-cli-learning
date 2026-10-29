import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class FrontCommand extends Command {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    FrontCommand.checkArguments(args, 1, 1, 'front <id>');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    const shape = session.document.bringToFront(this.id);
    return `${shape.label} brought to front`;
  }
}

import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class RedoCommand extends Command {
  constructor(args: readonly string[]) {
    super();
    RedoCommand.checkArguments(args, 0, 0, 'redo');
  }

  override execute(session: EditorSession): string { return session.redo(); }
}

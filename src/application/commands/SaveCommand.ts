import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class SaveCommand extends Command {
  private readonly filePath?: string;

  constructor(args: readonly string[]) {
    super();
    SaveCommand.checkArguments(args, 0, 1, 'save [file.svg]');
    this.filePath = args[0];
  }

  override execute(session: EditorSession): string {
    return session.save(this.filePath);
  }
}

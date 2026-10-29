import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class ReadCommand extends Command {
  private readonly filePath: string;

  constructor(args: readonly string[]) {
    super();
    ReadCommand.checkArguments(args, 1, 1, 'read <file.svg>');
    this.filePath = args[0];
  }

  override execute(session: EditorSession): string {
    return session.read(this.filePath);
  }
}

import { EditorSession } from '../EditorSession';

export abstract class Command {
  abstract execute(session: EditorSession): string;

  protected static checkArguments(args: readonly string[], min: number, max: number, usage: string): void {
    if (args.length < min || args.length > max) throw new Error(`usage: ${usage}`);
  }
}

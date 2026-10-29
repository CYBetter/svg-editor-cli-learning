import { createInterface } from 'node:readline';
import { EditorSession } from '../application/EditorSession';
import { CommandDispatcher } from './CommandDispatcher';

export class CliApp {
  constructor(
    private readonly session: EditorSession,
    private readonly dispatcher: CommandDispatcher,
  ) {}

  async run(): Promise<void> {
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    const input = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
    process.stdout.write('svg-editor learning 0.1 — commands: init, create rect/circle/ellipse/line/text/g [in <id>], tree, move, scale, set, show, delete, front, back, group, addto, ungroup, undo, redo\n');
    if (interactive) { input.setPrompt('svg> '); input.prompt(); }
    for await (const line of input) {
      try {
        const command = this.dispatcher.parse(line);
        if (command) process.stdout.write(command.execute(this.session) + '\n');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`error: ${message.replace(/[\r\n]+/g, ' ')}\n`);
      }
      if (interactive) input.prompt();
    }
  }
}

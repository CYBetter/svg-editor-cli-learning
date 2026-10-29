import { EditorSession } from './application/EditorSession';
import { CliApp } from './cli/CliApp';
import { CommandDispatcher } from './cli/CommandDispatcher';

export class Main {
  static async run(): Promise<void> {
    await new CliApp(new EditorSession(), new CommandDispatcher()).run();
  }
}

void Main.run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message.replace(/[\r\n]+/g, ' ')}\n`);
  process.exitCode = 1;
});

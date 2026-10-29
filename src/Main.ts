import { EditorSession } from './application/EditorSession';
import { CliApp } from './cli/CliApp';
import { CommandDispatcher } from './cli/CommandDispatcher';
import { SvgFileStore } from './infrastructure/SvgFileStore';

export class Main {
  static async run(): Promise<void> {
    const files = new SvgFileStore();
    await new CliApp(new EditorSession(files, files), new CommandDispatcher()).run();
  }
}

void Main.run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message.replace(/[\r\n]+/g, ' ')}\n`);
  process.exitCode = 1;
});

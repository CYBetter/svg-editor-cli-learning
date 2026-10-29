import { Command } from '../application/commands/Command';
import { CreateCommand } from '../application/commands/CreateCommand';
import { InitCommand } from '../application/commands/InitCommand';
import { MoveCommand } from '../application/commands/MoveCommand';
import { TreeCommand } from '../application/commands/TreeCommand';
import { CommandTokenizer } from './CommandTokenizer';

export class CommandDispatcher {
  private readonly tokenizer = new CommandTokenizer();
  // 唯一命令名称分派入口；待重构：后续改为命令注册。
  private readonly commands = new Map<string, new (args: readonly string[]) => Command>([
    ['init', InitCommand], ['create', CreateCommand], ['move', MoveCommand], ['tree', TreeCommand],
  ]);

  parse(line: string): Command | undefined {
    const [name, ...args] = this.tokenizer.tokenize(line);
    if (name === undefined) return undefined;
    const CommandClass = this.commands.get(name);
    if (!CommandClass) throw new Error(`unknown command: ${name}`);
    return new CommandClass(args);
  }
}

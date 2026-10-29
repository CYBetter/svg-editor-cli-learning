import { Command } from '../application/commands/Command';
import { CommandToken } from '../application/CommandToken';
import { AddToCommand } from '../application/commands/AddToCommand';
import { BackCommand } from '../application/commands/BackCommand';
import { CanvasCommand } from '../application/commands/CanvasCommand';
import { CreateCommand } from '../application/commands/CreateCommand';
import { DeleteCommand } from '../application/commands/DeleteCommand';
import { FrontCommand } from '../application/commands/FrontCommand';
import { GroupCommand } from '../application/commands/GroupCommand';
import { HelpCommand } from '../application/commands/HelpCommand';
import { InitCommand } from '../application/commands/InitCommand';
import { MoveCommand } from '../application/commands/MoveCommand';
import { RedoCommand } from '../application/commands/RedoCommand';
import { ReadCommand } from '../application/commands/ReadCommand';
import { ScaleCommand } from '../application/commands/ScaleCommand';
import { SaveCommand } from '../application/commands/SaveCommand';
import { SetCommand } from '../application/commands/SetCommand';
import { ShowCommand } from '../application/commands/ShowCommand';
import { TreeCommand } from '../application/commands/TreeCommand';
import { UndoCommand } from '../application/commands/UndoCommand';
import { UngroupCommand } from '../application/commands/UngroupCommand';
import { CommandTokenizer } from './CommandTokenizer';

export class CommandDispatcher {
  private readonly tokenizer = new CommandTokenizer();
  // 唯一命令名称分派入口；待重构：后续改为命令注册。
  private readonly commands = new Map<string, new (args: readonly string[], tokens?: readonly CommandToken[]) => Command>([
    ['init', InitCommand], ['create', CreateCommand], ['move', MoveCommand], ['tree', TreeCommand],
    ['scale', ScaleCommand], ['set', SetCommand], ['show', ShowCommand],
    ['delete', DeleteCommand], ['front', FrontCommand], ['back', BackCommand],
    ['group', GroupCommand], ['addto', AddToCommand], ['ungroup', UngroupCommand],
    ['undo', UndoCommand], ['redo', RedoCommand],
    ['help', HelpCommand], ['canvas', CanvasCommand], ['save', SaveCommand], ['read', ReadCommand],
  ]);

  parse(line: string): Command | undefined {
    const [name, ...tokens] = this.tokenizer.scan(line);
    if (name === undefined) return undefined;
    const CommandClass = this.commands.get(name.value);
    if (!CommandClass) throw new Error(`unknown command: ${name.value}`);
    return new CommandClass(tokens.map(token => token.value), tokens);
  }
}

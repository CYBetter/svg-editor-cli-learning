import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class SetCommand extends EditCommand {
  private readonly id: string;
  private readonly attribute: string;
  private readonly value: string;

  constructor(args: readonly string[]) {
    super();
    SetCommand.checkArguments(args, 3, 3, 'set <id> <attr> <value>');
    [this.id, this.attribute, this.value] = args;
  }

  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    shape.setAttribute(this.attribute, this.value);
    const value = this.attribute === 'text' ? JSON.stringify(this.value) : this.value;
    return `${shape.label} updated: ${this.attribute}=${value}`;
  }
}

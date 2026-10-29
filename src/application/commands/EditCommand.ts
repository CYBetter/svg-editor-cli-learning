import { SvgDocument } from '../../domain/SvgDocument';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export abstract class EditCommand extends Command {
  override execute(session: EditorSession): string {
    return session.edit(document => this.apply(document));
  }

  protected abstract apply(document: SvgDocument): string;
}

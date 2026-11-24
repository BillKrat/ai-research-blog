import { Component, input, output } from '@angular/core';
import { PluginSettingDefinition } from '../../services/plugins.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

/** The value of one field changed. */
export interface SettingChange {
  name: string;
  value: string;
}

/**
 * The fields of a list of declared settings (text, one value per line, a switch or a number), filled with the current values. It is the form of a
 * plug-in's Customize screen and of a widget's placement, so a new plug-in or widget gets its form from its declaration with no client change.
 */
@Component({
  selector: 'adv-setting-fields',
  imports: [MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './setting-fields.html',
  styleUrl: './setting-fields.scss',
})
export class SettingFields {
  readonly definitions = input.required<PluginSettingDefinition[]>();
  readonly values = input.required<Record<string, string>>();
  /** Keeps ids unique when several forms are on one page. */
  readonly idPrefix = input('f');
  /** The secrets that already have a value (a secret field is empty and write-only; leaving it empty keeps the value). */
  readonly secretsSet = input<string[]>([]);
  /** The secrets marked for removal (they are removed when the form is saved). */
  readonly clearing = input<string[]>([]);
  readonly changed = output<SettingChange>();
  readonly cleared = output<string>();

  protected isSet(name: string): boolean {
    return this.secretsSet().includes(name);
  }

  protected isClearing(name: string): boolean {
    return this.clearing().includes(name);
  }

  protected emit(name: string, value: string): void {
    this.changed.emit({ name, value });
  }
}

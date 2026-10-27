import { Component, input } from '@angular/core';

/**
 * Dibuja un símbolo de cuidado textil (ISO 3758).
 * Ejemplos de `symbol`: 'wash-machine', 'wash-hand', 'wash-none', 'temp-40', 'cycle-mild',
 * 'bleach-oxygen_only', 'tumble-low', 'dry-flat', 'iron-medium', 'pro-P', 'pro-none'.
 */
@Component({
  selector: 'app-care-symbol',
  templateUrl: './care-symbol.html',
  styleUrl: './care-symbol.scss',
})
export class CareSymbol {
  readonly symbol = input.required<string>();

  protected group(): string {
    return this.symbol().split('-')[0];
  }

  protected value(): string {
    return this.symbol().split('-').slice(1).join('-');
  }
}

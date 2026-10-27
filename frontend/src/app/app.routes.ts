import { Routes } from '@angular/router';

import { Appliances } from './pages/appliances/appliances';
import { Basket } from './pages/basket/basket';
import { Scan } from './pages/scan/scan';

export const routes: Routes = [
  { path: '', component: Scan, title: 'Guía de lavado' },
  { path: 'colada', component: Basket, title: 'Colada' },
  { path: 'electrodomesticos', component: Appliances, title: 'Mis electrodomésticos' },
  { path: '**', redirectTo: '' },
];

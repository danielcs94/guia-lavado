<?php

use App\Laundry\LaundryAdvisor;
use App\Laundry\Vision\PhotoReader;
use Illuminate\Support\Facades\Artisan;

Artisan::command('lavado:etiqueta {foto : Ruta a la foto de la etiqueta}', function (PhotoReader $reader, LaundryAdvisor $advisor) {
    $label = $reader->readLabel($this->argument('foto'));
    $this->line(json_encode(['label' => $label, 'advice' => $advisor->advise($label)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
})->purpose('Lee una foto de etiqueta con la IA y muestra la recomendación');

Artisan::command('lavado:panel {foto : Ruta a la foto del panel}', function (PhotoReader $reader) {
    $this->line(json_encode($reader->readAppliance($this->argument('foto')), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
})->purpose('Lee una foto del panel de la lavadora o secadora con la IA (sin guardarla)');

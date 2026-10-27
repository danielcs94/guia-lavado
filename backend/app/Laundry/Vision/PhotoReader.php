<?php

namespace App\Laundry\Vision;

interface PhotoReader
{
    /**
     * Lee la etiqueta de cuidado de una prenda y devuelve el JSON de LabelSchema.
     *
     * @throws PhotoReadException
     */
    public function readLabel(string $path): array;

    /**
     * Lee el panel de una lavadora o secadora y devuelve el JSON de ApplianceSchema.
     *
     * @throws PhotoReadException
     */
    public function readAppliance(string $path): array;
}

<?php

namespace App\Http\Controllers;

use App\Laundry\LaundryAdvisor;
use App\Laundry\ProgramMatcher;
use App\Laundry\Vision\LabelSchema;
use App\Laundry\Vision\PhotoReader;
use App\Models\Appliance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabelController extends Controller
{
    public function __construct(
        private readonly LaundryAdvisor $advisor,
        private readonly ProgramMatcher $matcher,
    ) {}

    /**
     * Foto de la etiqueta → lectura + recomendación.
     */
    public function scan(Request $request, PhotoReader $reader): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:15360'],
            'garment_type' => ['nullable', Rule::in(LabelSchema::GARMENTS)],
        ], [
            'photo.image' => 'La foto tiene que ser JPG, PNG o WebP.',
        ]);

        $label = $reader->readLabel($request->file('photo')->getRealPath());

        return $this->respond($label, $request->input('garment_type'));
    }

    /**
     * Recalcula la recomendación de una etiqueta ya leída (p. ej. tras corregir el tipo de prenda).
     */
    public function advise(Request $request): JsonResponse
    {
        $request->validate([
            'label' => ['required', 'array'],
            'garment_type' => ['nullable', Rule::in(LabelSchema::GARMENTS)],
        ]);

        return $this->respond($request->input('label'), $request->input('garment_type'));
    }

    private function respond(array $label, ?string $garmentType): JsonResponse
    {
        if ($garmentType !== null) {
            $label['garment'] = ['type' => $garmentType, 'embellishments' => $label['garment']['embellishments'] ?? false];
        }

        $advice = $this->advisor->advise($label);
        if (! $advice['needs_retake']) {
            $advice['appliances'] = $this->matcher->match($label, $advice['settings'], Appliance::all());
        }

        return response()->json(['label' => $label, 'advice' => $advice]);
    }
}

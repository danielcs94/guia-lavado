<?php

namespace App\Http\Controllers;

use App\Laundry\ProgramCategory;
use App\Laundry\Vision\ApplianceSchema;
use App\Laundry\Vision\PhotoReader;
use App\Models\Appliance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class ApplianceController extends Controller
{
    private const MIN_CONFIDENCE = 0.6;

    public function index(): JsonResponse
    {
        return response()->json(Appliance::latest()->get());
    }

    /**
     * Foto del panel → electrodoméstico guardado con sus programas.
     */
    public function scan(Request $request, PhotoReader $reader): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:15360'],
            'name' => ['nullable', 'string', 'max:60'],
        ], [
            'photo.image' => 'La foto tiene que ser JPG, PNG o WebP.',
        ]);

        $reading = $reader->readAppliance($request->file('photo')->getRealPath());

        if (! $reading['readable'] || $reading['confidence'] < self::MIN_CONFIDENCE || $reading['programs'] === []) {
            return response()->json([
                'message' => 'No se leen bien los programas. Haz otra foto del panel completo, de frente y con luz.',
            ], 422);
        }

        $appliance = Appliance::create([
            'name' => $request->input('name') ?? $this->defaultName($reading),
            'kind' => $reading['kind'],
            'brand' => $reading['brand'],
            'model' => $reading['model'],
            'programs' => array_map(
                fn (array $program) => ['category' => ProgramCategory::of($program)] + $program,
                $reading['programs'],
            ),
            'temperatures' => $reading['temperatures'],
            'spin_speeds' => $reading['spin_speeds'],
        ]);

        return response()->json($appliance, 201);
    }

    /**
     * Alta manual, sin foto.
     */
    public function store(Request $request): JsonResponse
    {
        return response()->json(Appliance::create($this->validated($request)), 201);
    }

    /**
     * Corrige un electrodoméstico (p. ej. un programa que la IA leyó mal).
     */
    public function update(Request $request, Appliance $appliance): JsonResponse
    {
        $appliance->update($this->validated($request));

        return response()->json($appliance);
    }

    public function destroy(Appliance $appliance): Response
    {
        $appliance->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'kind' => ['required', Rule::in(ApplianceSchema::KINDS)],
            'brand' => ['nullable', 'string', 'max:60'],
            'model' => ['nullable', 'string', 'max:60'],
            'programs' => ['required', 'array', 'min:1'],
            'programs.*.name' => ['required', 'string', 'max:60'],
            'programs.*.category' => ['required', Rule::in(ApplianceSchema::CATEGORIES)],
            'programs.*.max_temp' => ['nullable', 'integer', 'between:0,95'],
            'temperatures' => ['present', 'array'],
            'temperatures.*' => ['integer', 'between:0,95'],
            'spin_speeds' => ['present', 'array'],
            'spin_speeds.*' => ['integer', 'between:0,2000'],
        ], [
            'name.required' => 'Ponle un nombre.',
            'programs.required' => 'Añade al menos un programa.',
            'programs.*.name.required' => 'Todos los programas necesitan un nombre.',
        ]);
    }

    private function defaultName(array $reading): string
    {
        $kind = match ($reading['kind']) {
            'washer' => 'Lavadora',
            'dryer' => 'Secadora',
            'washer_dryer' => 'Lavadora-secadora',
        };

        return trim("{$kind} {$reading['brand']}");
    }
}

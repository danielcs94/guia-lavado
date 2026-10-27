<?php

namespace App\Http\Controllers;

use App\Laundry\LoadPlanner;
use App\Laundry\Vision\LabelSchema;
use App\Models\Appliance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoadController extends Controller
{
    /**
     * Varias prendas ya leídas → cómo repartirlas en lavadoras.
     */
    public function plan(Request $request, LoadPlanner $planner): JsonResponse
    {
        $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:60'],
            'items.*.id' => ['required', 'string', 'max:40', 'distinct'],
            'items.*.label' => ['required', 'array'],
            'items.*.color' => ['required', Rule::in(LoadPlanner::COLORS)],
            'items.*.garment_type' => ['nullable', Rule::in(LabelSchema::GARMENTS)],
        ], [
            'items.required' => 'Añade al menos una prenda.',
            'items.*.color.required' => 'Indica el color de todas las prendas.',
            'items.*.color.in' => 'Indica el color de todas las prendas.',
        ]);

        $items = array_map(function (array $item) {
            if (($item['garment_type'] ?? null) !== null) {
                $item['label']['garment'] = [
                    'type' => $item['garment_type'],
                    'embellishments' => $item['label']['garment']['embellishments'] ?? false,
                ];
            }

            return $item;
        }, $request->input('items'));

        return response()->json($planner->plan($items, Appliance::all()));
    }
}

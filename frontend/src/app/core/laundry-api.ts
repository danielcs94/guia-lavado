import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { advise } from '../engine/advisor';
import { planLoads } from '../engine/load-planner';
import { categoryOf } from '../engine/program-category';
import { matchAppliances } from '../engine/program-matcher';
import { deleteAppliance, loadAppliances, saveAppliance } from './appliance-store';
import { PhotoReader } from './photo-reader';

export type GarmentType =
  | 'tshirt' | 'shirt' | 'sweater' | 'trousers' | 'jeans' | 'dress' | 'skirt' | 'blazer' | 'suit'
  | 'coat' | 'down_jacket' | 'underwear' | 'sportswear' | 'bedding' | 'towel' | 'other';

export interface Label {
  readable: boolean;
  confidence: number;
  wash: { method: 'machine' | 'hand' | 'none' | null; max_temp: number | null; cycle: 'normal' | 'mild' | 'very_mild' | null } | null;
  bleach: 'any' | 'oxygen_only' | 'none' | null;
  tumble_dry: 'normal' | 'low' | 'none' | null;
  natural_dry: 'line' | 'drip_line' | 'flat' | 'drip_flat' | null;
  iron: 'high' | 'medium' | 'low' | 'none' | null;
  professional: { dry_clean: 'P' | 'F' | 'none' | null; wet_clean: boolean | null } | null;
  fibers: { name: string; percent: number | null }[];
  garment: { type: GarmentType | null; embellishments: boolean } | null;
  notes: string[];
}

export type Verdict = 'Home' | 'HomeCareful' | 'DryCleanRecommended' | 'DryCleanRequired';

export interface WashSettings {
  method: 'machine' | 'hand';
  cycle: 'normal' | 'mild' | 'very_mild' | 'hand';
  max_temp: number;
  max_spin: number;
  bleach: 'any' | 'oxygen_only' | 'none';
  tumble_dry: 'normal' | 'low' | 'none';
  natural_dry: 'line' | 'drip_line' | 'flat' | 'drip_flat' | null;
  iron: 'high' | 'medium' | 'low' | 'none';
}

export interface ApplianceSuggestion {
  appliance_id: number;
  appliance_name: string;
  step: 'wash' | 'dry';
  program: string | null;
  temperature: number | null;
  spin: number | null;
  message: string;
}

export type Advice =
  | { needs_retake: true; message: string }
  | {
      needs_retake: false;
      verdict: Verdict;
      verdict_label: string;
      reasons: string[];
      settings: WashSettings | null;
      tips: string[];
      appliances: ApplianceSuggestion[];
    };

export interface LabelResult {
  label: Label;
  advice: Advice;
}

export type ClothColor = 'white' | 'light' | 'dark' | 'color';

export interface PlanItem {
  id: string;
  label: Label;
  color: ClothColor;
  garment_type: GarmentType | null;
}

export interface WashLoad {
  title: string;
  kind: 'normal' | 'towels' | 'delicate' | 'down';
  tone: 'light' | 'dark';
  item_ids: string[];
  weight_kg: number;
  capacity_kg: number;
  fill: number;
  settings: { cycle: WashSettings['cycle']; max_temp: number; max_spin: number; bleach: WashSettings['bleach'] };
  wash: ApplianceSuggestion[];
  dryer_ids: string[];
  air_dry: { id: string; natural_dry: WashSettings['natural_dry'] }[];
  dry: ApplianceSuggestion[];
  tumble_dry: WashSettings['tumble_dry'];
  tips: string[];
}

export interface LoadPlan {
  loads: WashLoad[];
  hand_wash: { id: string; max_temp: number }[];
  dry_clean: { id: string; required: boolean; reasons: string[] }[];
  needs_retake: string[];
  summary: string;
}

export interface Program {
  name: string;
  category: string;
  max_temp: number | null;
}

export interface Appliance {
  id: number;
  name: string;
  kind: 'washer' | 'dryer' | 'washer_dryer';
  brand: string | null;
  model: string | null;
  programs: Program[];
  temperatures: number[];
  spin_speeds: number[];
}

export type ApplianceInput = Omit<Appliance, 'id'>;

const MIN_CONFIDENCE = 0.6;

/**
 * Todo lo que hace la app: las fotos las lee la IA a través del intermediario y
 * las decisiones las toma el motor de reglas aquí mismo, en el móvil.
 */
@Injectable({ providedIn: 'root' })
export class LaundryApi {
  private readonly reader = inject(PhotoReader);

  scanLabel(photo: Blob): Observable<LabelResult> {
    return this.reader.readLabel(photo).pipe(map((label) => labelResult(label, null)));
  }

  advice(label: Label, garmentType: GarmentType | null): Observable<LabelResult> {
    return of(labelResult(label, garmentType));
  }

  planLoads(items: PlanItem[]): Observable<LoadPlan> {
    const labelled = items.map((item) => ({ ...item, label: withGarment(item.label, item.garment_type) }));
    return of(planLoads(labelled, loadAppliances()));
  }

  appliances(): Observable<Appliance[]> {
    return of(loadAppliances());
  }

  scanAppliance(photo: Blob, name: string): Observable<Appliance> {
    return this.reader.readAppliance(photo).pipe(
      map((reading) => {
        if (!reading.readable || reading.confidence < MIN_CONFIDENCE || reading.programs.length === 0) {
          throw new HttpErrorResponse({
            status: 422,
            error: { message: 'No se leen bien los programas. Haz otra foto del panel completo, de frente y con luz.' },
          });
        }

        return saveAppliance({
          name: name.trim() || defaultName(reading.kind, reading.brand),
          kind: reading.kind,
          brand: reading.brand,
          model: reading.model,
          programs: reading.programs.map((program) => ({ ...program, category: categoryOf(program) })),
          temperatures: reading.temperatures,
          spin_speeds: reading.spin_speeds,
        });
      }),
    );
  }

  createAppliance(appliance: ApplianceInput): Observable<Appliance> {
    return of(saveAppliance(appliance));
  }

  updateAppliance(id: number, appliance: ApplianceInput): Observable<Appliance> {
    return of(saveAppliance(appliance, id));
  }

  deleteAppliance(id: number): Observable<void> {
    deleteAppliance(id);
    return of(undefined);
  }
}

function withGarment(label: Label, garmentType: GarmentType | null): Label {
  return garmentType === null
    ? label
    : { ...label, garment: { type: garmentType, embellishments: label.garment?.embellishments ?? false } };
}

function labelResult(read: Label, garmentType: GarmentType | null): LabelResult {
  const label = withGarment(read, garmentType);
  const advice = advise(label);

  return {
    label,
    advice: advice.needs_retake ? advice : { ...advice, appliances: matchAppliances(label, advice.settings, loadAppliances()) },
  };
}

function defaultName(kind: Appliance['kind'], brand: string | null): string {
  const names = { washer: 'Lavadora', dryer: 'Secadora', washer_dryer: 'Lavadora-secadora' };
  return `${names[kind]} ${brand ?? ''}`.trim();
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = '/api';

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

@Injectable({ providedIn: 'root' })
export class LaundryApi {
  private readonly http = inject(HttpClient);

  scanLabel(photo: Blob): Observable<LabelResult> {
    return this.http.post<LabelResult>(`${API_URL}/labels/scan`, this.photoForm(photo));
  }

  advice(label: Label, garmentType: GarmentType | null): Observable<LabelResult> {
    return this.http.post<LabelResult>(`${API_URL}/labels/advice`, { label, garment_type: garmentType });
  }

  planLoads(items: PlanItem[]): Observable<LoadPlan> {
    return this.http.post<LoadPlan>(`${API_URL}/loads/plan`, { items });
  }

  appliances(): Observable<Appliance[]> {
    return this.http.get<Appliance[]>(`${API_URL}/appliances`);
  }

  scanAppliance(photo: Blob, name: string): Observable<Appliance> {
    const form = this.photoForm(photo);
    if (name.trim()) {
      form.append('name', name.trim());
    }
    return this.http.post<Appliance>(`${API_URL}/appliances/scan`, form);
  }

  createAppliance(appliance: ApplianceInput): Observable<Appliance> {
    return this.http.post<Appliance>(`${API_URL}/appliances`, appliance);
  }

  updateAppliance(id: number, appliance: ApplianceInput): Observable<Appliance> {
    return this.http.put<Appliance>(`${API_URL}/appliances/${id}`, appliance);
  }

  deleteAppliance(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/appliances/${id}`);
  }

  private photoForm(photo: Blob): FormData {
    const form = new FormData();
    form.append('photo', photo, 'foto.jpg');
    return form;
  }
}

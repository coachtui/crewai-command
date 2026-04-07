// ============================================================================
// Equipment Requests & Inventory API
// ============================================================================

import { supabase } from '../supabase';
import type {
  EquipmentInventory,
  EquipmentMovementLog,
  EquipmentRequest,
  EquipmentRequestStatus,
} from '../../types';

// Shared select fragment for equipment_inventory join — includes make/model/serial
const INVENTORY_JOIN = 'equipment_inventory(id, name, make, model, serial_number)';

// Shared select fragment for equipment_requests with all joins
const REQUEST_SELECT = `
  *,
  requesting_job_site:job_sites!requesting_job_site_id(id, name),
  destination_job_site:job_sites!destination_job_site_id(id, name),
  requested_by_profile:user_profiles!requested_by(id, name),
  ${INVENTORY_JOIN}
`;

// ============================================================================
// EQUIPMENT INVENTORY
// ============================================================================

export async function fetchEquipmentInventory(orgId: string): Promise<EquipmentInventory[]> {
  const { data, error } = await supabase
    .from('equipment_inventory')
    .select(`*, current_location:job_sites!current_job_site_id(id, name)`)
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return (data || []) as EquipmentInventory[];
}

export interface CreateInventoryItemData {
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  category?: string;
  quantity_total: number;
  quantity_available: number;
  current_job_site_id?: string;
  notes?: string;
}

export async function createEquipmentInventoryItem(
  orgId: string,
  data: CreateInventoryItemData
): Promise<EquipmentInventory> {
  const { data: result, error } = await supabase
    .from('equipment_inventory')
    .insert({ ...data, organization_id: orgId })
    .select(`*, current_location:job_sites!current_job_site_id(id, name)`)
    .single();

  if (error) throw error;
  return result as EquipmentInventory;
}

export async function updateEquipmentInventoryItem(
  id: string,
  updates: Partial<
    Pick<
      EquipmentInventory,
      | 'name'
      | 'make'
      | 'model'
      | 'serial_number'
      | 'category'
      | 'quantity_total'
      | 'quantity_available'
      | 'current_job_site_id'
      | 'notes'
    >
  >
): Promise<EquipmentInventory> {
  const { data, error } = await supabase
    .from('equipment_inventory')
    .update(updates)
    .eq('id', id)
    .select(`*, current_location:job_sites!current_job_site_id(id, name)`)
    .single();

  if (error) throw error;
  return data as EquipmentInventory;
}

export async function deleteEquipmentInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_inventory').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// MOVEMENT LOG
// ============================================================================

export async function fetchMovementLog(
  inventoryItemId: string
): Promise<EquipmentMovementLog[]> {
  const { data, error } = await supabase
    .from('equipment_movement_log')
    .select(`
      *,
      from_job_site:job_sites!from_job_site_id(id, name),
      to_job_site:job_sites!to_job_site_id(id, name),
      moved_by_profile:user_profiles!moved_by(id, name)
    `)
    .eq('equipment_inventory_id', inventoryItemId)
    .order('moved_at', { ascending: false });

  if (error) throw error;
  return (data || []) as EquipmentMovementLog[];
}

// ============================================================================
// EQUIPMENT REQUESTS
// ============================================================================

export async function fetchEquipmentRequests(orgId: string): Promise<EquipmentRequest[]> {
  const { data, error } = await supabase
    .from('equipment_requests')
    .select(REQUEST_SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as EquipmentRequest[];
}

export interface CreateEquipmentRequestData {
  organization_id: string;
  equipment_inventory_id?: string;
  equipment_name: string;
  quantity_requested: number;
  requesting_job_site_id: string;
  destination_job_site_id: string;
  date_needed: string;
  notes?: string;
  requested_by: string;
}

export async function createEquipmentRequest(
  data: CreateEquipmentRequestData
): Promise<EquipmentRequest> {
  const { data: result, error } = await supabase
    .from('equipment_requests')
    .insert(data)
    .select(REQUEST_SELECT)
    .single();

  if (error) throw error;
  return result as EquipmentRequest;
}

// Status transition payloads
interface ApprovePayload {
  transition: 'approve';
  approved_by: string;
}
interface DispatchPayload {
  transition: 'dispatch';
  dispatched_by: string;
  dispatch_notes?: string;
}
interface ReceivePayload {
  transition: 'receive';
}

export type RequestTransition = ApprovePayload | DispatchPayload | ReceivePayload;

// Map equipment_inventory category to equipment table type values
function categoryToEquipmentType(category?: string): string {
  if (!category) return 'other';
  const lower = category.toLowerCase();
  if (lower.includes('heavy')) return 'heavy_equipment';
  if (lower.includes('small')) return 'small_equipment';
  if (lower.includes('tool')) return 'tools';
  if (lower.includes('vehicle') || lower.includes('truck')) return 'vehicles';
  return 'other';
}

export async function transitionEquipmentRequest(
  request: EquipmentRequest,
  transition: RequestTransition
): Promise<EquipmentRequest> {
  let statusUpdate: Partial<EquipmentRequest>;
  let newStatus: EquipmentRequestStatus;

  if (transition.transition === 'approve') {
    newStatus = 'approved';
    statusUpdate = { status: newStatus, approved_by: transition.approved_by };
  } else if (transition.transition === 'dispatch') {
    newStatus = 'dispatched';
    statusUpdate = {
      status: newStatus,
      dispatched_by: transition.dispatched_by,
      dispatch_notes: transition.dispatch_notes || undefined,
      dispatched_at: new Date().toISOString(),
    };
  } else {
    newStatus = 'received';
    statusUpdate = { status: newStatus, received_at: new Date().toISOString() };
  }

  const { data, error } = await supabase
    .from('equipment_requests')
    .update(statusUpdate)
    .eq('id', request.id)
    .select(REQUEST_SELECT)
    .single();

  if (error) throw error;

  // ── DISPATCH side-effects ────────────────────────────────────────────────
  if (transition.transition === 'dispatch') {
    // 1. Update equipment_inventory location + decrement qty
    if (request.equipment_inventory_id) {
      const { data: inv, error: invFetchErr } = await supabase
        .from('equipment_inventory')
        .select('quantity_available, make, model, serial_number, category')
        .eq('id', request.equipment_inventory_id)
        .single();

      if (invFetchErr) {
        console.warn('[equipmentRequests] inventory fetch failed:', invFetchErr);
      } else {
        const newQty = Math.max(0, (inv.quantity_available ?? 0) - request.quantity_requested);
        await supabase
          .from('equipment_inventory')
          .update({
            current_job_site_id: request.destination_job_site_id,
            quantity_available: newQty,
          })
          .eq('id', request.equipment_inventory_id);
        // TODO: quantity_available logic may need refinement for partial dispatches

        // 2. Sync with equipment table — find existing by name+org or create
        const { data: existing } = await supabase
          .from('equipment')
          .select('id, job_site_id')
          .eq('organization_id', request.organization_id)
          .ilike('name', request.equipment_name)
          .limit(1)
          .maybeSingle();

        let equipmentId: string | null = null;

        if (existing) {
          // Move existing equipment record to destination
          await supabase
            .from('equipment')
            .update({
              job_site_id: request.destination_job_site_id,
              status: 'in_use',
              model: inv.model ?? existing.job_site_id,  // preserve existing if inventory has none
            })
            .eq('id', existing.id);
          equipmentId = existing.id;
        } else {
          // Create new equipment record at destination
          const { data: created } = await supabase
            .from('equipment')
            .insert({
              organization_id: request.organization_id,
              name: request.equipment_name,
              type: categoryToEquipmentType(inv.category),
              model: inv.model ?? null,
              serial_number: inv.serial_number ?? null,
              status: 'in_use',
              job_site_id: request.destination_job_site_id,
            })
            .select('id')
            .single();
          equipmentId = created?.id ?? null;
        }

        // 3. Write movement log entry
        await supabase.from('equipment_movement_log').insert({
          organization_id: request.organization_id,
          equipment_inventory_id: request.equipment_inventory_id,
          equipment_id: equipmentId,
          equipment_name: request.equipment_name,
          from_job_site_id: request.requesting_job_site_id,
          to_job_site_id: request.destination_job_site_id,
          moved_by: transition.dispatched_by,
          request_id: request.id,
          notes: transition.dispatch_notes ?? null,
        });
      }
    } else {
      // Free-text request — no inventory link, still try to sync equipment table
      console.warn('[equipmentRequests] No inventory record linked for:', request.equipment_name);

      const { data: existing } = await supabase
        .from('equipment')
        .select('id, job_site_id')
        .eq('organization_id', request.organization_id)
        .ilike('name', request.equipment_name)
        .limit(1)
        .maybeSingle();

      let equipmentId: string | null = null;

      if (existing) {
        await supabase
          .from('equipment')
          .update({ job_site_id: request.destination_job_site_id, status: 'in_use' })
          .eq('id', existing.id);
        equipmentId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('equipment')
          .insert({
            organization_id: request.organization_id,
            name: request.equipment_name,
            type: 'other',
            status: 'in_use',
            job_site_id: request.destination_job_site_id,
          })
          .select('id')
          .single();
        equipmentId = created?.id ?? null;
      }

      // Write movement log even without inventory link
      await supabase.from('equipment_movement_log').insert({
        organization_id: request.organization_id,
        equipment_inventory_id: null,
        equipment_id: equipmentId,
        equipment_name: request.equipment_name,
        from_job_site_id: request.requesting_job_site_id,
        to_job_site_id: request.destination_job_site_id,
        moved_by: transition.dispatched_by,
        request_id: request.id,
        notes: transition.dispatch_notes ?? null,
      });
    }
  }

  // ── RECEIVE side-effects ─────────────────────────────────────────────────
  if (transition.transition === 'receive' && request.equipment_inventory_id) {
    const { data: inv, error: invFetchErr } = await supabase
      .from('equipment_inventory')
      .select('quantity_available, quantity_total')
      .eq('id', request.equipment_inventory_id)
      .single();

    if (!invFetchErr && inv) {
      const restored = Math.min(
        inv.quantity_total,
        (inv.quantity_available ?? 0) + request.quantity_requested
      );
      await supabase
        .from('equipment_inventory')
        .update({ quantity_available: restored })
        .eq('id', request.equipment_inventory_id);
    }
    // TODO: quantity_available logic may need refinement for partial dispatches
  }

  return data as EquipmentRequest;
}

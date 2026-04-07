// ============================================================================
// Equipment Requests & Inventory API
// ============================================================================

import { supabase } from '../supabase';
import type { EquipmentInventory, EquipmentRequest, EquipmentRequestStatus } from '../../types';

// ============================================================================
// EQUIPMENT INVENTORY
// ============================================================================

export async function fetchEquipmentInventory(orgId: string): Promise<EquipmentInventory[]> {
  const { data, error } = await supabase
    .from('equipment_inventory')
    .select(`
      *,
      current_location:job_sites!current_job_site_id(id, name)
    `)
    .eq('organization_id', orgId)
    .order('name');

  if (error) throw error;
  return (data || []) as EquipmentInventory[];
}

export interface CreateInventoryItemData {
  name: string;
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
  updates: Partial<Pick<EquipmentInventory, 'name' | 'category' | 'quantity_total' | 'quantity_available' | 'current_job_site_id' | 'notes'>>
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
  const { error } = await supabase
    .from('equipment_inventory')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// EQUIPMENT REQUESTS
// ============================================================================

export async function fetchEquipmentRequests(orgId: string): Promise<EquipmentRequest[]> {
  const { data, error } = await supabase
    .from('equipment_requests')
    .select(`
      *,
      requesting_job_site:job_sites!requesting_job_site_id(id, name),
      destination_job_site:job_sites!destination_job_site_id(id, name),
      requested_by_profile:user_profiles!requested_by(id, name),
      equipment_inventory(id, name)
    `)
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
    .select(`
      *,
      requesting_job_site:job_sites!requesting_job_site_id(id, name),
      destination_job_site:job_sites!destination_job_site_id(id, name),
      requested_by_profile:user_profiles!requested_by(id, name),
      equipment_inventory(id, name)
    `)
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
    .select(`
      *,
      requesting_job_site:job_sites!requesting_job_site_id(id, name),
      destination_job_site:job_sites!destination_job_site_id(id, name),
      requested_by_profile:user_profiles!requested_by(id, name),
      equipment_inventory(id, name)
    `)
    .single();

  if (error) throw error;

  // On dispatch: update inventory location and decrement quantity_available
  if (transition.transition === 'dispatch' && request.equipment_inventory_id) {
    const { data: inv, error: invFetchErr } = await supabase
      .from('equipment_inventory')
      .select('quantity_available')
      .eq('id', request.equipment_inventory_id)
      .single();

    if (invFetchErr) {
      console.warn('[equipmentRequests] Could not fetch inventory for location update:', invFetchErr);
    } else {
      const newQty = Math.max(0, (inv.quantity_available ?? 0) - request.quantity_requested);
      const { error: invErr } = await supabase
        .from('equipment_inventory')
        .update({
          current_job_site_id: request.destination_job_site_id,
          quantity_available: newQty,
        })
        .eq('id', request.equipment_inventory_id);

      if (invErr) {
        console.warn('[equipmentRequests] Inventory location update failed:', invErr);
      }
    }
    // TODO: quantity_available logic may need refinement for partial dispatches
  } else if (transition.transition === 'dispatch' && !request.equipment_inventory_id) {
    console.warn('[equipmentRequests] No inventory record linked — skipping inventory update for:', request.equipment_name);
  }

  // On receive: restore quantity_available at destination
  if (transition.transition === 'receive' && request.equipment_inventory_id) {
    const { data: inv, error: invFetchErr } = await supabase
      .from('equipment_inventory')
      .select('quantity_available, quantity_total')
      .eq('id', request.equipment_inventory_id)
      .single();

    if (!invFetchErr && inv) {
      const restored = Math.min(inv.quantity_total, (inv.quantity_available ?? 0) + request.quantity_requested);
      const { error: invErr } = await supabase
        .from('equipment_inventory')
        .update({ quantity_available: restored })
        .eq('id', request.equipment_inventory_id);

      if (invErr) {
        console.warn('[equipmentRequests] Inventory quantity restore failed:', invErr);
      }
    }
    // TODO: quantity_available logic may need refinement for partial dispatches
  }

  return data as EquipmentRequest;
}

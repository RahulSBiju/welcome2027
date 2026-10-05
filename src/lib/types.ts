export type Trip = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  /** The organiser's final choice (📌), set after update 003 */
  pinned_location_id?: string | null;
  pinned_start?: string | null;
  pinned_end?: string | null;
};

export type PackingItem = {
  id: string;
  trip_id: string;
  title: string;
  is_personal: boolean;
  assigned_to: string | null;
  is_packed: boolean;
  created_by: string;
  created_at: string;
};

export type Availability = {
  id: string;
  user_id: string;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string; // 'YYYY-MM-DD'
};

export type Place = {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  link_url: string | null;
  added_by: string;
  created_at: string;
  profiles: { display_name: string } | null;
  location_votes: { user_id: string }[];
};

export type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
};

export type PlaceImage = {
  id: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
};

export type TripMember = {
  user_id: string;
  role: 'owner' | 'member';
  leave_days: number | null;
  profiles: { display_name: string } | null;
};

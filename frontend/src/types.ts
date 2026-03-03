export type CustomerStatus = "active" | "disabled" | "merged";

export interface PhoneOut {
  id: number;
  customer_id: number;
  phone_number: string;
  is_primary: boolean;
  sms_enabled: boolean;
  created_at: string;
}

export interface CustomerWithPhones {
  id: number;
  nickname: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
  phones: PhoneOut[];
}

export interface OrderOut {
    id: number;
    customer_id: number;
    phone_number_used: string;
    amount: number;
    paid_amount: number;
    points_earned: number;
    points_used: number;
    operator_user_id: number;
    created_at: string;
    note: string | null;
  }
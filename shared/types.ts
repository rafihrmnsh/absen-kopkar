// Shared types untuk attendance system

export type AttendanceType = "check-in" | "check-out";
export type AttendanceStatus = "hadir" | "terlambat" | "pulang-cepat" | "normal";
export type AmnestyType = "terlambat" | "pulang-cepat";
export type AmnestyStatus = "pending" | "approved" | "rejected";

export interface AttendanceRecord {
  id?: string;
  name: string;
  type: AttendanceType;
  lat: number;
  lng: number;
  accuracy?: number | null;
  note?: string | null;
  createdAt: any;
  status?: AttendanceStatus;
  userAgent?: string;
  isAmnesty?: boolean;
  amnestyId?: string;
  amnestyReason?: string;
}

export interface AmnestyRequest {
  id?: string;
  userId: string;
  userName: string;
  type: AmnestyType;
  reason: string;
  proofUrl: string;
  status: AmnestyStatus;
  createdAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface AttendanceSummary {
  name: string;
  hadir: number;
  terlambat: number;
  pulangCepat: number;
  totalHari: number;
}

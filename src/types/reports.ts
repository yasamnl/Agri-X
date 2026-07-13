
export interface ReportUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface Report {
  id: number;
  reporter: ReportUser;
  reported: ReportUser;
  jenisLaporan: string;
  deskripsi: string;
  buktiUrl?: string | null;
  statusLaporan: string;
  adminNote?: string | null;
  tanggalLaporan: string;
  updatedAt: string;
}

export interface StatusCounts {
  all: number;
  menunggu: number;
  ditinjau: number;
  selesai: number;
  ditolak: number;
}

export interface JenisCounts {
  all: number;
  spam: number;
  fraud: number;
  inappropriate: number;
  copyright: number;
  others: number;
}

export interface FilterState {
  search: string;
  jenis: string;
  dateFrom: string;
  dateTo: string;
}
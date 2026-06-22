export interface Item {
  id: number;
  type: 'product' | 'raw_material';
  name: string;
  code: string;
  current_stock: number;
  unit: string;
  category?: string;
  image?: string;
  thumbnail?: string;
}

export interface Transaction {
  id: number;
  item_id: number;
  type: 'in' | 'out';
  quantity: number;
  date: string;
  document_type: string;
  document_ref: string;
  notes?: string;
  user?: string;
  // joined info
  item_name?: string;
  item_code?: string;
  item_unit?: string;
  item_type?: string;
}

export interface StatInfo {
  totalProducts: number;
  totalMaterials: number;
  lowStock: number;
  recentTx: number;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'manager' | 'viewer';
}

export interface Changelog {
  id: number;
  version: string;
  date: string;
  features: string;
  fixes: string;
}

export interface Category {
  id: number;
  name: string;
  prefix: string;
  type: string;
}

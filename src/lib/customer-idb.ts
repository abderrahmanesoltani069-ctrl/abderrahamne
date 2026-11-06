import { OrderType } from './domain-rules';

export interface SelectedModifierItem {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartLineItem {
  cartLineId: string;
  menuItemId: string;
  name: string;
  unitBasePrice: number;
  modifiersTotal: number;
  unitFinalPrice: number;
  quantity: number;
  lineTotal: number;
  selectedModifiers: SelectedModifierItem[];
  specialNotes: string;
}

export interface CustomerSessionState {
  tenantSlug: string;
  tableNumber: string;
  orderType: OrderType;
  cart: CartLineItem[];
  updatedAt: number;
}

const DB_NAME = 'SmartMenuCustomerDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'tenantSlug' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomerSession(state: CustomerSessionState): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ ...state, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`smart_menu_${state.tenantSlug}`, JSON.stringify(state));
    }
  }
}

export async function loadCustomerSession(tenantSlug: string): Promise<CustomerSessionState | null> {
  try {
    const db = await openDatabase();
    return await new Promise<CustomerSessionState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(tenantSlug);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`smart_menu_${tenantSlug}`);
      return raw ? (JSON.parse(raw) as CustomerSessionState) : null;
    }
    return null;
  }
}

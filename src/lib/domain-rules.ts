export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_OWNER = 'TENANT_OWNER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  CASHIER = 'CASHIER',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  WAITER = 'WAITER',
  CUSTOMER = 'CUSTOMER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  POS_CARD = 'POS_CARD',
  ONLINE_CARD = 'ONLINE_CARD',
}

export enum RealtimeEvent {
  ORDER_CREATED = 'order:created',
  ORDER_ACCEPTED = 'order:accepted',
  ORDER_PREPARING = 'order:preparing',
  ORDER_READY = 'order:ready',
  ORDER_SERVED = 'order:served',
  ORDER_COMPLETED = 'order:completed',
  ORDER_CANCELLED = 'order:cancelled',
  CATALOG_ITEM_86ED = 'catalog:item_86ed',
  WAITER_CALLED = 'waiter:called',
}

export interface StateTransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  allowedRoles: UserRole[];
  emittedEvent: RealtimeEvent;
  requiresReason?: boolean;
}

export const ORDER_STATE_MACHINE_RULES: ReadonlyArray<StateTransitionRule> = [
  {
    from: OrderStatus.PENDING,
    to: OrderStatus.ACCEPTED,
    allowedRoles: [UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_ACCEPTED,
  },
  {
    from: OrderStatus.ACCEPTED,
    to: OrderStatus.PREPARING,
    allowedRoles: [UserRole.KITCHEN_STAFF, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_PREPARING,
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.READY,
    allowedRoles: [UserRole.KITCHEN_STAFF, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_READY,
  },
  {
    from: OrderStatus.READY,
    to: OrderStatus.SERVED,
    allowedRoles: [UserRole.WAITER, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_SERVED,
  },
  {
    from: OrderStatus.SERVED,
    to: OrderStatus.COMPLETED,
    allowedRoles: [UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_COMPLETED,
  },
  {
    from: OrderStatus.READY,
    to: OrderStatus.COMPLETED,
    allowedRoles: [UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_COMPLETED,
  },
  {
    from: OrderStatus.PENDING,
    to: OrderStatus.CANCELLED,
    allowedRoles: [UserRole.CUSTOMER, UserRole.CASHIER, UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_CANCELLED,
    requiresReason: true,
  },
  {
    from: OrderStatus.ACCEPTED,
    to: OrderStatus.CANCELLED,
    allowedRoles: [UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_CANCELLED,
    requiresReason: true,
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.CANCELLED,
    allowedRoles: [UserRole.BRANCH_MANAGER, UserRole.TENANT_OWNER],
    emittedEvent: RealtimeEvent.ORDER_CANCELLED,
    requiresReason: true,
  },
];

export function validateOrderStateTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  actorRole: UserRole,
  reason?: string,
): { valid: boolean; event?: RealtimeEvent; error?: string } {
  const rule = ORDER_STATE_MACHINE_RULES.find(
    (r) => r.from === currentStatus && r.to === targetStatus,
  );

  if (!rule) {
    return {
      valid: false,
      error: `انتقال غير مسموح به هندسياً من الحالة [${currentStatus}] إلى الحالة [${targetStatus}].`,
    };
  }

  if (!rule.allowedRoles.includes(actorRole)) {
    return {
      valid: false,
      error: `الدور الوظيفي [${actorRole}] لا يملك صلاحية تغيير الطلب من [${currentStatus}] إلى [${targetStatus}].`,
    };
  }

  if (rule.requiresReason && (!reason || reason.trim().length < 3)) {
    return {
      valid: false,
      error: `يجب إدخال سبب واضح لإتمام الانتقال إلى الحالة [${targetStatus}].`,
    };
  }

  return { valid: true, event: rule.emittedEvent };
}

export interface KdsSlaResult {
  level: 'FRESH' | 'WARNING' | 'CRITICAL';
  label: string;
  formattedClock: string;
  elapsedMinutes: number;
  elapsedTotalSeconds: number;
}

export function computeTicketSla(acceptedAtMs: number, nowMs: number): KdsSlaResult {
  const elapsedTotalSeconds = Math.max(0, Math.floor((nowMs - acceptedAtMs) / 1000));
  const elapsedMinutes = Math.floor(elapsedTotalSeconds / 60);
  const seconds = elapsedTotalSeconds % 60;
  const formattedClock = `${String(elapsedMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (elapsedMinutes >= 10) {
    return {
      level: 'CRITICAL',
      label: 'متأخر حرج (> 10 د)',
      formattedClock,
      elapsedMinutes,
      elapsedTotalSeconds,
    };
  }
  if (elapsedMinutes >= 5) {
    return {
      level: 'WARNING',
      label: 'تنبيه وقت (5-10 د)',
      formattedClock,
      elapsedMinutes,
      elapsedTotalSeconds,
    };
  }
  return {
    level: 'FRESH',
    label: 'طلب جديد (< 5 د)',
    formattedClock,
    elapsedMinutes,
    elapsedTotalSeconds,
  };
}

export interface ModifierOptionDef {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ModifierGroupDef {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOptionDef[];
}

export function validateModifierSelections(
  modifierGroups: ModifierGroupDef[],
  selectedOptions: Record<string, string[]>,
): { valid: boolean; error?: string } {
  for (const group of modifierGroups) {
    const chosen = selectedOptions[group.id] || [];
    if (chosen.length < group.minSelect) {
      return {
        valid: false,
        error: `يرجى اختيار ${group.minSelect} على الأقل في "${group.name}".`,
      };
    }
    if (chosen.length > group.maxSelect) {
      return {
        valid: false,
        error: `الحد الأقصى المسموح به في "${group.name}" هو ${group.maxSelect}.`,
      };
    }
    for (const optId of chosen) {
      const opt = group.options.find((o) => o.id === optId);
      if (!opt || !opt.isAvailable) {
        return {
          valid: false,
          error: `الإضافة المختارة في "${group.name}" غير متوفرة حالياً.`,
        };
      }
    }
  }
  return { valid: true };
}

export interface PricedLineInput {
  unitBasePrice: number;
  modifiersTotal: number;
  quantity: number;
  isAvailable?: boolean;
}

export function calculateZeroTrustOrderTotals(
  lines: PricedLineInput[],
  taxRatePercent: number,
  orderType: OrderType,
  branchDeliveryFee: number,
): {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
} {
  let subtotal = 0;
  for (const line of lines) {
    if (line.isAvailable === false) {
      throw new Error('أحد الأصناف المختارة نفد من المطبخ للتو (86ed).');
    }
    const unitFinal = line.unitBasePrice + line.modifiersTotal;
    subtotal += unitFinal * line.quantity;
  }
  subtotal = Number(subtotal.toFixed(2));
  const deliveryFee = orderType === OrderType.DELIVERY ? Number(branchDeliveryFee.toFixed(2)) : 0;
  const taxAmount = Number(((subtotal * taxRatePercent) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount + deliveryFee).toFixed(2));

  return { subtotal, taxAmount, deliveryFee, totalAmount };
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export interface RoiInputParams {
  monthlyAggregatorOrders: number;
  averageOrderValue: number;
  aggregatorCommissionPercent: number;
  directConversionPercent: number;
  saasMonthlyFee: number;
  tablesCount: number;
  peakHoursPerDay: number;
  currentTableDurationMins: number;
  savedMinutesPerTable: number;
  tableAverageOrderValue: number;
}

export interface RoiCalculationResult {
  monthlyCommissionSavedNet: number;
  annualCommissionSavedNet: number;
  newTableDurationMins: number;
  additionalDailyTablesServed: number;
  monthlyExtraDineInRevenue: number;
  monthlyUpsellGain: number;
  totalMonthlyFinancialImpact: number;
}

export function calculateRestaurantRoi(params: RoiInputParams): RoiCalculationResult {
  const commRate = params.aggregatorCommissionPercent / 100;
  const convRate = params.directConversionPercent / 100;

  const grossCommissionSaved =
    params.monthlyAggregatorOrders * params.averageOrderValue * commRate * convRate;
  const monthlyCommissionSavedNet = Math.round(grossCommissionSaved - params.saasMonthlyFee);
  const annualCommissionSavedNet = monthlyCommissionSavedNet * 12;

  const newTableDurationMins = Math.max(
    15,
    params.currentTableDurationMins - params.savedMinutesPerTable,
  );
  const peakMins = params.peakHoursPerDay * 60;
  const oldTurnsPerTable = peakMins / Math.max(15, params.currentTableDurationMins);
  const newTurnsPerTable = peakMins / newTableDurationMins;
  const additionalDailyTablesServed = Number(
    (params.tablesCount * (newTurnsPerTable - oldTurnsPerTable)).toFixed(1),
  );
  const monthlyExtraDineInRevenue = Math.round(
    additionalDailyTablesServed * params.tableAverageOrderValue * 30,
  );

  const monthlyUpsellGain = Math.round(
    params.monthlyAggregatorOrders * params.averageOrderValue * 0.12,
  );

  const totalMonthlyFinancialImpact =
    monthlyCommissionSavedNet + monthlyExtraDineInRevenue + monthlyUpsellGain;

  return {
    monthlyCommissionSavedNet,
    annualCommissionSavedNet,
    newTableDurationMins,
    additionalDailyTablesServed,
    monthlyExtraDineInRevenue,
    monthlyUpsellGain,
    totalMonthlyFinancialImpact,
  };
}

/**
 * Pure 1-Bit Monochrome Threshold Bitmap Packer + ESC/POS (GS v 0) Command Framing
 */
export function packMonochromePixelsToEscPosBytes(
  luminanceGrid: Uint8Array,
  widthDots: number,
  heightDots: number,
  openCashDrawer = false,
): Uint8Array {
  if (widthDots % 8 !== 0) {
    throw new Error('عرض الطابعة الحرارية بالنقاط يجب أن يقبل القسمة على 8 (مثال: 576 نقطة).');
  }
  const bytesPerRow = widthDots / 8;
  const bitmapBytes = new Uint8Array(bytesPerRow * heightDots);

  for (let y = 0; y < heightDots; y++) {
    for (let xByte = 0; xByte < bytesPerRow; xByte++) {
      let byteValue = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        const lum = luminanceGrid[y * widthDots + x];
        // Black thermal dot if luminance < 145
        if (lum < 145) {
          byteValue |= 1 << (7 - bit);
        }
      }
      bitmapBytes[y * bytesPerRow + xByte] = byteValue;
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = heightDots & 0xff;
  const yH = (heightDots >> 8) & 0xff;

  const headerCommands: number[] = [
    0x1b, 0x40, // ESC @ (Initialize printer)
    0x1b, 0x61, 0x01, // ESC a 1 (Center alignment)
  ];

  if (openCashDrawer) {
    // ESC p 0 25 250 (Pulse cash drawer pin 2)
    headerCommands.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  // GS v 0 m xL xH yL yH (Print raster bit image)
  headerCommands.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  const footerCommands: number[] = [
    0x1b, 0x64, 0x04, // ESC d 4 (Feed 4 lines)
    0x1d, 0x56, 0x42, 0x00, // GS V 66 0 (Partial paper cut)
  ];

  const finalPacket = new Uint8Array(
    headerCommands.length + bitmapBytes.length + footerCommands.length,
  );
  finalPacket.set(headerCommands, 0);
  finalPacket.set(bitmapBytes, headerCommands.length);
  finalPacket.set(footerCommands, headerCommands.length + bitmapBytes.length);

  return finalPacket;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  OrderType,
  UserRole,
  RealtimeEvent,
  validateOrderStateTransition,
  computeTicketSla,
  validateModifierSelections,
  calculateZeroTrustOrderTotals,
  calculateHaversineDistanceKm,
  calculateRestaurantRoi,
  packMonochromePixelsToEscPosBytes,
} from './domain-rules';

test('Order State Machine validates allowed roles and cancellation reason', () => {
  // Valid transition: ACCEPTED -> PREPARING by KITCHEN_STAFF
  const prepRes = validateOrderStateTransition(
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    UserRole.KITCHEN_STAFF,
  );
  assert.equal(prepRes.valid, true);
  assert.equal(prepRes.event, RealtimeEvent.ORDER_PREPARING);

  // Invalid role: WAITER cannot move ACCEPTED -> PREPARING
  const invalidRoleRes = validateOrderStateTransition(
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    UserRole.WAITER,
  );
  assert.equal(invalidRoleRes.valid, false);

  // Cancellation requires reason
  const cancelWithoutReason = validateOrderStateTransition(
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
    UserRole.CUSTOMER,
    '',
  );
  assert.equal(cancelWithoutReason.valid, false);

  const cancelWithReason = validateOrderStateTransition(
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
    UserRole.CUSTOMER,
    'تغيير رأي الزبون قبل التأكيد',
  );
  assert.equal(cancelWithReason.valid, true);
  assert.equal(cancelWithReason.event, RealtimeEvent.ORDER_CANCELLED);
});

test('KDS SLA timer classifies FRESH (<5m), WARNING (5-10m), and CRITICAL (>=10m)', () => {
  const now = 1_700_000_000_000;
  const fresh = computeTicketSla(now - 2 * 60 * 1000 - 15 * 1000, now);
  assert.equal(fresh.level, 'FRESH');
  assert.equal(fresh.formattedClock, '02:15');

  const warning = computeTicketSla(now - 6 * 60 * 1000 - 5 * 1000, now);
  assert.equal(warning.level, 'WARNING');
  assert.equal(warning.formattedClock, '06:05');

  const critical = computeTicketSla(now - 11 * 60 * 1000 - 40 * 1000, now);
  assert.equal(critical.level, 'CRITICAL');
  assert.equal(critical.formattedClock, '11:40');
});

test('Modifiers validator and Zero-Trust pricing engine enforce constraints', () => {
  const groups = [
    {
      id: 'grp-doneness',
      name: 'درجة الاستواء',
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'opt-med', name: 'ميديوم', priceDelta: 0, isAvailable: true },
      ],
    },
  ];

  assert.equal(validateModifierSelections(groups, {}).valid, false);
  assert.equal(validateModifierSelections(groups, { 'grp-doneness': ['opt-med'] }).valid, true);

  const totals = calculateZeroTrustOrderTotals(
    [{ unitBasePrice: 85, modifiersTotal: 10, quantity: 2, isAvailable: true }],
    15,
    OrderType.DINE_IN,
    20,
  );
  assert.equal(totals.subtotal, 190);
  assert.equal(totals.taxAmount, 28.5);
  assert.equal(totals.deliveryFee, 0);
  assert.equal(totals.totalAmount, 218.5);
});

test('Haversine distance and Restaurant ROI equations compute accurate results', () => {
  const distKm = calculateHaversineDistanceKm(33.5731, -7.5898, 33.5892, -7.6114);
  assert.equal(distKm > 1.5 && distKm < 3.5, true);

  const roi = calculateRestaurantRoi({
    monthlyAggregatorOrders: 1000,
    averageOrderValue: 100,
    aggregatorCommissionPercent: 25,
    directConversionPercent: 25,
    saasMonthlyFee: 450,
    tablesCount: 15,
    peakHoursPerDay: 4,
    currentTableDurationMins: 60,
    savedMinutesPerTable: 14,
    tableAverageOrderValue: 120,
  });

  // 1000 * 100 * 0.25 * 0.25 - 450 = 6250 - 450 = 5800
  assert.equal(roi.monthlyCommissionSavedNet, 5800);
  assert.equal(roi.newTableDurationMins, 46);
  assert.equal(roi.additionalDailyTablesServed > 15, true);
});

test('1-Bit Monochrome ESC/POS packer frames GS v 0 command and packs 576 dots into 72 bytes per row', () => {
  const widthDots = 576;
  const heightDots = 2;
  const luminanceGrid = new Uint8Array(widthDots * heightDots).fill(255); // all white
  // Make first 8 pixels of row 0 black (luminance = 0 -> byte 0xFF)
  for (let i = 0; i < 8; i++) {
    luminanceGrid[i] = 0;
  }

  const packet = packMonochromePixelsToEscPosBytes(luminanceGrid, widthDots, heightDots, true);
  // Header with cash drawer = 2 (ESC @) + 3 (ESC a 1) + 5 (ESC p) + 8 (GS v 0) = 18 bytes
  // Bitmap = 72 * 2 = 144 bytes
  // Footer = 7 bytes
  assert.equal(packet.length, 18 + 144 + 7);
  // Check GS v 0 header at index 10..13 (0x1d, 0x76, 0x30, 0x00)
  assert.equal(packet[10], 0x1d);
  assert.equal(packet[11], 0x76);
  assert.equal(packet[12], 0x30);
  assert.equal(packet[13], 0x00);
  // xL = 72
  assert.equal(packet[14], 72);
  // First byte of bitmap should be 0xFF (8 black dots)
  assert.equal(packet[18], 0xff);
  // Second byte of bitmap should be 0x00 (8 white dots)
  assert.equal(packet[19], 0x00);
});

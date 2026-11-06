import {
  ModifierGroupDef,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from './domain-rules';

export interface MenuCategory {
  id: string;
  name: string;
}

export interface CatalogMenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  basePrice: number;
  calories: number;
  prepTimeMins: number;
  imageUrl: string;
  allergens: string[];
  isAvailable: boolean;
  modifierGroups: ModifierGroupDef[];
}

export interface LiveOrderSubItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: string[];
  allergyOrSpecialNote?: string;
  isPrepared: boolean;
}

export interface LiveOrderTicket {
  id: string;
  orderNumber: number;
  idempotencyKey: string;
  streamEventId: string;
  orderType: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryDistanceKm?: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  acceptedAtMs: number;
  acknowledgedByKds: boolean;
  items: LiveOrderSubItem[];
}

export interface WaiterCallTicket {
  id: string;
  tableNumber: string;
  callTypeLabel: string;
  createdAtFormatted: string;
  status: 'PENDING' | 'RESOLVED';
}

export interface TenantRecord {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  branchesCount: number;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  monthlyOrders: number;
  taxRate: number;
  currency: string;
}

export const INITIAL_CATEGORIES: MenuCategory[] = [
  { id: 'cat-burgers', name: 'البرجر المشوي' },
  { id: 'cat-pizzas', name: 'البيتزا الإيطالية' },
  { id: 'cat-sides', name: 'المقبلات والبطاطس' },
  { id: 'cat-drinks', name: 'المشروبات الباردة' },
];

export const INITIAL_CATALOG_ITEMS: CatalogMenuItem[] = [
  {
    id: 'item-wagyu-1',
    categoryId: 'cat-burgers',
    categoryName: 'البرجر المشوي',
    name: 'برجر واغيو ترافل المدخن',
    description:
      'شريحتان من لحم الواغيو الفاخر 180غ، جبنة شيدر معتقة، صوص الكمأة الأسود، وبصل مكرمل في خبز البريوش الطازج.',
    basePrice: 85.0,
    calories: 780,
    prepTimeMins: 12,
    imageUrl: '/src/assets/images/wagyu_truffle_burger_1793984474739.jpg',
    allergens: ['غلوتين', 'ألبان'],
    isAvailable: true,
    modifierGroups: [
      {
        id: 'grp-doneness',
        name: 'درجة الاستواء (إلزامي)',
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: 'opt-med', name: 'ميديوم (متوسط العصارة)', priceDelta: 0, isAvailable: true },
          { id: 'opt-med-well', name: 'ميديوم ويل (ناضج متوازن)', priceDelta: 0, isAvailable: true },
          { id: 'opt-well', name: 'ويل دن (مستوي بالكامل)', priceDelta: 0, isAvailable: true },
        ],
      },
      {
        id: 'grp-extras',
        name: 'إضافات خاصة على البرجر (اختياري - حتى خيارين)',
        minSelect: 0,
        maxSelect: 2,
        options: [
          { id: 'opt-extra-patty', name: 'شريحة لحم واغيو إضافية 90غ', priceDelta: 28, isAvailable: true },
          { id: 'opt-cheese', name: 'شريحة جبنة شيدر سويسرية', priceDelta: 10, isAvailable: true },
          { id: 'opt-bacon', name: 'بيكون بقري مقرمش حلال', priceDelta: 15, isAvailable: true },
          { id: 'opt-jalapeno', name: 'هالابينو مكسيكي حار', priceDelta: 6, isAvailable: true },
        ],
      },
      {
        id: 'grp-removals',
        name: 'استثناءات المكونات (مجاناً)',
        minSelect: 0,
        maxSelect: 3,
        options: [
          { id: 'opt-no-onion', name: 'بدون بصل مكرمل', priceDelta: 0, isAvailable: true },
          { id: 'opt-no-sauce', name: 'بدون صوص الترافل', priceDelta: 0, isAvailable: true },
          { id: 'opt-no-pickles', name: 'بدون مخلل', priceDelta: 0, isAvailable: true },
        ],
      },
    ],
  },
  {
    id: 'item-chicken-2',
    categoryId: 'cat-burgers',
    categoryName: 'البرجر المشوي',
    name: 'كرسبي تشيكن ناشفيل الحار',
    description:
      'صدر دجاج مقرمش متبل بخلطة ناشفيل الحارة، سلطة كول سلو منزلية، ومخلل ديل في خبز البريوش المحمص.',
    basePrice: 62.0,
    calories: 640,
    prepTimeMins: 10,
    imageUrl: '/src/assets/images/nashville_crispy_chicken_1793984475449.jpg',
    allergens: ['غلوتين', 'بيض'],
    isAvailable: true,
    modifierGroups: [
      {
        id: 'grp-spice',
        name: 'مستوى الحرارة (إلزامي)',
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: 'opt-mild', name: 'معتدل (Mild)', priceDelta: 0, isAvailable: true },
          { id: 'opt-hot', name: 'حار (Nashville Hot)', priceDelta: 0, isAvailable: true },
          { id: 'opt-fire', name: 'ناري جداً (Extra Fire)', priceDelta: 5, isAvailable: true },
        ],
      },
    ],
  },
  {
    id: 'item-pizza-1',
    categoryId: 'cat-pizzas',
    categoryName: 'البيتزا الإيطالية',
    name: 'بيتزا مارغريتا نابوليتانا على الحطب',
    description:
      'صلصة طماطم سان مارزانو الإيطالية، جبنة موزاريلا بافالو الطازجة، أوراق الريحان وزيت الزيتون البكر.',
    basePrice: 70.0,
    calories: 820,
    prepTimeMins: 14,
    imageUrl: '/src/assets/images/neapolitan_margherita_pizza_1793984475734.jpg',
    allergens: ['غلوتين', 'ألبان'],
    isAvailable: true,
    modifierGroups: [],
  },
  {
    id: 'item-fries-1',
    categoryId: 'cat-sides',
    categoryName: 'المقبلات والبطاطس',
    name: 'بطاطس ترافل بارميزان',
    description:
      'بطاطس مقلية مقرمشة متبلة بزيت الكمأة الأبيض وجبنة البارميزان المبشورة وأعشاب البقدونس.',
    basePrice: 32.0,
    calories: 450,
    prepTimeMins: 6,
    imageUrl: '/src/assets/images/truffle_parmesan_fries_1793984476860.jpg',
    allergens: ['ألبان'],
    isAvailable: true,
    modifierGroups: [],
  },
  {
    id: 'item-drink-1',
    categoryId: 'cat-drinks',
    categoryName: 'المشروبات الباردة',
    name: 'موهيتو باشن فروت منعش',
    description:
      'فاكهة الباشن الاستوائية الطازجة مع أوراق النعناع والليمون الأخضر والمياه الغازية الباردة.',
    basePrice: 26.0,
    calories: 140,
    prepTimeMins: 3,
    imageUrl: '/src/assets/images/passion_fruit_mojito_1793984477820.jpg',
    allergens: [],
    isAvailable: true,
    modifierGroups: [],
  },
];

export function createInitialOrders(baseNowMs: number): LiveOrderTicket[] {
  return [
    {
      id: 'ord-101',
      orderNumber: 101,
      idempotencyKey: 'idem_table12_101',
      streamEventId: '1793984100000-0',
      orderType: OrderType.DINE_IN,
      tableNumber: '12',
      status: OrderStatus.PREPARING,
      paymentMethod: PaymentMethod.POS_CARD,
      subtotal: 222.0,
      taxAmount: 22.2,
      deliveryFee: 0,
      totalAmount: 244.2,
      acceptedAtMs: baseNowMs - (11 * 60 + 25) * 1000, // > 10 mins (CRITICAL RED)
      acknowledgedByKds: true,
      items: [
        {
          id: 'line-101-1',
          menuItemId: 'item-wagyu-1',
          name: 'برجر واغيو ترافل المدخن',
          quantity: 2,
          unitPrice: 95.0,
          lineTotal: 190.0,
          modifiers: ['درجة الاستواء: ميديوم', '+ شريحة جبنة شيدر سويسرية', 'بدون بصل مكرمل'],
          allergyOrSpecialNote: 'تنبيه حساسية شديدة: حساسية من الفول السوداني والسمسم!',
          isPrepared: false,
        },
        {
          id: 'line-101-2',
          menuItemId: 'item-fries-1',
          name: 'بطاطس ترافل بارميزان',
          quantity: 1,
          unitPrice: 32.0,
          lineTotal: 32.0,
          modifiers: [],
          isPrepared: true,
        },
      ],
    },
    {
      id: 'ord-102',
      orderNumber: 102,
      idempotencyKey: 'idem_pickup_102',
      streamEventId: '1793984250000-0',
      orderType: OrderType.PICKUP,
      customerName: 'يوسف العلوي',
      customerPhone: '0661-482910',
      status: OrderStatus.PREPARING,
      paymentMethod: PaymentMethod.ONLINE_CARD,
      subtotal: 201.0,
      taxAmount: 20.1,
      deliveryFee: 0,
      totalAmount: 221.1,
      acceptedAtMs: baseNowMs - (6 * 60 + 40) * 1000, // 5-10 mins (WARNING AMBER)
      acknowledgedByKds: true,
      items: [
        {
          id: 'line-102-1',
          menuItemId: 'item-chicken-2',
          name: 'كرسبي تشيكن ناشفيل الحار',
          quantity: 3,
          unitPrice: 67.0,
          lineTotal: 201.0,
          modifiers: ['مستوى الحرارة: ناري جداً (Extra Fire)'],
          isPrepared: false,
        },
      ],
    },
    {
      id: 'ord-103',
      orderNumber: 103,
      idempotencyKey: 'idem_table04_103',
      streamEventId: '1793984390000-0',
      orderType: OrderType.DINE_IN,
      tableNumber: '04',
      status: OrderStatus.ACCEPTED,
      paymentMethod: PaymentMethod.CASH,
      subtotal: 122.0,
      taxAmount: 12.2,
      deliveryFee: 0,
      totalAmount: 134.2,
      acceptedAtMs: baseNowMs - (2 * 60 + 10) * 1000, // < 5 mins (FRESH GREEN)
      acknowledgedByKds: true,
      items: [
        {
          id: 'line-103-1',
          menuItemId: 'item-pizza-1',
          name: 'بيتزا مارغريتا نابوليتانا على الحطب',
          quantity: 1,
          unitPrice: 70.0,
          lineTotal: 70.0,
          modifiers: [],
          allergyOrSpecialNote: 'يرجى تقطيعها إلى 8 قطع متساوية للأطفال',
          isPrepared: false,
        },
        {
          id: 'line-103-2',
          menuItemId: 'item-drink-1',
          name: 'موهيتو باشن فروت منعش',
          quantity: 2,
          unitPrice: 26.0,
          lineTotal: 52.0,
          modifiers: [],
          isPrepared: false,
        },
      ],
    },
  ];
}

export const INITIAL_WAITER_CALLS: WaiterCallTicket[] = [
  {
    id: 'wc-1',
    tableNumber: '08',
    callTypeLabel: 'طلب الفاتورة — جهاز البطاقة البنكية (POS)',
    createdAtFormatted: 'منذ دقيقتين',
    status: 'PENDING',
  },
  {
    id: 'wc-2',
    tableNumber: '12',
    callTypeLabel: 'استدعاء النادل للمساعدة على الطاولة',
    createdAtFormatted: 'منذ 4 دقائق',
    status: 'PENDING',
  },
];

export const INITIAL_TENANTS: TenantRecord[] = [
  {
    id: 'ten-1',
    slug: 'gourmet-bistro',
    nameAr: 'مطعم الذواقة الحديث',
    nameEn: 'Gourmet Modern Bistro',
    branchesCount: 3,
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    monthlyOrders: 4820,
    taxRate: 10,
    currency: 'د.م.',
  },
  {
    id: 'ten-2',
    slug: 'atlas-specialty-coffee',
    nameAr: 'مقهى أطلس المختص',
    nameEn: 'Atlas Specialty Coffee',
    branchesCount: 2,
    plan: 'GROWTH',
    status: 'ACTIVE',
    monthlyOrders: 3150,
    taxRate: 10,
    currency: 'د.م.',
  },
  {
    id: 'ten-3',
    slug: 'casablanca-wood-pizza',
    nameAr: 'نابولي بيتزا الحطب',
    nameEn: 'Napoli Wood-Fired Pizza',
    branchesCount: 1,
    plan: 'STARTER',
    status: 'TRIAL',
    monthlyOrders: 890,
    taxRate: 10,
    currency: 'د.م.',
  },
];

export const BACKEND_ARCHITECTURE_SNIPPETS: Record<
  'RLS_PRISMA' | 'ORDERS_SERVICE' | 'KDS_REDIS_STREAMS' | 'TCP_THERMAL_BRIDGE',
  { title: string; subtitle: string; filename: string; code: string }
> = {
  RLS_PRISMA: {
    title: 'عزل المطاعم الصارم (PostgreSQL RLS + Prisma Extension)',
    subtitle: 'يحقن tenant_id تلقائياً في كل Transaction لمنع تسرب البيانات بين المطاعم المشتركة',
    filename: 'apps/api-server/src/common/prisma/prisma.service.ts',
    code: `-- PostgreSQL Row-Level Security Policy (migration.sql)
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "Order"
  FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

// Prisma Client Extension in NestJS
const [, result] = await baseClient.$transaction([
  baseClient.$executeRaw\`
    SELECT set_config('app.current_tenant_id', \${tenantId}, true)
  \`,
  query(args),
]);`,
  },
  ORDERS_SERVICE: {
    title: 'محرك التسعير الصفري ومنع التكرار (Zero-Trust Pricing + Idempotency)',
    subtitle: 'يعيد حساب أسعار الأطباق والإضافات والضرائب في الخادم ويتحقق من عدم نفاد الصنف (86ing)',
    filename: 'apps/api-server/src/modules/orders/orders.service.ts',
    code: `// 1. Idempotency Check (منع تكرار الطلب عند ضعف تغطية الهاتف)
const existing = await this.prisma.rlsClient.order.findUnique({
  where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
});
if (existing) return existing;

// 2. Server-Side Zero-Trust Pricing & 86ing Verification
for (const reqItem of dto.items) {
  const dbItem = menuItemMap.get(reqItem.menuItemId);
  if (!dbItem?.isAvailable) {
    throw new ConflictException(\`عذراً، نفدت كمية "\${dbItem?.name.ar}" للتو.\`);
  }
  const lineTotal = dbItem.basePrice.add(unitModifiersTotal).mul(reqItem.quantity);
  subtotal = subtotal.add(lineTotal);
}`,
  },
  KDS_REDIS_STREAMS: {
    title: 'بث المطبخ الحي واسترجاع الطلبات الفائتة (Socket.IO + Redis Streams)',
    subtitle: 'يحفظ كل طلب في Redis Stream (XADD) ويعيد بث الطلبات الفائتة (XRANGE) فور عودة الإنترنت',
    filename: 'apps/api-server/src/modules/kds-gateway/kds.gateway.ts',
    code: `// حفظ الطلب في Redis Stream وبثه لغرفة الفرع
const streamEventId = await this.redis.xadd(
  \`stream:tenant:\${tenantId}:branch:\${branchId}:orders\`,
  'MAXLEN', '~', 1000, '*',
  'orderId', String(orderPayload.id),
  'payload', JSON.stringify(orderPayload),
);
this.server.to(\`tenant_\${tenantId}_branch_\${branchId}_kds\`).emit('kds:new_order', {
  streamEventId,
  order: orderPayload,
});

// استرجاع الطلبات الفائتة عند إعادة اتصال شاشة المطبخ
const missedEntries = await this.redis.xrange(streamKey, \`(\${lastReceivedStreamId}\`, '+', 'COUNT', 200);`,
  },
  TCP_THERMAL_BRIDGE: {
    title: 'جسر الطباعة الحرارية الشبكية (TCP Port 9100 Raw Socket Bridge)',
    subtitle: 'يرسل مصفوفة ESC/POS النقطية (GS v 0) مباشرة للطابعة الحرارية عبر الشبكة المحلية ويغلق الاتصال فوراً',
    filename: 'apps/api-server/src/modules/printing/tcp-thermal.service.ts',
    code: `import * as net from 'net';

export async function sendEscPosToNetworkPrinter(
  printerIp: string,
  printerPort = 9100,
  escPosBuffer: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);
    socket.connect(printerPort, printerIp, () => {
      socket.write(escPosBuffer, (err) => {
        socket.end();
        socket.destroy();
        if (err) return reject(err);
        resolve();
      });
    });
  });
}`,
  },
};

import React, { useState, useEffect } from 'react';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  calculateZeroTrustOrderTotals,
} from './lib/domain-rules';
import {
  CartLineItem,
  loadCustomerSession,
  saveCustomerSession,
} from './lib/customer-idb';
import {
  CatalogMenuItem,
  INITIAL_CATEGORIES,
  INITIAL_CATALOG_ITEMS,
  INITIAL_TENANTS,
  INITIAL_WAITER_CALLS,
  LiveOrderTicket,
  TenantRecord,
  WaiterCallTicket,
  createInitialOrders,
} from './lib/seed-data';
import { CustomerPwaView } from './components/CustomerPwaView';
import { KdsScreenView } from './components/KdsScreenView';
import { MerchantPosView } from './components/MerchantPosView';
import { SuperAdminView } from './components/SuperAdminView';

type ActiveModuleView = 'CUSTOMER_PWA' | 'KDS_SCREEN' | 'MERCHANT_POS' | 'SUPER_ADMIN';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveModuleView>('CUSTOMER_PWA');

  // Shared Multi-Tenant State
  const [tenants, setTenants] = useState<TenantRecord[]>(INITIAL_TENANTS);
  const [activeTenantId, setActiveTenantId] = useState<string>(INITIAL_TENANTS[0].id);

  const activeTenant =
    tenants.find((t) => t.id === activeTenantId) || tenants[0];

  // Shared Catalog State (with real-time 86ing across KDS & Customer PWA)
  const [catalogItems, setCatalogItems] = useState<CatalogMenuItem[]>(
    INITIAL_CATALOG_ITEMS,
  );

  // Customer Session State (Table # from ?table=12 + IndexedDB persistence)
  const [tableNumber, setTableNumber] = useState<string>('12');
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Live Orders & Waiter Calls State
  const [orders, setOrders] = useState<LiveOrderTicket[]>(() =>
    createInitialOrders(Date.now()),
  );
  const [waiterCalls, setWaiterCalls] =
    useState<WaiterCallTicket[]>(INITIAL_WAITER_CALLS);

  // Hydrate customer session from URL ?table=12 and IndexedDB
  useEffect(() => {
    async function initCustomerSession() {
      const params = new URLSearchParams(window.location.search);
      const urlTable = params.get('table');
      const saved = await loadCustomerSession(activeTenant.slug);

      const resolvedTable = urlTable || saved?.tableNumber || '12';
      const resolvedOrderType = saved?.orderType || OrderType.DINE_IN;
      const resolvedCart = saved?.cart || [];

      setTableNumber(resolvedTable);
      setOrderType(resolvedOrderType);
      setCart(resolvedCart);
      setIsHydrated(true);

      await saveCustomerSession({
        tenantSlug: activeTenant.slug,
        tableNumber: resolvedTable,
        orderType: resolvedOrderType,
        cart: resolvedCart,
        updatedAt: Date.now(),
      });
    }
    initCustomerSession();
  }, [activeTenant.slug]);

  useEffect(() => {
    if (!isHydrated) return;
    saveCustomerSession({
      tenantSlug: activeTenant.slug,
      tableNumber,
      orderType,
      cart,
      updatedAt: Date.now(),
    });
  }, [cart, tableNumber, orderType, activeTenant.slug, isHydrated]);

  // Create & Dispatch Order (Zero-Trust Pricing + Idempotency + KDS Broadcast)
  const handleCreateOrder = (payload: {
    orderType: OrderType;
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryDistanceKm?: number;
    paymentMethod: PaymentMethod;
  }): LiveOrderTicket | null => {
    if (cart.length === 0) return null;

    const pricing = calculateZeroTrustOrderTotals(
      cart.map((c) => ({
        unitBasePrice: c.unitBasePrice,
        modifiersTotal: c.modifiersTotal,
        quantity: c.quantity,
        isAvailable: true,
      })),
      activeTenant.taxRate,
      payload.orderType,
      15,
    );

    const nextOrderNum =
      orders.reduce((max, o) => Math.max(max, o.orderNumber), 100) + 1;
    const now = Date.now();

    const newTicket: LiveOrderTicket = {
      id: `ord-${nextOrderNum}`,
      orderNumber: nextOrderNum,
      idempotencyKey: `idem_${activeTenant.slug}_${nextOrderNum}_${now}`,
      streamEventId: `${now}-0`,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      deliveryDistanceKm: payload.deliveryDistanceKm,
      status: OrderStatus.ACCEPTED,
      paymentMethod: payload.paymentMethod,
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
      acceptedAtMs: now,
      acknowledgedByKds: true,
      items: cart.map((line, idx) => ({
        id: `line-${nextOrderNum}-${idx + 1}`,
        menuItemId: line.menuItemId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitFinalPrice,
        lineTotal: line.lineTotal,
        modifiers: line.selectedModifiers.map((m) => m.optionName),
        allergyOrSpecialNote: line.specialNotes || undefined,
        isPrepared: false,
      })),
    };

    setOrders((prev) => [newTicket, ...prev]);
    setCart([]);
    return newTicket;
  };

  // KDS Sub-item prepared toggle
  const handleToggleSubItemPrepared = (orderId: string, subItemId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          items: ord.items.map((it) =>
            it.id === subItemId ? { ...it, isPrepared: !it.isPrepared } : it,
          ),
        };
      }),
    );
  };

  // Advance Order Lifecycle Status
  const handleAdvanceOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, status: nextStatus } : ord,
      ),
    );
  };

  // One-Tap 86ing Toggle
  const handleToggleItem86Status = (menuItemId: string) => {
    setCatalogItems((prev) =>
      prev.map((item) =>
        item.id === menuItemId
          ? { ...item, isAvailable: !item.isAvailable }
          : item,
      ),
    );
  };

  // Simulate Redis Stream XRANGE Missed Order Recovery
  const handleSimulateRedisStreamRecovery = () => {
    const nextOrderNum =
      orders.reduce((max, o) => Math.max(max, o.orderNumber), 100) + 1;
    const now = Date.now();
    const recoveredTicket: LiveOrderTicket = {
      id: `ord-${nextOrderNum}`,
      orderNumber: nextOrderNum,
      idempotencyKey: `idem_recovered_${nextOrderNum}`,
      streamEventId: `${now}-0`,
      orderType: OrderType.DINE_IN,
      tableNumber: '15',
      status: OrderStatus.ACCEPTED,
      paymentMethod: PaymentMethod.POS_CARD,
      subtotal: 117.0,
      taxAmount: 11.7,
      deliveryFee: 0,
      totalAmount: 128.7,
      acceptedAtMs: now - 90 * 1000,
      acknowledgedByKds: true,
      items: [
        {
          id: `line-${nextOrderNum}-1`,
          menuItemId: 'item-wagyu-1',
          name: 'برجر واغيو ترافل المدخن',
          quantity: 1,
          unitPrice: 85.0,
          lineTotal: 85.0,
          modifiers: ['درجة الاستواء: ميديوم ويل'],
          allergyOrSpecialNote: 'تم استرجاع التذكرة تلقائياً عبر Redis Streams XRANGE بعد عودة الشبكة',
          isPrepared: false,
        },
        {
          id: `line-${nextOrderNum}-2`,
          menuItemId: 'item-fries-1',
          name: 'بطاطس ترافل بارميزان',
          quantity: 1,
          unitPrice: 32.0,
          lineTotal: 32.0,
          modifiers: [],
          isPrepared: false,
        },
      ],
    };
    setOrders((prev) => [recoveredTicket, ...prev]);
  };

  // Trigger Waiter Call from Customer PWA
  const handleTriggerWaiterCall = (callTypeLabel: string) => {
    const newCall: WaiterCallTicket = {
      id: `wc-${Date.now()}`,
      tableNumber,
      callTypeLabel,
      createdAtFormatted: 'الآن',
      status: 'PENDING',
    };
    setWaiterCalls((prev) => [newCall, ...prev]);
  };

  // Resolve Waiter Call in POS
  const handleResolveWaiterCall = (callId: string) => {
    setWaiterCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, status: 'RESOLVED' } : c)),
    );
  };

  // Super Admin Kill-Switch Toggle
  const handleToggleTenantKillSwitch = (tenantId: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              status: t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
            }
          : t,
      ),
    );
  };

  const handleAddTenant = (newTenant: Omit<TenantRecord, 'id' | 'monthlyOrders'>) => {
    const created: TenantRecord = {
      ...newTenant,
      id: `ten-${Date.now()}`,
      monthlyOrders: 0,
    };
    setTenants((prev) => [...prev, created]);
  };

  const activeKitchenCount = orders.filter(
    (o) => o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.PREPARING,
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zones (1: Single Brand Wordmark, 2: 4 Single-line Nav Links, 3: 1 Primary Action) */}
      <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('CUSTOMER_PWA');
          }}
          className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Smart Menu SaaS
        </a>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav
          aria-label="التنقل بين واجهات النظام"
          className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            onClick={() => setActiveView('CUSTOMER_PWA')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'CUSTOMER_PWA'
                ? 'text-orange-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            واجهة الزبون (PWA)
          </button>

          <button
            type="button"
            onClick={() => setActiveView('KDS_SCREEN')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'KDS_SCREEN'
                ? 'text-orange-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            شاشة المطبخ ({activeKitchenCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveView('MERCHANT_POS')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'MERCHANT_POS'
                ? 'text-orange-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            الكاشير والطباعة الحرارية
          </button>

          <button
            type="button"
            onClick={() => setActiveView('SUPER_ADMIN')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'SUPER_ADMIN'
                ? 'text-orange-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            الإدارة العليا والجدوى
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() =>
              setActiveView(
                activeView === 'KDS_SCREEN' ? 'MERCHANT_POS' : 'KDS_SCREEN',
              )
            }
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            {activeView === 'KDS_SCREEN'
              ? 'معاينة الفاتورة الحرارية'
              : `فتح شاشة المطبخ (${activeKitchenCount})`}
          </button>
        </div>
      </header>

      {/* Active Workspace Viewport */}
      <main className="flex-1">
        {activeView === 'CUSTOMER_PWA' && (
          <CustomerPwaView
            tenant={activeTenant}
            categories={INITIAL_CATEGORIES}
            catalogItems={catalogItems}
            tableNumber={tableNumber}
            onChangeTableNumber={setTableNumber}
            orderType={orderType}
            onChangeOrderType={setOrderType}
            cart={cart}
            onUpdateCart={setCart}
            orders={orders}
            onSubmitOrder={handleCreateOrder}
            onTriggerWaiterCall={handleTriggerWaiterCall}
            onSwitchToKds={() => setActiveView('KDS_SCREEN')}
          />
        )}

        {activeView === 'KDS_SCREEN' && (
          <KdsScreenView
            orders={orders}
            catalogItems={catalogItems}
            onToggleSubItemPrepared={handleToggleSubItemPrepared}
            onAdvanceOrderStatus={handleAdvanceOrderStatus}
            onToggleItem86Status={handleToggleItem86Status}
            onSimulateRedisStreamRecovery={handleSimulateRedisStreamRecovery}
          />
        )}

        {activeView === 'MERCHANT_POS' && (
          <MerchantPosView
            tenant={activeTenant}
            orders={orders}
            waiterCalls={waiterCalls}
            onAdvanceOrderStatus={handleAdvanceOrderStatus}
            onResolveWaiterCall={handleResolveWaiterCall}
          />
        )}

        {activeView === 'SUPER_ADMIN' && (
          <SuperAdminView
            tenants={tenants}
            activeTenantId={activeTenantId}
            onSelectActiveTenant={(id) => {
              setActiveTenantId(id);
              setActiveView('CUSTOMER_PWA');
            }}
            onToggleTenantKillSwitch={handleToggleTenantKillSwitch}
            onAddTenant={handleAddTenant}
          />
        )}
      </main>
    </div>
  );
}

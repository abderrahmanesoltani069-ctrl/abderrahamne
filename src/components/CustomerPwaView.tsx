import React, { useState, useMemo } from 'react';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  validateModifierSelections,
  calculateZeroTrustOrderTotals,
  calculateHaversineDistanceKm,
} from '../lib/domain-rules';
import {
  CartLineItem,
  SelectedModifierItem,
} from '../lib/customer-idb';
import {
  CatalogMenuItem,
  LiveOrderTicket,
  MenuCategory,
  TenantRecord,
} from '../lib/seed-data';

interface CustomerPwaViewProps {
  tenant: TenantRecord;
  categories: MenuCategory[];
  catalogItems: CatalogMenuItem[];
  tableNumber: string;
  onChangeTableNumber: (table: string) => void;
  orderType: OrderType;
  onChangeOrderType: (type: OrderType) => void;
  cart: CartLineItem[];
  onUpdateCart: (nextCart: CartLineItem[]) => void;
  orders: LiveOrderTicket[];
  onSubmitOrder: (payload: {
    orderType: OrderType;
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryDistanceKm?: number;
    paymentMethod: PaymentMethod;
  }) => LiveOrderTicket | null;
  onTriggerWaiterCall: (callTypeLabel: string) => void;
  onSwitchToKds: () => void;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, { title: string; desc: string; step: number }> = {
  [OrderStatus.PENDING]: {
    title: 'بانتظار التأكيد',
    desc: 'تم إرسال طلبك للكاشير وبانتظار الاعتماد اللحظي',
    step: 1,
  },
  [OrderStatus.ACCEPTED]: {
    title: 'تم القبول وأُرسل للمطبخ',
    desc: 'استلمت شاشة المطبخ (KDS) تذكرتك وبدأت الجدولة',
    step: 2,
  },
  [OrderStatus.PREPARING]: {
    title: 'قيد التحضير الساخن الآن',
    desc: 'يقوم الطاهي بتحضير أطباقك الطازجة الآن في المطبخ',
    step: 3,
  },
  [OrderStatus.READY]: {
    title: 'جاهز للتقديم / الاستلام!',
    desc: 'طلبك جاهز على شباك المطبخ وفي طريقه لطاولتك حالاً',
    step: 4,
  },
  [OrderStatus.SERVED]: {
    title: 'تم التقديم للطاولة — وجبة شهية',
    desc: 'يمكنك طلب صنف إضافي أو طلب الفاتورة بضغطة واحدة',
    step: 5,
  },
  [OrderStatus.COMPLETED]: {
    title: 'مكتمل ومغلق الفاتورة',
    desc: 'شكراً لزيارتكم، تم إغلاق الفاتورة الضريبية بنجاح',
    step: 6,
  },
  [OrderStatus.CANCELLED]: {
    title: 'طلب ملغى',
    desc: 'تم إلغاء هذا الطلب',
    step: 0,
  },
};

export const CustomerPwaView: React.FC<CustomerPwaViewProps> = ({
  tenant,
  categories,
  catalogItems,
  tableNumber,
  onChangeTableNumber,
  orderType,
  onChangeOrderType,
  cart,
  onUpdateCart,
  orders,
  onSubmitOrder,
  onTriggerWaiterCall,
  onSwitchToKds,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modifiers Bottom Sheet state
  const [customizingItem, setCustomizingItem] = useState<CatalogMenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [itemQty, setItemQty] = useState<number>(1);
  const [specialNotes, setSpecialNotes] = useState<string>('');

  // Checkout / Delivery fields
  const [customerName, setCustomerName] = useState<string>('أمين بنجلون');
  const [customerPhone, setCustomerPhone] = useState<string>('0661-908172');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [customerLat, setCustomerLat] = useState<number>(33.5885);
  const [customerLng, setCustomerLng] = useState<number>(-7.6112);

  // Waiter Call modal & notifications
  const [waiterModalOpen, setWaiterModalOpen] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const branchLat = 33.5731;
  const branchLng = -7.5898;
  const deliveryDistanceKm = useMemo(
    () => calculateHaversineDistanceKm(branchLat, branchLng, customerLat, customerLng),
    [customerLat, customerLng],
  );
  const branchDeliveryFee = 15;

  const showNotice = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  // If tenant is suspended by Super Admin Kill-Switch
  if (tenant.status === 'SUSPENDED') {
    return (
      <div className="max-w-xl mx-auto my-16 bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
        <div className="text-3xl font-bold text-rose-600">الخدمة متوقفة مؤقتاً</div>
        <p className="text-sm text-slate-600 leading-relaxed">
          تم إيقاف استقبال الطلبات الرقمية لـ <strong>{tenant.nameAr}</strong> مؤقتاً من قِبل الإدارة العليا للنظام (Kill-Switch مفعل).
        </p>
      </div>
    );
  }

  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesCat = activeCategoryId === 'ALL' || item.categoryId === activeCategoryId;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.includes(searchQuery.trim()) ||
        item.description.includes(searchQuery.trim());
      return matchesCat && matchesSearch;
    });
  }, [catalogItems, activeCategoryId, searchQuery]);

  // Open modifier modal or direct 1-tap add (3-Click Rule)
  const handleSelectItem = (item: CatalogMenuItem) => {
    if (!item.isAvailable) return;

    if (item.modifierGroups.length === 0) {
      addDirectToCart(item, [], 1, '');
      showNotice(`تمت إضافة "${item.name}" إلى السلة بنقرة واحدة`);
      return;
    }

    const defaults: Record<string, string[]> = {};
    item.modifierGroups.forEach((group) => {
      if (group.minSelect === 1 && group.maxSelect === 1 && group.options.length > 0) {
        const firstAvail = group.options.find((o) => o.isAvailable);
        if (firstAvail) defaults[group.id] = [firstAvail.id];
      } else {
        defaults[group.id] = [];
      }
    });

    setCustomizingItem(item);
    setSelectedOptions(defaults);
    setItemQty(1);
    setSpecialNotes('');
  };

  const toggleModifierOption = (groupId: string, maxSelect: number, optionId: string) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelect) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const modifierValidation = useMemo(() => {
    if (!customizingItem) return { valid: false };
    return validateModifierSelections(customizingItem.modifierGroups, selectedOptions);
  }, [customizingItem, selectedOptions]);

  const currentModalPricing = useMemo(() => {
    if (!customizingItem) return { modifiersTotal: 0, unitFinalPrice: 0, totalLinePrice: 0 };
    let modifiersTotal = 0;
    customizingItem.modifierGroups.forEach((group) => {
      const chosenIds = selectedOptions[group.id] || [];
      group.options.forEach((opt) => {
        if (chosenIds.includes(opt.id)) {
          modifiersTotal += opt.priceDelta;
        }
      });
    });
    const unitFinalPrice = customizingItem.basePrice + modifiersTotal;
    return {
      modifiersTotal,
      unitFinalPrice,
      totalLinePrice: unitFinalPrice * itemQty,
    };
  }, [customizingItem, selectedOptions, itemQty]);

  const addDirectToCart = (
    item: CatalogMenuItem,
    modifiersList: SelectedModifierItem[],
    qty: number,
    notes: string,
  ) => {
    const modifiersTotal = modifiersList.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitFinalPrice = item.basePrice + modifiersTotal;
    const modSignature = modifiersList
      .map((m) => `${m.groupId}:${m.optionId}`)
      .sort()
      .join('|');
    const cartLineId = `${item.id}__${modSignature}__${notes.trim()}`;

    const existingIndex = cart.findIndex((line) => line.cartLineId === cartLineId);
    if (existingIndex > -1) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + qty;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        lineTotal: newQty * unitFinalPrice,
      };
      onUpdateCart(updated);
      return;
    }

    onUpdateCart([
      ...cart,
      {
        cartLineId,
        menuItemId: item.id,
        name: item.name,
        unitBasePrice: item.basePrice,
        modifiersTotal,
        unitFinalPrice,
        quantity: qty,
        lineTotal: qty * unitFinalPrice,
        selectedModifiers: modifiersList,
        specialNotes: notes.trim(),
      },
    ]);
  };

  const confirmCustomizationAndAdd = () => {
    if (!customizingItem || !modifierValidation.valid) return;
    const flatModifiers: SelectedModifierItem[] = [];
    customizingItem.modifierGroups.forEach((group) => {
      const chosenIds = selectedOptions[group.id] || [];
      group.options.forEach((opt) => {
        if (chosenIds.includes(opt.id)) {
          flatModifiers.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      });
    });

    addDirectToCart(customizingItem, flatModifiers, itemQty, specialNotes);
    showNotice(`تمت إضافة "${customizingItem.name}" مع الإضافات إلى السلة`);
    setCustomizingItem(null);
  };

  const updateCartLineQty = (cartLineId: string, delta: number) => {
    const next = cart
      .map((line) => {
        if (line.cartLineId !== cartLineId) return line;
        const nextQty = line.quantity + delta;
        if (nextQty <= 0) return null;
        return {
          ...line,
          quantity: nextQty,
          lineTotal: nextQty * line.unitFinalPrice,
        };
      })
      .filter(Boolean) as CartLineItem[];
    onUpdateCart(next);
  };

  const cartTotals = useMemo(() => {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const pricing = calculateZeroTrustOrderTotals(
      cart.map((c) => ({
        unitBasePrice: c.unitBasePrice,
        modifiersTotal: c.modifiersTotal,
        quantity: c.quantity,
        isAvailable: true,
      })),
      tenant.taxRate,
      orderType,
      branchDeliveryFee,
    );
    return { totalCount, ...pricing };
  }, [cart, tenant.taxRate, orderType]);

  const handleCheckoutSubmit = () => {
    if (cart.length === 0) return;
    if (orderType !== OrderType.DINE_IN && (!customerName.trim() || !customerPhone.trim())) {
      showNotice('يرجى إدخال اسم العميل ورقم الهاتف لإتمام طلب الاستلام أو التوصيل.');
      return;
    }
    const created = onSubmitOrder({
      orderType,
      tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
      customerName: orderType !== OrderType.DINE_IN ? customerName.trim() : undefined,
      customerPhone: orderType !== OrderType.DINE_IN ? customerPhone.trim() : undefined,
      deliveryDistanceKm: orderType === OrderType.DELIVERY ? deliveryDistanceKm : undefined,
      paymentMethod,
    });
    if (created) {
      showNotice(
        `تم إرسال الطلب رقم #${created.orderNumber} فوراً لشاشة المطبخ (KDS) بنجاح!`,
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Live Feedback Notification */}
      {feedbackBanner && (
        <div
          role="status"
          className="bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium shadow-md"
        >
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-300 hover:text-white text-xs font-semibold px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Top Restaurant Context & Order Mode Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{tenant.nameEn}</span>
            <span aria-hidden="true">·</span>
            <span>ضريبة القيمة المضافة {tenant.taxRate}%</span>
            <span aria-hidden="true">·</span>
            <span>تزامن لحظي عبر IndexedDB</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 whitespace-nowrap">
            {tenant.nameAr} — القائمة التفاعلية
          </h1>
        </div>

        {/* Order Mode Switcher (Dine-in QR / Pickup / Direct Delivery) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => onChangeOrderType(OrderType.DINE_IN)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                orderType === OrderType.DINE_IN
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              داخل المطعم (QR طاولة)
            </button>
            <button
              type="button"
              onClick={() => onChangeOrderType(OrderType.PICKUP)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                orderType === OrderType.PICKUP
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              استلام ذاتي (Pickup)
            </button>
            <button
              type="button"
              onClick={() => onChangeOrderType(OrderType.DELIVERY)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                orderType === OrderType.DELIVERY
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              توصيل مباشر (0% عمولة)
            </button>
          </div>

          {orderType === OrderType.DINE_IN && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
              <label htmlFor="table-select" className="text-xs font-semibold text-orange-900">
                طاولة رقم:
              </label>
              <select
                id="table-select"
                value={tableNumber}
                onChange={(e) => onChangeTableNumber(e.target.value)}
                className="bg-white border border-orange-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 tabular-nums"
              >
                <option value="12">#12 (الجناح الداخلي)</option>
                <option value="04">#04 (التراس الخارجي)</option>
                <option value="08">#08 (العائلات)</option>
                <option value="15">#15 (الركن الهادئ)</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setWaiterModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            استدعاء النادل / طلب الفاتورة
          </button>
        </div>
      </section>

      {/* Main 12-Column Responsive Workspace: 8 Cols Menu Grid + 4 Cols Cart & Live Order Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right 8 Columns: Category Filter & Menu Items */}
        <div className="lg:col-span-8 space-y-5">
          {/* Category Filter + Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sticky top-16 z-20">
            <div
              role="tablist"
              aria-label="أقسام القائمة"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategoryId === 'ALL'}
                onClick={() => setActiveCategoryId('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeCategoryId === 'ALL'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                جميع الأقسام ({catalogItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategoryId === cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    activeCategoryId === cat.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="sm:w-44 shrink-0">
              <input
                type="search"
                aria-label="ابحث في الأصناف"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن صنف..."
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-orange-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const qtyInCart = cart
                .filter((c) => c.menuItemId === item.id)
                .reduce((s, c) => s + c.quantity, 0);

              return (
                <article
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-4 ${
                    !item.isAvailable
                      ? 'border-rose-200 bg-slate-50/70 opacity-70'
                      : qtyInCart > 0
                      ? 'border-orange-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Dish Image with Resilient Fallback */}
                    <div className="relative h-28 w-28 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {qtyInCart > 0 && (
                        <span className="absolute top-2 right-2 bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-md tabular-nums">
                          في السلة: {qtyInCart}
                        </span>
                      )}
                    </div>

                    {/* Dish Info */}
                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span>{item.categoryName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.calories} سعرة</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.prepTimeMins} د</span>
                      </div>

                      <h2 className="font-bold text-base text-slate-900 leading-snug">
                        {item.name}
                      </h2>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {item.allergens.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          مسببات الحساسية: {item.allergens.join('، ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="font-bold text-base text-slate-900 tabular-nums">
                      {item.basePrice.toFixed(2)}{' '}
                      <span className="text-xs font-medium text-slate-500">{tenant.currency}</span>
                    </div>

                    {item.isAvailable ? (
                      <button
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0"
                      >
                        {item.modifierGroups.length > 0
                          ? `+ تخصيص وإضافة`
                          : `+ أضف للسلة`}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-rose-600">
                        نفدت الكمية حالياً (86ed)
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Right/Left 4 Columns: Instant Cart & Live Order Status Tracker */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Active Cart Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">سلة الطلب الفوري</h2>
                <p className="text-xs text-slate-500">
                  {orderType === OrderType.DINE_IN
                    ? `محلي — طاولة رقم #${tableNumber}`
                    : orderType === OrderType.PICKUP
                    ? 'استلام ذاتي من الفرع (Pickup)'
                    : `توصيل مباشر للمنزل (${deliveryDistanceKm} كم)`}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {cartTotals.totalCount} أصناف
              </span>
            </div>

            {/* Pickup / Delivery Extra Inputs */}
            {orderType !== OrderType.DINE_IN && (
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اسم المستلم
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم الهاتف للتنبيه عند الجاهزية
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs tabular-nums"
                  />
                </div>
                {orderType === OrderType.DELIVERY && (
                  <div className="pt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>المسافة الجغرافية (Haversine):</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {deliveryDistanceKm} كم (داخل نطاق التوصيل)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">السلة فارغة حالياً</p>
                <p className="text-xs text-slate-500">
                  اختر أي طبق من القائمة لإضافته وإرساله مباشرة إلى شاشة المطبخ بـ 3 نقرات.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto space-y-3">
                {cart.map((line) => (
                  <div key={line.cartLineId} className="pt-3 first:pt-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{line.name}</h3>
                        {line.selectedModifiers.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {line.selectedModifiers.map((m) => m.optionName).join(' · ')}
                          </p>
                        )}
                        {line.specialNotes && (
                          <p className="text-[11px] font-semibold text-rose-600 mt-0.5">
                            ملاحظة: {line.specialNotes}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                        {line.lineTotal.toFixed(2)} {tenant.currency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        سعر الوحدة: {line.unitFinalPrice.toFixed(2)} {tenant.currency}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`إنقاص كمية ${line.name}`}
                          onClick={() => updateCartLineQty(line.cartLineId, -1)}
                          className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold w-5 text-center tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`زيادة كمية ${line.name}`}
                          onClick={() => updateCartLineQty(line.cartLineId, 1)}
                          className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Financial Summary & Instant Submit Button */}
            {cart.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>المجموع الفرعي:</span>
                    <span className="font-semibold tabular-nums">
                      {cartTotals.subtotal.toFixed(2)} {tenant.currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ضريبة القيمة المضافة ({tenant.taxRate}%):</span>
                    <span className="font-semibold tabular-nums">
                      {cartTotals.taxAmount.toFixed(2)} {tenant.currency}
                    </span>
                  </div>
                  {cartTotals.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>رسوم التوصيل المباشر:</span>
                      <span className="font-semibold tabular-nums">
                        {cartTotals.deliveryFee.toFixed(2)} {tenant.currency}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
                    <span>الإجمالي النهائي:</span>
                    <span className="tabular-nums">
                      {cartTotals.totalAmount.toFixed(2)} {tenant.currency}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      paymentMethod === PaymentMethod.CASH
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    دفع نقدي عند التقديم
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(PaymentMethod.POS_CARD)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      paymentMethod === PaymentMethod.POS_CARD
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    بطاقة بنكية (POS)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCheckoutSubmit}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-between shadow-md transition-colors"
                >
                  <span>
                    {orderType === OrderType.DINE_IN
                      ? `إرسال الطلب للمطبخ (طاولة #${tableNumber})`
                      : 'تأكيد وإرسال الطلب فوراً'}
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {cartTotals.totalAmount.toFixed(2)} {tenant.currency}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Live Order Tracker Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                متتبع الطلبات الحية
              </h2>
              <button
                type="button"
                onClick={onSwitchToKds}
                className="text-xs font-bold text-orange-600 hover:underline whitespace-nowrap shrink-0"
              >
                شاشة المطبخ ←
              </button>
            </div>

            <div className="space-y-3">
              {orders.slice(0, 3).map((ord) => {
                const statusInfo = ORDER_STATUS_LABELS[ord.status];
                return (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 tabular-nums">
                        طلب #{ord.orderNumber}{' '}
                        {ord.tableNumber ? `· طاولة #${ord.tableNumber}` : '· استلام/توصيل'}
                      </span>
                      <span className="font-semibold text-orange-700">{statusInfo.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">{statusInfo.desc}</p>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-orange-600 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (statusInfo.step / 5) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Modifiers Customization Modal / Bottom Sheet */}
      {customizingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modifier-sheet-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h3 id="modifier-sheet-title" className="text-base font-bold text-slate-900">
                  {customizingItem.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{customizingItem.description}</p>
              </div>
              <button
                type="button"
                aria-label="إغلاق نافذة التخصيص"
                onClick={() => setCustomizingItem(null)}
                className="h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 flex-1">
              {customizingItem.modifierGroups.map((group) => {
                const chosen = selectedOptions[group.id] || [];
                const isSatisfied = chosen.length >= group.minSelect;

                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{group.name}</h4>
                        <p className="text-[11px] text-slate-500">
                          {group.minSelect > 0
                            ? `إجباري: اختر ${group.minSelect} (الحد الأقصى ${group.maxSelect})`
                            : `اختياري (الحد الأقصى ${group.maxSelect})`}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          group.minSelect > 0
                            ? isSatisfied
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {group.minSelect > 0 ? (isSatisfied ? 'مكتمل ✓' : 'مطلوب') : 'اختياري'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const isSelected = chosen.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              toggleModifierOption(group.id, group.maxSelect, option.id)
                            }
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-right transition-colors ${
                              isSelected
                                ? 'border-orange-600 bg-orange-50/50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`h-5 w-5 rounded-md flex items-center justify-center border text-xs font-bold ${
                                  isSelected
                                    ? 'bg-orange-600 border-orange-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected ? '✓' : ''}
                              </span>
                              <span className="text-xs font-semibold text-slate-900">
                                {option.name}
                              </span>
                            </div>

                            <span className="text-xs font-bold text-slate-700 tabular-nums">
                              {option.priceDelta > 0
                                ? `+${option.priceDelta.toFixed(2)} ${tenant.currency}`
                                : 'مجاناً'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5">
                <label
                  htmlFor="allergy-notes-input"
                  className="block text-xs font-bold text-slate-800"
                >
                  ملاحظات خاصة للمطبخ أو تنبيهات الحساسية (اختياري)
                </label>
                <input
                  id="allergy-notes-input"
                  type="text"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="مثال: لدي حساسية من الفول السوداني، يرجى تقليل الملح..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  aria-label="إنقاص الكمية"
                  onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-lg bg-slate-100 font-bold text-sm text-slate-800"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-xs tabular-nums">{itemQty}</span>
                <button
                  type="button"
                  aria-label="زيادة الكمية"
                  onClick={() => setItemQty((q) => q + 1)}
                  className="h-9 w-9 rounded-lg bg-slate-100 font-bold text-sm text-slate-800"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={!modifierValidation.valid}
                onClick={confirmCustomizationAndAdd}
                className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between transition-colors ${
                  modifierValidation.valid
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>أضف إلى السلة</span>
                <span className="font-extrabold tabular-nums">
                  {currentModalPricing.totalLinePrice.toFixed(2)} {tenant.currency}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiter Call Modal */}
      {waiterModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="waiter-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="waiter-modal-title" className="font-bold text-sm text-slate-900">
                خدمة الطاولة الفورية (طاولة #{tableNumber})
              </h3>
              <button
                type="button"
                onClick={() => setWaiterModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2 py-1"
              >
                إغلاق ✕
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onTriggerWaiterCall('طلب الفاتورة — دفع نقدي');
                  setWaiterModalOpen(false);
                  showNotice(`تم إرسال طلب الفاتورة (نقدي) لطاولة #${tableNumber}`);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 text-right font-bold text-xs text-slate-900 flex items-center justify-between"
              >
                <span>طلب الفاتورة (دفع نقدي)</span>
                <span className="text-orange-600">إرسال للكاشير ←</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onTriggerWaiterCall('طلب الفاتورة — جهاز البطاقة البنكية (POS)');
                  setWaiterModalOpen(false);
                  showNotice(`تم إرسال طلب الفاتورة (جهاز POS) لطاولة #${tableNumber}`);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 text-right font-bold text-xs text-slate-900 flex items-center justify-between"
              >
                <span>طلب الفاتورة (جهاز البطاقة البنكية POS)</span>
                <span className="text-orange-600">إرسال للكاشير ←</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onTriggerWaiterCall('استدعاء النادل للمساعدة على الطاولة');
                  setWaiterModalOpen(false);
                  showNotice(`تم إشعار النادل بالتوجه إلى طاولة #${tableNumber}`);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-orange-600 text-right font-bold text-xs text-slate-900 flex items-center justify-between"
              >
                <span>استدعاء النادل للمساعدة على الطاولة</span>
                <span className="text-orange-600">إرسال فوري ←</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

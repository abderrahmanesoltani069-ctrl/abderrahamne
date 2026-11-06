import React, { useState, useMemo } from 'react';
import { calculateRestaurantRoi } from '../lib/domain-rules';
import {
  BACKEND_ARCHITECTURE_SNIPPETS,
  TenantRecord,
} from '../lib/seed-data';

interface SuperAdminViewProps {
  tenants: TenantRecord[];
  activeTenantId: string;
  onSelectActiveTenant: (tenantId: string) => void;
  onToggleTenantKillSwitch: (tenantId: string) => void;
  onAddTenant: (newTenant: Omit<TenantRecord, 'id' | 'monthlyOrders'>) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  tenants,
  activeTenantId,
  onSelectActiveTenant,
  onToggleTenantKillSwitch,
  onAddTenant,
}) => {
  // New Tenant Onboarding Form State
  const [newNameAr, setNewNameAr] = useState<string>('');
  const [newNameEn, setNewNameEn] = useState<string>('');
  const [newSlug, setNewSlug] = useState<string>('');
  const [newPlan, setNewPlan] = useState<'STARTER' | 'GROWTH' | 'ENTERPRISE'>('GROWTH');
  const [formNotice, setFormNotice] = useState<string | null>(null);

  // Field Discovery & Financial ROI Calculator State (Phase 1 Equations)
  const [monthlyOrders, setMonthlyOrders] = useState<number>(1000);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(100);
  const [commissionPct, setCommissionPct] = useState<number>(25);
  const [conversionPct, setConversionPct] = useState<number>(25);
  const [saasMonthlyFee, setSaasMonthlyFee] = useState<number>(450);
  const [tablesCount, setTablesCount] = useState<number>(15);
  const [peakHours, setPeakHours] = useState<number>(4);
  const [currentDurationMins, setCurrentDurationMins] = useState<number>(60);
  const [savedMinsPerTable, setSavedMinsPerTable] = useState<number>(14);

  // Backend Architecture Code Tab
  const [activeCodeTab, setActiveCodeTab] = useState<
    'RLS_PRISMA' | 'ORDERS_SERVICE' | 'KDS_REDIS_STREAMS' | 'TCP_THERMAL_BRIDGE'
  >('RLS_PRISMA');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const roiResult = useMemo(
    () =>
      calculateRestaurantRoi({
        monthlyAggregatorOrders: monthlyOrders,
        averageOrderValue: avgOrderValue,
        aggregatorCommissionPercent: commissionPct,
        directConversionPercent: conversionPct,
        saasMonthlyFee,
        tablesCount,
        peakHoursPerDay: peakHours,
        currentTableDurationMins: currentDurationMins,
        savedMinutesPerTable: savedMinsPerTable,
        tableAverageOrderValue: avgOrderValue,
      }),
    [
      monthlyOrders,
      avgOrderValue,
      commissionPct,
      conversionPct,
      saasMonthlyFee,
      tablesCount,
      peakHours,
      currentDurationMins,
      savedMinsPerTable,
    ],
  );

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameAr.trim() || !newSlug.trim()) {
      setFormNotice('يرجى إدخال اسم العلامة التجارية بالعربية والنطاق الفرعي (slug).');
      return;
    }
    onAddTenant({
      nameAr: newNameAr.trim(),
      nameEn: newNameEn.trim() || newNameAr.trim(),
      slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      branchesCount: 1,
      plan: newPlan,
      status: 'ACTIVE',
      taxRate: 10,
      currency: 'د.م.',
    });
    setNewNameAr('');
    setNewNameEn('');
    setNewSlug('');
    setFormNotice('تم إنشاء المستأجر الجديد وتفعيل عزل PostgreSQL RLS بنجاح.');
  };

  const handleCopyCode = () => {
    const code = BACKEND_ARCHITECTURE_SNIPPETS[activeCodeTab].code;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* 1. Multi-Tenant Management & Instant Kill-Switch */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              لوحة الإدارة العليا للنظام (SaaS Super Admin & Kill-Switch)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة المطاعم المشتركة (Tenants)، الباقات، ومفتاح الإيقاف الشامل الفوري
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 tabular-nums">
            إجمالي المطاعم المسجلة: {tenants.length}
          </span>
        </div>

        {formNotice && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{formNotice}</span>
            <button
              type="button"
              onClick={() => setFormNotice(null)}
              className="text-slate-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tenants Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-3">المطعم والعلامة التجارية</th>
                <th className="py-3 px-3">النطاق الفرعي (Slug)</th>
                <th className="py-3 px-3">الباقة</th>
                <th className="py-3 px-3">الفروع</th>
                <th className="py-3 px-3">الطلبات الشهرية</th>
                <th className="py-3 px-3">الحالة التشغيلية</th>
                <th className="py-3 px-3 text-left">الإجراءات ومفتاح Kill-Switch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => {
                const isCurrent = t.id === activeTenantId;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {t.nameAr}
                      {isCurrent && (
                        <span className="mr-2 text-[11px] font-semibold text-orange-600">
                          (المطعم المعروض حالياً)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-600">{t.slug}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700">{t.plan}</td>
                    <td className="py-3.5 px-3 tabular-nums">{t.branchesCount}</td>
                    <td className="py-3.5 px-3 font-bold tabular-nums">
                      {t.monthlyOrders.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-bold ${
                          t.status === 'SUSPENDED'
                            ? 'text-rose-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {t.status === 'SUSPENDED' ? 'موقوف (SUSPENDED)' : 'نشط (ACTIVE)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-left">
                      <div className="flex items-center justify-end gap-2">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => onSelectActiveTenant(t.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold"
                          >
                            معاينة القائمة
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleTenantKillSwitch(t.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                            t.status === 'SUSPENDED'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-600 hover:bg-rose-700 text-white'
                          }`}
                        >
                          {t.status === 'SUSPENDED'
                            ? 'إعادة تفعيل الخدمة'
                            : 'إيقاف فوري (Kill-Switch)'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add New Tenant Form */}
        <form
          onSubmit={handleCreateTenant}
          className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              اسم المطعم الجديد (عربي)
            </label>
            <input
              type="text"
              value={newNameAr}
              onChange={(e) => setNewNameAr(e.target.value)}
              placeholder="مثال: مطعم دار مراكش"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              الاسم بالإنجليزية
            </label>
            <input
              type="text"
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              placeholder="Dar Marrakech"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              النطاق الفرعي (Tenant Slug)
            </label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="dar-marrakech"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              باقة الاشتراك
            </label>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white font-semibold"
            >
              <option value="STARTER">STARTER</option>
              <option value="GROWTH">GROWTH</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[38px] py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            + تسجيل مطعم جديد
          </button>
        </form>
      </section>

      {/* 2. Field Discovery & Financial ROI Simulator (Phase 1 Equations) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900">
            حاسبة المسح الميداني والعائد المالي للمطعم (Field Discovery & ROI Pitch Calculator)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تطبق المعادلات الهندسية للمرحلة الأولى لحساب التوفير الصافي من عمولات تطبيقات التوصيل وعائد تسريع دوران الطاولات
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Inputs */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                طلبات تطبيقات التوصيل شهرياً
              </label>
              <input
                type="number"
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                متوسط الفاتورة (د.م.)
              </label>
              <input
                type="number"
                value={avgOrderValue}
                onChange={(e) => setAvgOrderValue(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                عمولة تطبيق التوصيل (%)
              </label>
              <input
                type="number"
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                نسبة التحول للطلب المباشر (%)
              </label>
              <input
                type="number"
                value={conversionPct}
                onChange={(e) => setConversionPct(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                عدد طاولات الفرع
              </label>
              <input
                type="number"
                value={tablesCount}
                onChange={(e) => setTablesCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                الزمن الموفر لكل طاولة (دقيقة)
              </label>
              <input
                type="number"
                value={savedMinsPerTable}
                onChange={(e) => setSavedMinsPerTable(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                زمن جلسة الطاولة الحالي (دقيقة)
              </label>
              <input
                type="number"
                value={currentDurationMins}
                onChange={(e) => setCurrentDurationMins(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ساعات الذروة يومياً
              </label>
              <input
                type="number"
                value={peakHours}
                onChange={(e) => setPeakHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                اشتراك المنصة الشهري (د.م.)
              </label>
              <input
                type="number"
                value={saasMonthlyFee}
                onChange={(e) => setSaasMonthlyFee(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Calculated Outputs */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs text-slate-400">
                إجمالي الأثر المالي الشهري للمطعم (التوفير + العائد الإضافي)
              </span>
              <div className="text-3xl font-extrabold text-orange-400 mt-1 tabular-nums">
                +{roiResult.totalMonthlyFinancialImpact.toLocaleString()} د.م. / شهرياً
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">1. التوفير الصافي من عمولات التوصيل شهرياً:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {roiResult.monthlyCommissionSavedNet.toLocaleString()} د.م.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">
                  2. طاولات إضافية مخدومة يومياً في الذروة ({roiResult.newTableDurationMins} د/طاولة):
                </span>
                <span className="font-bold text-white tabular-nums">
                  +{roiResult.additionalDailyTablesServed} طاولة/يوم
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">3. العائد الشهري من تسريع دوران الطاولات:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +{roiResult.monthlyExtraDineInRevenue.toLocaleString()} د.م.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">4. زيادة السلة من اقتراح الإضافات الآلي (12%):</span>
                <span className="font-bold text-amber-300 tabular-nums">
                  +{roiResult.monthlyUpsellGain.toLocaleString()} د.م.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Production Backend Architecture Code Explorer */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              معمارية الخلفية وقاعدة البيانات الإنتاجية (NestJS + PostgreSQL RLS + Redis Streams)
            </h2>
            <p className="text-xs text-slate-500">
              استعرض الكود الخلفي المرجعي الكامل للمرحلة الثالثة والرابعة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              Object.keys(BACKEND_ARCHITECTURE_SNIPPETS) as Array<
                keyof typeof BACKEND_ARCHITECTURE_SNIPPETS
              >
            ).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCodeTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeCodeTab === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {key === 'RLS_PRISMA'
                  ? 'PostgreSQL RLS'
                  : key === 'ORDERS_SERVICE'
                  ? 'Zero-Trust Orders'
                  : key === 'KDS_REDIS_STREAMS'
                  ? 'Redis Streams KDS'
                  : 'TCP 9100 Printer'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-950 text-slate-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-xs font-bold text-white">
                {BACKEND_ARCHITECTURE_SNIPPETS[activeCodeTab].title}
              </h3>
              <p className="text-[11px] text-slate-400">
                {BACKEND_ARCHITECTURE_SNIPPETS[activeCodeTab].subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
            >
              {copiedCode ? 'تم النسخ ✓' : 'نسخ الكود'}
            </button>
          </div>
          <pre
            dir="ltr"
            className="text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed"
          >
            <code>{BACKEND_ARCHITECTURE_SNIPPETS[activeCodeTab].code}</code>
          </pre>
        </div>
      </section>
    </div>
  );
};

# التضمين الرجعي في أسبوع تسوية سابق
# Retroactive inclusion in a past settlement week

## الفكرة
بعض الحسابات تُنشأ بعد انتهاء الأسبوع، أو تُضاف يدوياً، لكن الإدارة تريد احتسابها
كبيعة مباشرة جديدة (Direct Sale) لأسبوع سابق. الحل **لا يغيّر** `users.created_at`
ولا أي بيان أصلي، بل يسجّل قراراً صريحاً في جدول تدقيق:

```
weekly_direct_assignments (upline_id, direct_id, week_start, assigned_by, reason)
UNIQUE(upline_id, direct_id, week_start)
```

محرك التسوية يعدّ البوابة الأسبوعية كالتالي:

```
عدد المبيعات المباشرة المؤهلة =
    directs نشِطة (student) تاريخ إنشائها داخل الأسبوع
  ∪ directs مخصّصة صراحةً لهذا الأسبوع في weekly_direct_assignments
```

## الضمانات
- `created_at` الأصلي لا يُعدّل أبداً.
- الحسابات `registration_free` لا تُحتسب في البوابة ولا في الفريق ولا في العمولة (كما هو النظام).
- إعادة التسوية **مستهدفة**: فقط رعاة الحسابات المخصّصة يُعاد حسابهم.
- لا يُدفع أي مستخدم مرتين لنفس الأسبوع: صفوف `weekly_commissions` القديمة تبقى،
  ويوجد فحص `(user_id, week_start)` قبل أي صرف.
- إعادة التسوية لا تنشئ إشعار "Rank Up" مكرراً، ولا تخفض رتبة أحد.
- لقطة Top-10 التاريخية تبقى كما هي إن لم تكن هناك مبيعات أسبوعية جديدة.
- كل تشغيل `--apply` يكتب ملف تدقيق JSON كامل (قبل/بعد) + نسخة من قاعدة البيانات المحلية.

## الواجهة الإدارية
`لوحة الإدارة → التسوية الأسبوعية → 🕰️ تضمين رجعي في أسبوع سابق`

1. اختر بداية الأسبوع (الجمعة) من قائمة الأسابيع المسوّاة.
2. أدخل بريدات الحسابات.
3. **معاينة الأثر** (قراءة فقط): تُظهر الراعي، البوابة قبل/بعد، الرتبة المتوقعة،
   والعمولة المتوقعة، وتنبّه إذا كان الراعي مدفوعاً بالفعل.
4. **تخصيص فقط** أو **تخصيص + إعادة تسوية المتأثرين**.

## سطر الأوامر (على قاعدة الإنتاج)
```bash
cd admin/backend

# 1) معاينة فقط (لا كتابة)
node scripts/assignAccountsToWeek.js --week=2025-10-17

# 2) معاينة بريدات محددة
node scripts/assignAccountsToWeek.js --week=2025-10-17 --emails=a@x.com,b@x.com

# 3) تنفيذ فعلي بدون إعادة تسوية
node scripts/assignAccountsToWeek.js --week=2025-10-17 --emails=a@x.com,b@x.com --apply

# 4) تنفيذ + إعادة تسوية الرعاة المتأثرين فقط
node scripts/assignAccountsToWeek.js --week=2025-10-17 --emails=a@x.com,b@x.com --apply --resettle
```

> يجب ضبط `TURSO_URL` و `TURSO_TOKEN` في البيئة، وإلا سيعمل السكربت على قاعدة
> SQLite محلية وهمية ويطبع تحذيراً واضحاً.

## التراجع
كل تشغيل يحفظ لقطة تدقيق (قبل/بعد) في جدول `weekly_settlement_audits` ويعيد `auditId`.
سطر الأوامر يكتب أيضاً ملفاً في `admin/backend/audit/week-<week>-<timestamp>.json`.

```bash
# تراجع بلقطة محفوظة في قاعدة البيانات (يعمل حتى لو ضاع ملف السيرفر)
node scripts/rollbackWeekChange.js --audit-id=<auditId> --dry-run
node scripts/rollbackWeekChange.js --audit-id=<auditId> --apply

# أو من ملف التدقيق
node scripts/rollbackWeekChange.js --audit=audit/week-2025-10-17-....json --dry-run
node scripts/rollbackWeekChange.js --audit=audit/week-2025-10-17-....json --apply
```

يسترجع: الرتب والرصيد، `weekly_history`، `weekly_commissions`/`wallet_transactions`
/الإشعارات المُنشأة، لقطة المتصدرين، وحالة التسوية، ويحذف ارتباطات التشغيل.

## اختبارات
```bash
cd admin/backend
npm test
```
تغطي: المعاينة، التخصيص المتكرر (idempotent)، احتساب البوابة، عدم الدفع المزدوج،
عدم المساس بالأعضاء خارج النطاق، والحفاظ على لقطة المتصدرين.

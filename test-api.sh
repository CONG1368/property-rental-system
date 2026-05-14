#!/bin/bash
# ========================================
# 物业租赁综合管理系统 - 全量 API 自动化测试 v4
# ========================================
BASE="http://localhost:3001/api"
TMPDIR="./.test_tmp"
PASS=0; FAIL=0; SKIP=0
mkdir -p "$TMPDIR"

# 测试函数
test_api() {
  local label="$1"; local method="$2"; local url="$3"; local data="$4"
  local http_code
  if [ -z "$data" ]; then
    http_code=$(curl -s -o "$TMPDIR/resp.json" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" 2>/dev/null)
  else
    http_code=$(curl -s -o "$TMPDIR/resp.json" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  fi
  local body_code=$(node -e "try{var d=JSON.parse(require('fs').readFileSync('$TMPDIR/resp.json','utf8'));process.stdout.write(String(d.code||''))}catch(e){process.stdout.write('?')}" 2>/dev/null)
  cp "$TMPDIR/resp.json" "$TMPDIR/last_resp.json" 2>/dev/null
  if [ "$http_code" = "200" ] && [ "$body_code" = "200" ]; then
    echo -e "  \033[0;32mPASS\033[0m $label"
    PASS=$((PASS+1))
  elif [ "$http_code" = "404" ] || [ "$body_code" = "404" ]; then
    echo -e "  \033[0;31mFAIL\033[0m $label — 404"
    FAIL=$((FAIL+1))
  else
    echo -e "  \033[0;31mFAIL\033[0m $label (HTTP $http_code, code $body_code)"
    FAIL=$((FAIL+1))
  fi
}

test_code() {
  local label="$1"; local method="$2"; local url="$3"; local data="$4"; local expected="$5"
  local http_code
  if [ -z "$data" ]; then
    http_code=$(curl -s -o "$TMPDIR/resp.json" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" 2>/dev/null)
  else
    http_code=$(curl -s -o "$TMPDIR/resp.json" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  fi
  local body_code=$(node -e "try{var d=JSON.parse(require('fs').readFileSync('$TMPDIR/resp.json','utf8'));process.stdout.write(String(d.code||''))}catch(e){process.stdout.write('?')}" 2>/dev/null)
  if [ "$body_code" = "$expected" ]; then
    echo -e "  \033[0;32mPASS\033[0m $label (code=$expected)"
    PASS=$((PASS+1))
  else
    echo -e "  \033[0;31mFAIL\033[0m $label (期望 $expected, 实际 $body_code)"
    FAIL=$((FAIL+1))
  fi
}

# 从最近一次响应中提取字段 (fixed: v=v.id not v=d.id)
get_field() {
  node -e "try{var d=JSON.parse(require('fs').readFileSync('$TMPDIR/last_resp.json','utf8'));var v=d.data;${1};process.stdout.write(String(v||''))}catch(e){process.stdout.write('')}" 2>/dev/null
}

# ============================================================
# 0. 登录
# ============================================================
echo "=========================================="
echo "  物业租赁综合管理系统 — API 全量测试 v4"
echo "=========================================="
echo ""

curl -s -o "$TMPDIR/login.json" -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' 2>/dev/null
TOKEN=$(node -e "try{var d=JSON.parse(require('fs').readFileSync('$TMPDIR/login.json','utf8'));process.stdout.write(d.data.accessToken)}catch(e){process.stdout.write('')}" 2>/dev/null)
REFRESH_TOKEN=$(node -e "try{var d=JSON.parse(require('fs').readFileSync('$TMPDIR/login.json','utf8'));process.stdout.write(d.data.refreshToken)}catch(e){process.stdout.write('')}" 2>/dev/null)
cp "$TMPDIR/login.json" "$TMPDIR/last_resp.json" 2>/dev/null

if [ -z "$TOKEN" ]; then
  echo -e "\033[0;31m登录失败，测试终止\033[0m"
  rm -rf "$TMPDIR"
  exit 1
fi
echo -e "\033[0;32m✓ 登录成功\033[0m"
echo ""

# ============================================================
# 1. 首页概览
# ============================================================
echo "========== 1. Dashboard =========="
test_api "GET /dashboard/overview"      GET "$BASE/dashboard/overview"
test_api "GET /dashboard/income-trend"  GET "$BASE/dashboard/income-trend"
test_api "GET /dashboard/occupancy"     GET "$BASE/dashboard/occupancy"
test_api "GET /dashboard/alerts"        GET "$BASE/dashboard/alerts"
test_api "GET /dashboard/rent"          GET "$BASE/dashboard/rent"
test_api "GET /dashboard/finance"       GET "$BASE/dashboard/finance"
test_api "GET /dashboard/contracts"     GET "$BASE/dashboard/contracts"
echo ""

# ============================================================
# 2. 房源管理
# ============================================================
echo "========== 2. Properties =========="
test_api "GET /properties 列表"    GET "$BASE/properties"
test_api "POST /properties 创建"   POST "$BASE/properties" '{"name":"Test-Prop","address":"Addr1","area":100,"type":"商铺","status":"空置"}'
PROP_ID=$(get_field 'v=v.id')
test_api "GET /properties/:id 详情" GET "$BASE/properties/$PROP_ID"
test_api "PUT /properties/:id 更新" PUT "$BASE/properties/$PROP_ID" '{"name":"Test-Prop-Updated","area":120}'
echo ""

# ============================================================
# 3. 租客管理
# ============================================================
echo "========== 3. Tenants =========="
test_api "GET /tenants 列表"      GET "$BASE/tenants"
test_api "POST /tenants 创建"     POST "$BASE/tenants" '{"name":"Test-Tenant","idType":"身份证","idNumber":"440101199001011234","phone":"13800138000","status":"待入住"}'
TENANT_ID=$(get_field 'v=v.id')
test_api "GET /tenants/:id 详情"  GET "$BASE/tenants/$TENANT_ID"
test_api "PUT /tenants/:id 更新"  PUT "$BASE/tenants/$TENANT_ID" '{"phone":"13900139000"}'
test_api "POST /tenants/:id/check-in"  POST "$BASE/tenants/$TENANT_ID/check-in"
test_api "POST /tenants/:id/check-out" POST "$BASE/tenants/$TENANT_ID/check-out"
test_api "DELETE /tenants/:id 删除"    DELETE "$BASE/tenants/$TENANT_ID"
test_code "DELETE /tenants/99999" DELETE "$BASE/tenants/99999" "" "404"
echo ""

# ============================================================
# 4. 合同管理
# ============================================================
echo "========== 4. Contracts =========="
# 创建测试房源和租客
curl -s -X POST "$BASE/properties" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"CT-Prop","address":"CT-Addr","area":80,"type":"写字楼","status":"空置"}' -o "$TMPDIR/last_resp.json" 2>/dev/null
CT_PROP_ID=$(get_field 'v=v.id')
curl -s -X POST "$BASE/tenants" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"CT-Tenant","idType":"营业执照","idNumber":"91110000T","phone":"13600136000","status":"待入住"}' -o "$TMPDIR/last_resp.json" 2>/dev/null
CT_TENANT_ID=$(get_field 'v=v.id')
CT_NO="CT-$(date +%s)"

test_api "GET /contracts 列表"    GET "$BASE/contracts"
test_api "POST /contracts 创建"   POST "$BASE/contracts" "{\"contractNo\":\"$CT_NO\",\"propertyId\":$CT_PROP_ID,\"tenantId\":$CT_TENANT_ID,\"startDate\":\"2026-05-12\",\"endDate\":\"2027-05-12\",\"rentAmount\":5000}"
CT_ID=$(get_field 'v=v.id')
test_api "GET /contracts/:id 详情" GET "$BASE/contracts/$CT_ID"
test_api "PUT /contracts/:id 更新" PUT "$BASE/contracts/$CT_ID" '{"rentAmount":5500}'
test_api "GET expiry-calendar"     GET "$BASE/contracts/expiry-calendar"
test_api "POST /:id/submit"        POST "$BASE/contracts/$CT_ID/submit"
# submit后查询自动创建的Approval记录ID，通过审批路由审批通过
curl -s "$BASE/approvals?contractId=$CT_ID" -H "Authorization: Bearer $TOKEN" -o "$TMPDIR/last_resp.json" 2>/dev/null
APPROVAL_ID=$(get_field 'v=v.list[0].id')
if [ -n "$APPROVAL_ID" ] && [ "$APPROVAL_ID" != "undefined" ]; then
  test_api "PUT /approvals/:id 审批通过" PUT "$BASE/approvals/$APPROVAL_ID" '{"status":"已通过"}'
else
  echo -e "  \033[1;33mSKIP\033[0m PUT /approvals/:id 审批 — 无审批记录"
  SKIP=$((SKIP+1))
fi
test_api "POST /:id/sign"          POST "$BASE/contracts/$CT_ID/sign"
test_api "POST /:id/renew"         POST "$BASE/contracts/$CT_ID/renew" '{"newEndDate":"2028-05-12","newRent":6500}'
test_api "POST /:id/terminate"     POST "$BASE/contracts/$CT_ID/terminate"
echo ""

# ============================================================
# 5. 收租管理
# ============================================================
echo "========== 5. Bills =========="
test_api "GET /bills 列表"        GET "$BASE/bills"
test_api "POST /bills/generate"   POST "$BASE/bills/generate"
test_api "GET /bills/calendar"    GET "$BASE/bills/calendar?year=2026&month=5"
curl -s -X GET "$BASE/bills" -H "Authorization: Bearer $TOKEN" -o "$TMPDIR/last_resp.json" 2>/dev/null
BILL_ID=$(get_field 'v=v.list[0].id')
if [ -n "$BILL_ID" ] && [ "$BILL_ID" != "undefined" ]; then
  test_api "GET /bills/:id 详情"  GET "$BASE/bills/$BILL_ID"
  test_api "POST /bills/:id/pay"  POST "$BASE/bills/$BILL_ID/pay" '{"amount":5000,"channel":"银行转账","transactionNo":"TXN001"}'
else
  echo -e "  \033[1;33mSKIP\033[0m GET /bills/:id — 无数据"
  echo -e "  \033[1;33mSKIP\033[0m POST /bills/:id/pay — 无数据"
  SKIP=$((SKIP+2))
fi
echo ""

# ============================================================
# 6. 智能催缴
# ============================================================
echo "========== 6. Dunning =========="
test_api "GET /dunning 列表"      GET "$BASE/dunning"
test_api "GET /dunning/tasks"     GET "$BASE/dunning/tasks"
test_api "GET /dunning/aging"     GET "$BASE/dunning/aging"
echo ""

# ============================================================
# 7. 账套 + 科目
# ============================================================
echo "========== 7. Account Books & Accounts =========="
test_api "GET /account-books"     GET "$BASE/account-books"
BOOK_ID=$(get_field 'v=v.list[0].id')
test_api "GET /accounts"          GET "$BASE/accounts"
ACC_ID=$(get_field 'v=v.list[0].id')
echo ""

# ============================================================
# 8. 凭证管理
# ============================================================
echo "========== 8. Vouchers =========="
test_api "GET /vouchers 列表"     GET "$BASE/vouchers"
echo ""

# ============================================================
# 9. 费用核算
# ============================================================
echo "========== 9. Expenses =========="
test_api "GET /expenses 列表"     GET "$BASE/expenses"
test_api "POST /expenses 创建"    POST "$BASE/expenses" "{\"bookId\":$BOOK_ID,\"category\":\"维修\",\"amount\":500,\"description\":\"水泵维修\"}"
EXP_ID=$(get_field 'v=v.id')
test_api "DELETE /expenses/:id"   DELETE "$BASE/expenses/$EXP_ID"
echo ""

# ============================================================
# 10. 税务管理
# ============================================================
echo "========== 10. Tax =========="
test_api "GET /tax 列表"          GET "$BASE/tax"
test_api "GET /tax/calculate"     GET "$BASE/tax/calculate"
test_api "GET /tax/calculations"  GET "$BASE/tax/calculations"
test_api "GET /tax/reports"       GET "$BASE/tax/reports"
echo ""

# ============================================================
# 11. 预算管理
# ============================================================
echo "========== 11. Budgets =========="
test_api "GET /budgets 列表"     GET "$BASE/budgets"
test_api "POST /budgets 创建"    POST "$BASE/budgets" "{\"bookId\":$BOOK_ID,\"accountId\":$ACC_ID,\"year\":2026,\"budgetAmount\":100000}"
BUDGET_ID=$(get_field 'v=v.id')
test_api "GET /budgets/:id 详情" GET "$BASE/budgets/$BUDGET_ID"
test_api "PUT /budgets/:id 更新" PUT "$BASE/budgets/$BUDGET_ID" '{"budgetAmount":120000}'
test_api "GET /budgets/execution" GET "$BASE/budgets/execution"
test_api "DELETE /budgets/:id"   DELETE "$BASE/budgets/$BUDGET_ID"
echo ""

# ============================================================
# 12. 报表中心
# ============================================================
echo "========== 12. Reports =========="
test_api "GET balance-sheet"      GET "$BASE/reports/balance-sheet"
test_api "GET income-statement"   GET "$BASE/reports/income-statement?year=2026"
test_api "GET cash-flow"          GET "$BASE/reports/cash-flow?year=2026"
test_api "GET occupancy-report"   GET "$BASE/reports/occupancy-report"
test_api "GET aging-report"       GET "$BASE/reports/aging-report"
echo ""

# ============================================================
# 13. 审批管理
# ============================================================
echo "========== 13. Approvals =========="
test_api "GET /approvals 列表"     GET "$BASE/approvals"
echo ""

# ============================================================
# 14. 合同模板
# ============================================================
echo "========== 14. Contract Templates =========="
test_api "GET /contract-templates" GET "$BASE/contract-templates"
echo ""

# ============================================================
# 15. 合规管理
# ============================================================
echo "========== 15. Compliance =========="
test_api "GET /compliance 列表"   GET "$BASE/compliance"
echo ""

# ============================================================
# 16. 收款记录
# ============================================================
echo "========== 16. Payment Records =========="
test_api "GET /payment-records"   GET "$BASE/payment-records"
echo ""

# ============================================================
# 17. 用户管理
# ============================================================
echo "========== 17. Users =========="
test_api "GET /users 列表"        GET "$BASE/users"
echo ""

# ============================================================
# 18. 数据字典
# ============================================================
echo "========== 18. Dicts =========="
test_api "GET /dicts/types"       GET "$BASE/dicts/types"
DICT_CODE=$(get_field 'v=v.list[0].code')
if [ -n "$DICT_CODE" ] && [ "$DICT_CODE" != "undefined" ]; then
  test_api "GET /dicts/types/:code" GET "$BASE/dicts/types/$DICT_CODE"
else
  echo -e "  \033[1;33mSKIP\033[0m GET /dicts/types/:code — 无字典类型数据"
  SKIP=$((SKIP+1))
fi
echo ""

# ============================================================
# 19. 支付回调
# ============================================================
echo "========== 19. Callbacks =========="
test_api "POST /callbacks/mock-payment" POST "$BASE/callbacks/mock-payment" '{"billId":1,"amount":1000,"channel":"Mock"}'
echo ""

# ============================================================
# 20. 认证
# ============================================================
echo "========== 20. Auth =========="
test_code "POST /auth/login 错误密码" POST "$BASE/auth/login" '{"username":"admin","password":"wrong"}' "401"
test_api  "POST /auth/login 正确"     POST "$BASE/auth/login" '{"username":"admin","password":"admin123"}'
if [ -n "$REFRESH_TOKEN" ]; then
  test_api "POST /auth/refresh" POST "$BASE/auth/refresh" "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
else
  echo -e "  \033[1;33mSKIP\033[0m /auth/refresh — 无 token"
  SKIP=$((SKIP+1))
fi
echo ""

# ============================================================
# 清理
# ============================================================
echo "========== 清理测试数据 =========="
if [ -n "$CT_TENANT_ID" ] && [ "$CT_TENANT_ID" != "undefined" ]; then
  curl -s -X DELETE "$BASE/tenants/$CT_TENANT_ID" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
fi
if [ -n "$CT_PROP_ID" ] && [ "$CT_PROP_ID" != "undefined" ]; then
  curl -s -X DELETE "$BASE/properties/$CT_PROP_ID" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
fi
if [ -n "$PROP_ID" ] && [ "$PROP_ID" != "undefined" ]; then
  curl -s -X DELETE "$BASE/properties/$PROP_ID" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
fi
echo -e "\033[0;32m✓ 清理完成\033[0m"
echo ""

# ============================================================
# 报告
# ============================================================
TOTAL=$((PASS + FAIL + SKIP))
echo "=========================================="
echo "  测试报告"
echo "=========================================="
echo -e "  总计: $TOTAL"
echo -e "  \033[0;32m通过: $PASS\033[0m"
echo -e "  \033[0;31m失败: $FAIL\033[0m"
echo -e "  \033[1;33m跳过: $SKIP\033[0m"
echo "=========================================="
rm -rf "$TMPDIR"
if [ $FAIL -gt 0 ]; then
  echo -e "\033[0;31m存在失败用例\033[0m"
  exit 1
else
  echo -e "\033[0;32m全部通过!\033[0m"
  exit 0
fi

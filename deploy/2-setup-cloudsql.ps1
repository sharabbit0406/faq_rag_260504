# =============================================================
# 步驟 2：建立 Cloud SQL (PostgreSQL 16)
# 注意：建立約需 5-10 分鐘
# =============================================================

$PROJECT_ID   = "claude-code-faq-rag-260504"
$REGION       = "us-central1"
$INSTANCE     = "faqrag-postgres"
$DB_NAME      = "faqrag"
$DB_USER      = "faqrag"

# ★ 請在這裡設定一個強密碼
$DB_PASSWORD  = "CHANGE_THIS_STRONG_PASSWORD"

Write-Host "=== 建立 Cloud SQL 執行個體（約 5-10 分鐘）===" -ForegroundColor Cyan
gcloud sql instances create $INSTANCE `
    --database-version=POSTGRES_16 `
    --tier=db-f1-micro `
    --region=$REGION `
    --no-backup `
    --project=$PROJECT_ID

Write-Host "=== 建立資料庫 ===" -ForegroundColor Cyan
gcloud sql databases create $DB_NAME `
    --instance=$INSTANCE `
    --project=$PROJECT_ID

Write-Host "=== 建立使用者 ===" -ForegroundColor Cyan
gcloud sql users create $DB_USER `
    --instance=$INSTANCE `
    --password=$DB_PASSWORD `
    --project=$PROJECT_ID

$INSTANCE_CONNECTION = "$PROJECT_ID`:$REGION`:$INSTANCE"
$DATABASE_URL = "postgresql+asyncpg://$DB_USER`:$DB_PASSWORD@/$DB_NAME`?host=/cloudsql/$INSTANCE_CONNECTION"

Write-Host "✓ 步驟 2 完成" -ForegroundColor Green
Write-Host ""
Write-Host ">>> 請記下以下資訊（步驟 5 部署時需要）：" -ForegroundColor Yellow
Write-Host "    INSTANCE_CONNECTION : $INSTANCE_CONNECTION"
Write-Host "    DATABASE_URL        : $DATABASE_URL"

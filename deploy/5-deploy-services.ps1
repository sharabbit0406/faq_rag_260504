# =============================================================
# 步驟 5：部署到 Cloud Run
# 請先完成步驟 1-4a，再執行 5a；取得 Backend URL 後執行 4b，再執行 5b
# =============================================================

$PROJECT_ID          = "claude-code-faq-rag-260504"
$REGION              = "us-central1"
$REPO                = "$REGION-docker.pkg.dev/$PROJECT_ID/faqrag"
$SA_EMAIL            = "faqrag-backend@$PROJECT_ID.iam.gserviceaccount.com"
$INSTANCE_CONNECTION = "$PROJECT_ID`:$REGION`:faqrag-postgres"

# ★ 填入以下變數（從步驟 2 和 Qdrant Cloud 取得）
$DB_PASSWORD         = "CHANGE_THIS_STRONG_PASSWORD"   # 與步驟 2 相同
$QDRANT_URL          = "https://xxx.us-east4-0.gcp.cloud.qdrant.io"  # Qdrant Cloud 提供
$QDRANT_API_KEY      = "your-qdrant-api-key"
$GCS_BUCKET_NAME     = "your-gcs-bucket-name"

$DATABASE_URL = "postgresql+asyncpg://faqrag`:$DB_PASSWORD@/faqrag`?host=/cloudsql/$INSTANCE_CONNECTION"

# ============================================================
# 步驟 5a：部署 Backend
# ============================================================
Write-Host "=== [5a] 部署 Backend Cloud Run ===" -ForegroundColor Cyan

gcloud run deploy faqrag-backend `
    --image="$REPO/backend:latest" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --service-account=$SA_EMAIL `
    --add-cloudsql-instances=$INSTANCE_CONNECTION `
    --set-secrets="FIREBASE_ADMIN_CREDENTIALS=firebase-admin-credentials:latest" `
    --set-env-vars="APP_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,DATABASE_URL=$DATABASE_URL,QDRANT_URL=$QDRANT_URL,QDRANT_API_KEY=$QDRANT_API_KEY,QDRANT_COLLECTION_NAME=faq_chunks,GCS_BUCKET_NAME=$GCS_BUCKET_NAME,RETRIEVAL_TOP_K=20,RERANK_TOP_N=5,DEFAULT_DAILY_LLM_LIMIT=100" `
    --memory=1Gi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=10 `
    --project=$PROJECT_ID

$BACKEND_URL = gcloud run services describe faqrag-backend --region=$REGION --project=$PROJECT_ID --format="value(status.url)"

Write-Host ""
Write-Host "✓ Backend 部署完成" -ForegroundColor Green
Write-Host "  URL：$BACKEND_URL"
Write-Host ""
Write-Host "=== 執行 DB Migration ===" -ForegroundColor Cyan
Write-Host "請在 backend 目錄執行："
Write-Host "  \$env:DATABASE_URL='postgresql+asyncpg://faqrag:$DB_PASSWORD@localhost:5542/faqrag'"
Write-Host "  uv run alembic upgrade head"
Write-Host ""
Write-Host ">>> 請記下 Backend URL：$BACKEND_URL" -ForegroundColor Yellow
Write-Host ">>> 然後回到步驟 4b，填入此 URL 後 build frontend，再執行步驟 5b"

# ============================================================
# 步驟 5b：部署 Frontend（執行完 4b 後再執行）
# ============================================================
$BACKEND_URL = "https://FILL_IN_FROM_5a"   # ← 從 5a 輸出填入
$CORS_ORIGINS = "http://localhost:3000"    # 部署完後更新成 frontend URL

Write-Host "=== [5b] 部署 Frontend Cloud Run ===" -ForegroundColor Cyan

gcloud run deploy faqrag-frontend `
    --image="$REPO/frontend:latest" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=5 `
    --project=$PROJECT_ID

$FRONTEND_URL = gcloud run services describe faqrag-frontend --region=$REGION --project=$PROJECT_ID --format="value(status.url)"

Write-Host ""
Write-Host "✓ Frontend 部署完成" -ForegroundColor Green
Write-Host "  URL：$FRONTEND_URL"
Write-Host ""
Write-Host "=== 更新 Backend CORS ===" -ForegroundColor Cyan
Write-Host "前端 URL 確認後，執行以下指令讓 backend 允許前端跨域："

gcloud run services update faqrag-backend `
    --region=$REGION `
    --update-env-vars="CORS_ORIGINS=http://localhost:3000,$FRONTEND_URL" `
    --project=$PROJECT_ID

Write-Host ""
Write-Host "✓ 全部部署完成！" -ForegroundColor Green
Write-Host "  Frontend：$FRONTEND_URL"
Write-Host "  Backend ：$BACKEND_URL"

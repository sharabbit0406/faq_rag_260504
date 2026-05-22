# =============================================================
# 重新部署腳本（重新 Build + Deploy backend + frontend）
# 使用方式：在 deploy/ 資料夾執行此腳本
# =============================================================

$PROJECT_ID          = "claude-code-faq-rag-260504"
$REGION              = "us-central1"
$REPO                = "$REGION-docker.pkg.dev/$PROJECT_ID/faqrag"
$SA_EMAIL            = "faqrag-backend@$PROJECT_ID.iam.gserviceaccount.com"
$INSTANCE_CONNECTION = "$PROJECT_ID`:$REGION`:faqrag-postgres"
$DB_PASSWORD         = "XDa8ihpLZGrIqHn4sB3W"

$BACKEND_URL  = "https://faqrag-backend-l5jxtxzjha-uc.a.run.app"
$FRONTEND_URL = "https://faqrag-frontend-l5jxtxzjha-uc.a.run.app"

# Firebase 設定
$NEXT_PUBLIC_API_URL                       = $BACKEND_URL
$NEXT_PUBLIC_FIREBASE_API_KEY              = "AIzaSyCZ7DSOKvu8RJ9W22HoGHWj6sfMsWHTNWE"
$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          = "claude-code-faq-rag-260504.firebaseapp.com"
$NEXT_PUBLIC_FIREBASE_PROJECT_ID           = "claude-code-faq-rag-260504"
$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       = "claude-code-faq-rag-260504.firebasestorage.app"
$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  = "953754688378"
$NEXT_PUBLIC_FIREBASE_APP_ID               = "1:953754688378:web:e27015cedf16b6c78f54c3"

# ── [1] Build + Push Backend ──────────────────────────────────
Write-Host "`n=== [1/4] Build Backend image ===" -ForegroundColor Cyan
$BACKEND_IMAGE = "$REPO/backend:latest"
docker build -t $BACKEND_IMAGE ..\backend
if ($LASTEXITCODE -ne 0) { Write-Host "Backend build 失敗" -ForegroundColor Red; exit 1 }
docker push $BACKEND_IMAGE
Write-Host "✓ Backend image 推送完成" -ForegroundColor Green

# ── [2] Deploy Backend ────────────────────────────────────────
Write-Host "`n=== [2/4] Deploy Backend to Cloud Run ===" -ForegroundColor Cyan

$DATABASE_URL = "postgresql+asyncpg://faqrag`:$DB_PASSWORD@/faqrag`?host=/cloudsql/$INSTANCE_CONNECTION"
$QDRANT_URL   = "https://f15fc3ee-a187-4aae-a2b7-5104cbb209cc.sa-east-1-0.aws.cloud.qdrant.io"
$QDRANT_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6MDA4M2EwN2QtMDQ2NS00MGMwLTg5ODMtMTliZWI0NzY2MTFjIn0.e5TekDiLinN74_weR6PmItMqOs7UrSJw_wulWp_16-w"
$CORS         = "http://localhost:3000,$FRONTEND_URL,https://faqrag-frontend-953754688378.us-central1.run.app"

gcloud run deploy faqrag-backend `
    --image="$BACKEND_IMAGE" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --service-account=$SA_EMAIL `
    --add-cloudsql-instances=$INSTANCE_CONNECTION `
    --set-secrets="FIREBASE_ADMIN_CREDENTIALS=firebase-admin-credentials:latest" `
    --set-env-vars="APP_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,DATABASE_URL=$DATABASE_URL,QDRANT_URL=$QDRANT_URL,QDRANT_API_KEY=$QDRANT_KEY,QDRANT_COLLECTION_NAME=faq_chunks,GCS_BUCKET_NAME=faqrag-documents-260504,RETRIEVAL_TOP_K=20,RERANK_TOP_N=8,DEFAULT_DAILY_LLM_LIMIT=100,LLM_MODEL=gemini-2.5-flash,CORS_ORIGINS=$CORS" `
    --memory=1Gi --cpu=1 --min-instances=0 --max-instances=10 `
    --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) { Write-Host "Backend 部署失敗" -ForegroundColor Red; exit 1 }
Write-Host "✓ Backend 部署完成：$BACKEND_URL" -ForegroundColor Green

# ── [3] Build + Push Frontend ─────────────────────────────────
Write-Host "`n=== [3/4] Build Frontend image ===" -ForegroundColor Cyan
$FRONTEND_IMAGE = "$REPO/frontend:latest"
docker build `
    --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL `
    --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY `
    --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN `
    --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID `
    --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET `
    --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID `
    --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID `
    -t $FRONTEND_IMAGE `
    ..\frontend

if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build 失敗" -ForegroundColor Red; exit 1 }
docker push $FRONTEND_IMAGE
Write-Host "✓ Frontend image 推送完成" -ForegroundColor Green

# ── [4] Deploy Frontend ───────────────────────────────────────
Write-Host "`n=== [4/4] Deploy Frontend to Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy faqrag-frontend `
    --image="$FRONTEND_IMAGE" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --memory=512Mi --cpu=1 --min-instances=0 --max-instances=5 `
    --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) { Write-Host "Frontend 部署失敗" -ForegroundColor Red; exit 1 }

Write-Host "`n✅ 全部部署完成！" -ForegroundColor Green
Write-Host "  Frontend : $FRONTEND_URL" -ForegroundColor White
Write-Host "  Backend  : $BACKEND_URL"  -ForegroundColor White
Write-Host "`n⚠️  記得執行 DB Migration（parent_content 欄位）：" -ForegroundColor Yellow
Write-Host "  1. 啟動 Cloud SQL Auth Proxy：cloud-sql-proxy $INSTANCE_CONNECTION --port=5542"
Write-Host "  2. cd ..\backend"
Write-Host "  3. `$env:DATABASE_URL='postgresql+asyncpg://faqrag:$DB_PASSWORD@localhost:5542/faqrag'"
Write-Host "  4. uv run alembic upgrade head"

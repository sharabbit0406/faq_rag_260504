# =============================================================
# redeploy.ps1 - Build + Deploy backend + frontend to Cloud Run
# Usage: cd deploy && .\redeploy.ps1
# =============================================================

$env:PATH = "C:\Users\sha\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;$env:PATH"

$PROJECT_ID          = "claude-code-faq-rag-260504"
$REGION              = "us-central1"
$REPO                = "$REGION-docker.pkg.dev/$PROJECT_ID/faqrag"
$SA_EMAIL            = "faqrag-backend@$PROJECT_ID.iam.gserviceaccount.com"
$INSTANCE_CONNECTION = "$PROJECT_ID`:$REGION`:faqrag-postgres"

$BACKEND_URL  = "https://faqrag-backend-953754688378.us-central1.run.app"
$FRONTEND_URL = "https://faqrag-frontend-953754688378.us-central1.run.app"

$NEXT_PUBLIC_API_URL                      = $BACKEND_URL
$NEXT_PUBLIC_FIREBASE_API_KEY             = "AIzaSyCZ7DSOKvu8RJ9W22HoGHWj6sfMsWHTNWE"
$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN         = "claude-code-faq-rag-260504.firebaseapp.com"
$NEXT_PUBLIC_FIREBASE_PROJECT_ID          = "claude-code-faq-rag-260504"
$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET      = "claude-code-faq-rag-260504.firebasestorage.app"
$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "953754688378"
$NEXT_PUBLIC_FIREBASE_APP_ID              = "1:953754688378:web:e27015cedf16b6c78f54c3"

$ENV_FILE = "$PSScriptRoot\backend-full-env.yaml"

# ── [1] Build + Push Backend ──────────────────────────────────
Write-Host ""
Write-Host "=== [1/4] Build Backend image ===" -ForegroundColor Cyan
$BACKEND_IMAGE = "$REPO/backend:latest"
docker build -t $BACKEND_IMAGE "$PSScriptRoot\..\backend"
if ($LASTEXITCODE -ne 0) { Write-Host "Backend build failed" -ForegroundColor Red; exit 1 }
docker push $BACKEND_IMAGE
Write-Host "Backend image pushed OK" -ForegroundColor Green

# ── [2] Deploy Backend ────────────────────────────────────────
Write-Host ""
Write-Host "=== [2/4] Deploy Backend to Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy faqrag-backend `
    --image="$BACKEND_IMAGE" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --service-account=$SA_EMAIL `
    --add-cloudsql-instances=$INSTANCE_CONNECTION `
    --set-secrets="FIREBASE_ADMIN_CREDENTIALS=firebase-admin-credentials:latest" `
    --env-vars-file="$ENV_FILE" `
    --memory=1Gi --cpu=1 --min-instances=0 --max-instances=10 `
    --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) { Write-Host "Backend deploy failed" -ForegroundColor Red; exit 1 }
Write-Host "Backend deployed OK" -ForegroundColor Green

# ── [3] Build + Push Frontend ─────────────────────────────────
Write-Host ""
Write-Host "=== [3/4] Build Frontend image ===" -ForegroundColor Cyan
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
    "$PSScriptRoot\..\frontend"

if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed" -ForegroundColor Red; exit 1 }
docker push $FRONTEND_IMAGE
Write-Host "Frontend image pushed OK" -ForegroundColor Green

# ── [4] Deploy Frontend ───────────────────────────────────────
Write-Host ""
Write-Host "=== [4/4] Deploy Frontend to Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy faqrag-frontend `
    --image="$FRONTEND_IMAGE" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --memory=512Mi --cpu=1 --min-instances=0 --max-instances=5 `
    --project=$PROJECT_ID

if ($LASTEXITCODE -ne 0) { Write-Host "Frontend deploy failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "All done!" -ForegroundColor Green
Write-Host "  Frontend : $FRONTEND_URL"
Write-Host "  Backend  : $BACKEND_URL"
Write-Host ""
Write-Host "If you have new DB migrations: run cloud-sql-proxy on port 15432 then alembic upgrade head" -ForegroundColor Yellow
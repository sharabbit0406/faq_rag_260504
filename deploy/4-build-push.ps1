# =============================================================
# 步驟 4：Build Docker Images 並推送到 Artifact Registry
#
# 執行前請先完成步驟 1-3，並填好下方 Firebase 設定。
# 前端 build 需要知道 Backend URL，請先部署 backend（步驟 5a），
# 取得 URL 後再回來執行步驟 4b 建立前端 image。
# =============================================================

$PROJECT_ID = "claude-code-faq-rag-260504"
$REGION     = "us-central1"
$REPO       = "$REGION-docker.pkg.dev/$PROJECT_ID/faqrag"

# ============================================================
# 步驟 4a：Build + Push Backend
# ============================================================
Write-Host "=== [4a] Build Backend ===" -ForegroundColor Cyan

$BACKEND_IMAGE = "$REPO/backend:latest"
docker build -t $BACKEND_IMAGE ..\backend
docker push $BACKEND_IMAGE

Write-Host "✓ Backend image 推送完成：$BACKEND_IMAGE" -ForegroundColor Green
Write-Host ""
Write-Host ">>> 請先執行步驟 5a 部署 backend，取得 Backend URL 後再繼續 4b" -ForegroundColor Yellow

# ============================================================
# 步驟 4b：Build + Push Frontend（填入下方變數後再執行）
# ============================================================

# ★ 填入你的 Firebase 設定（從 Firebase Console → Project Settings）
$NEXT_PUBLIC_API_URL                       = "https://BACKEND_CLOUD_RUN_URL"  # ← 從步驟 5a 取得
$NEXT_PUBLIC_FIREBASE_API_KEY              = "AIzaSy..."
$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          = "your-project.firebaseapp.com"
$NEXT_PUBLIC_FIREBASE_PROJECT_ID           = "your-firebase-project-id"
$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       = "your-project.firebasestorage.app"
$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  = "123456789"
$NEXT_PUBLIC_FIREBASE_APP_ID               = "1:123456789:web:abc123"

Write-Host "=== [4b] Build Frontend ===" -ForegroundColor Cyan

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

docker push $FRONTEND_IMAGE

Write-Host "✓ Frontend image 推送完成：$FRONTEND_IMAGE" -ForegroundColor Green

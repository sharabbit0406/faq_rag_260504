# =============================================================
# 步驟 3：建立 Secret Manager 機密 + 設定 Cloud Run Service Account
# 需要事先準備：firebase-admin-key.json（Firebase Admin SDK 金鑰）
# =============================================================

$PROJECT_ID          = "claude-code-faq-rag-260504"
$FIREBASE_KEY_PATH   = "..\backend\firebase-admin-key.json"   # ← 改成你的實際路徑
$SA_NAME             = "faqrag-backend"

# --- 建立 Firebase Admin 機密 ---
Write-Host "=== 建立 Firebase Admin 機密 ===" -ForegroundColor Cyan
gcloud secrets create firebase-admin-credentials `
    --data-file=$FIREBASE_KEY_PATH `
    --project=$PROJECT_ID

# --- 建立 Cloud Run 專用 Service Account ---
Write-Host "=== 建立 Service Account ===" -ForegroundColor Cyan
gcloud iam service-accounts create $SA_NAME `
    --display-name="FAQ RAG Backend" `
    --project=$PROJECT_ID

$SA_EMAIL = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# --- 授予必要權限 ---
Write-Host "=== 授予 IAM 權限 ===" -ForegroundColor Cyan

# Vertex AI (Gemini + Embeddings)
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/aiplatform.user"

# Cloud Storage
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/storage.objectAdmin"

# Cloud SQL
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/cloudsql.client"

# Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/secretmanager.secretAccessor"

Write-Host "✓ 步驟 3 完成" -ForegroundColor Green
Write-Host "    Service Account：$SA_EMAIL"

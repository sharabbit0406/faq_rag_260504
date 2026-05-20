# =============================================================
# 步驟 1：啟用 GCP API + 建立 Artifact Registry
# 執行前請確認已安裝並登入 gcloud：
#   winget install Google.CloudSDK
#   gcloud auth login
#   gcloud config set project claude-code-faq-rag-260504
# =============================================================

$PROJECT_ID = "claude-code-faq-rag-260504"
$REGION     = "us-central1"
$REPO_NAME  = "faqrag"

Write-Host "=== 啟用所需 API ===" -ForegroundColor Cyan
gcloud services enable `
    run.googleapis.com `
    sqladmin.googleapis.com `
    secretmanager.googleapis.com `
    artifactregistry.googleapis.com `
    cloudresourcemanager.googleapis.com `
    iam.googleapis.com `
    --project=$PROJECT_ID

Write-Host "=== 建立 Artifact Registry Docker Repo ===" -ForegroundColor Cyan
gcloud artifacts repositories create $REPO_NAME `
    --repository-format=docker `
    --location=$REGION `
    --description="FAQ RAG SaaS images" `
    --project=$PROJECT_ID

Write-Host "=== 設定 Docker 認證 ===" -ForegroundColor Cyan
gcloud auth configure-docker "$REGION-docker.pkg.dev"

Write-Host "✓ 步驟 1 完成" -ForegroundColor Green
Write-Host "  Image 路徑前綴：$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/"

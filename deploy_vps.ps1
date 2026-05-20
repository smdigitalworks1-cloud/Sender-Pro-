$VPS_HOST = "root@76.13.243.183"
$PASSWORD = "Sathiyan@191120"
$LOCAL_DIR = $PSScriptRoot

Write-Host "🚀 Starting Deployment to $VPS_HOST..." -ForegroundColor Cyan

# Upload deploy.tar.gz
Write-Host "📦 Uploading deploy.tar.gz..." -ForegroundColor Yellow
scp deploy.tar.gz "${VPS_HOST}:/root/deploy.tar.gz"

# Upload setup_vps.sh
Write-Host "📦 Uploading setup_vps.sh..." -ForegroundColor Yellow
scp setup_vps.sh "${VPS_HOST}:/root/setup_vps.sh"

# Extract and Setup on VPS
Write-Host "⚙️ Setting up on VPS..." -ForegroundColor Yellow
ssh $VPS_HOST "mkdir -p /var/www/sender-pro && tar -xzf /root/deploy.tar.gz -C /var/www/sender-pro && bash /root/setup_vps.sh"

Write-Host "✅ Deployment Complete!" -ForegroundColor Green

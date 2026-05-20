@echo off
echo 🧹 Cleaning up Sender Pro Background Processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM chrome.exe /T 2>nul
echo 🗑️ Deleting locked WhatsApp session folder...
rmdir /s /q "backend\.wwebjs_auth" 2>nul
rmdir /s /q "backend\.wwebjs_cache" 2>nul
echo ✅ Done! Please run "npm start" in backend folder now.
pause

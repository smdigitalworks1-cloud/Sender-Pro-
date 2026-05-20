@echo off
echo 🧹 MASTER CLEANUP STARTING...
echo 🛑 1. Stopping background processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM chrome.exe /T 2>nul

echo 🗑️ 2. Deleting big waste files (Zips & MSI)...
del /f /q backend.zip 2>nul
del /f /q frontend.zip 2>nul
del /f /q node20.msi 2>nul

echo 📂 3. Cleaning WhatsApp session logs...
rmdir /s /q "backend\.wwebjs_auth" 2>nul
rmdir /s /q "backend\.wwebjs_cache" 2>nul

echo 📦 4. Moving old backend scripts to legacy...
if not exist "backend\scripts\legacy" mkdir "backend\scripts\legacy"
move /y "backend\add-parent-id.js" "backend\scripts\legacy\" 2>nul
move /y "backend\autoFix.js" "backend\scripts\legacy\" 2>nul
move /y "backend\autoFixSyntax.js" "backend\scripts\legacy\" 2>nul
move /y "backend\check.js" "backend\scripts\legacy\" 2>nul
move /y "backend\checkUser.js" "backend\scripts\legacy\" 2>nul
move /y "backend\check_db.js" "backend\scripts\legacy\" 2>nul
move /y "backend\check_user.js" "backend\scripts\legacy\" 2>nul
move /y "backend\clean.js" "backend\scripts\legacy\" 2>nul
move /y "backend\fix-db.js" "backend\scripts\legacy\" 2>nul
move /y "backend\fixBraces.js" "backend\scripts\legacy\" 2>nul
move /y "backend\force_sync.js" "backend\scripts\legacy\" 2>nul
move /y "backend\hash-check.js" "backend\scripts\legacy\" 2>nul
move /y "backend\migrateModels.js" "backend\scripts\legacy\" 2>nul
move /y "backend\migrateRoutes.js" "backend\scripts\legacy\" 2>nul
move /y "backend\test.js" "backend\scripts\legacy\" 2>nul
move /y "backend\test_sync.js" "backend\scripts\legacy\" 2>nul
move /y "backend\wrapDestroy.js" "backend\scripts\legacy\" 2>nul

echo ✅ CLEANUP COMPLETE! 
echo 🚀 Next step: Run "npm start" in backend.
pause

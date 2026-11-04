@echo off
setlocal
cd /d "%~dp0"
title TrocaTicket - Apresentacao
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 24 ? 1 : 0)" >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js 24 LTS e abra este arquivo novamente.
  echo Download oficial: https://nodejs.org/pt-br/download
  pause
  exit /b 1
)
if not exist "node_modules\qrcode\package.json" goto install
if not exist "node_modules\nodemailer\package.json" goto install
if exist "node_modules\mysql2\package.json" goto run
:install
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo Nao foi possivel baixar as dependencias. Confira a conexao e tente novamente.
  pause
  exit /b 1
)
:run
echo.
echo TrocaTicket - mantenha esta janela aberta.
echo Quando aparecer "pronto", abra http://127.0.0.1:3000 no navegador.
echo No login, use "Acessos para apresentar" para escolher uma conta.
echo.
call npm run apresentacao
pause

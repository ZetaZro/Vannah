@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ==============================================
echo  Admin HUD - crear repositorio del roster
echo ==============================================
echo Carpeta: %CD%
echo.

where git >nul 2>nul
if errorlevel 1 goto :nogit
set HAVEGH=1
where gh >nul 2>nul
if errorlevel 1 set HAVEGH=0
if "%HAVEGH%"=="0" echo [AVISO] GitHub CLI no esta instalado: https://cli.github.com
if "%HAVEGH%"=="0" echo Se creara solo el repo local y te explico como subirlo.
echo.

set REPO=
set /p REPO=Nombre del repositorio [admin-roster]: 
if "%REPO%"=="" set REPO=admin-roster

if not exist ".git" git init -b main
if errorlevel 1 goto :fail
git add build-roster.mjs bans.example.json README.md ADMIN_HUD_ARQUITECTURA.md .gitignore .github
git commit -m "Admin HUD roster backend"
echo.

if "%HAVEGH%"=="0" goto :manual

gh auth status >nul 2>nul
if errorlevel 1 gh auth login
echo Creando repositorio PUBLICO. Tu bans.json NO se sube: usa el secreto BANS_JSON.
gh repo create %REPO% --public --source . --remote origin --push
if errorlevel 1 goto :fail

for /f "delims=" %%u in ('gh api user --jq .login') do set OWNER=%%u
echo Activando GitHub Pages con origen Actions...
gh api -X POST repos/!OWNER!/%REPO%/pages -f build_type=workflow >nul 2>nul

echo.
set GID=
set /p GID=Group ID grp_... [Enter para omitir]: 
if not "%GID%"=="" gh secret set VRC_GROUP_ID --body "%GID%" --repo !OWNER!/%REPO%
echo.
echo Pega el valor de la cookie auth de la cuenta DEDICADA [Enter para omitir]:
set COOKIE=
set /p COOKIE=
if not "%COOKIE%"=="" gh secret set VRC_AUTH_COOKIE --body "%COOKIE%" --repo !OWNER!/%REPO%
set UA=
set /p UA=User-Agent identificable, ej. MiMundoAdmin/1.0 tu@mail.com [Enter para omitir]: 
if not "%UA%"=="" gh secret set VRC_USER_AGENT --body "%UA%" --repo !OWNER!/%REPO%

echo.
echo Ejecutando el workflow una vez...
gh workflow run roster.yml --repo !OWNER!/%REPO%
echo.
echo LISTO. URL del roster [espera 1-2 min a que termine el workflow]:
echo   https://!OWNER!.github.io/%REPO%/roster.json
echo Pegala en Unity: Tools / ZetaZero / Worlds / Admin HUD / Roster y grupo.
goto :end

:manual
echo Repo local creado. Para subirlo:
echo  1. Crea un repo PUBLICO vacio en https://github.com/new llamado %REPO%
echo  2. git remote add origin https://github.com/TU_USUARIO/%REPO%.git
echo  3. git push -u origin main
echo  4. Settings / Pages: Source = GitHub Actions
echo  5. Settings / Secrets: VRC_GROUP_ID y VRC_AUTH_COOKIE [ver README.md]
goto :end

:nogit
echo [ERROR] Git no esta instalado: https://git-scm.com/download/win
goto :end

:fail
echo [ERROR] Algo fallo. Revisa el mensaje de arriba.

:end
echo.
pause

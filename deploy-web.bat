@echo off
echo ===================================================
echo   GoodMusic Web Deployment to GitHub Pages
echo ===================================================
echo.

:: 1. Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b 1
)

:: 2. Check if gh (GitHub CLI) is installed
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] GitHub CLI - gh - is not installed.
    echo Please install it from https://cli.github.com/ or via winget:
    echo winget install GitHub.cli
    echo Then try again.
    pause
    exit /b 1
)

:: 3. Configure Git user name and email globally if they are not set
git config --global user.name >nul 2>nul
if %errorlevel% neq 0 (
    echo [SETUP] Git user.name is not set.
    set /p git_name="Enter your name for Git (e.g. Lev Tov): "
    git config --global user.name "%git_name%"
)

git config --global user.email >nul 2>nul
if %errorlevel% neq 0 (
    echo [SETUP] Git user.email is not set.
    set /p git_email="Enter your email for Git (e.g. lev@example.com): "
    git config --global user.email "%git_email%"
)

:: 4. Check GitHub authentication
echo [CHECK] Checking GitHub connection...
set "GITHUB_TOKEN="
gh auth status >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOGIN] You are not logged into GitHub.
    echo Opening browser for GitHub authentication.
    echo Please follow the instructions to log in.
    echo.
    gh auth login
    if %errorlevel% neq 0 (
        echo [ERROR] GitHub login failed.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Connected to GitHub successfully!
)

:: Get GitHub username
for /f "tokens=*" %%i in ('gh api user --jq .login') do set "github_user=%%i"
echo [INFO] GitHub username: %github_user%
echo.

:: 5. Initialize local git repository if not already done
if not exist .git (
    echo [INIT] Initializing local Git repository...
    git init
    git branch -M main
)

:: 6. Build the static files
echo [BUILD] Building the website (Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Please fix compiler errors and try again.
    pause
    exit /b 1
)

:: 7. Commit local changes
echo [COMMIT] Committing local files...
git add .
git commit -m "Initial commit for GoodMusic Web & Desktop" >nul 2>nul

:: 8. Create GitHub repository if it doesn't exist
set "repo_name=goodmusic"
set /p input_name="Enter GitHub repository name (default: %repo_name%): "
if not "%input_name%"=="" set "repo_name=%input_name%"

echo [CHECK] Checking if repository %github_user%/%repo_name% exists...
gh repo view %github_user%/%repo_name% >nul 2>nul
if %errorlevel% neq 0 (
    echo [CREATE] Creating repository %repo_name% on GitHub...
    gh repo create %repo_name% --public --confirm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create repository.
        pause
        exit /b 1
    )
    echo [REMOTE] Configuring remote...
    git remote remove origin >nul 2>nul
    git remote add origin https://github.com/%github_user%/%repo_name%.git
) else (
    echo [INFO] Repository %repo_name% already exists. Using existing one.
    git remote remove origin >nul 2>nul
    git remote add origin https://github.com/%github_user%/%repo_name%.git
)

:: Push main branch
echo [PUSH] Uploading source code to GitHub (main branch)...
git push -u origin main --force
if %errorlevel% neq 0 (
    echo [WARNING] Source code push failed. Proceeding to web deployment anyway.
)

:: 9. Deploy dist folder to gh-pages branch
echo [DEPLOY] Preparing dist directory for deployment...
if not exist dist (
    echo [ERROR] dist folder not found.
    pause
    exit /b 1
)

cd dist
:: Create .nojekyll
echo. > .nojekyll

:: Initialize clean temporary git inside dist
git init
git checkout -b gh-pages
git add .
git commit -m "Deploy web version to GitHub Pages"
git remote add origin https://github.com/%github_user%/%repo_name%.git

echo [PUSH] Uploading build to GitHub Pages (gh-pages branch)...
git push -f origin gh-pages

cd ..

echo.
echo ===================================================
echo   Deployment Completed Successfully!
echo ===================================================
echo Your website will be live in a minute at:
echo https://%github_user%.github.io/%repo_name%/
echo.
echo Code repository:
echo https://github.com/%github_user%/%repo_name%
echo ===================================================
echo.
pause

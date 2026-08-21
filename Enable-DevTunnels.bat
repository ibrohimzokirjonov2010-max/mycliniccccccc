@echo off
REM VS Code Port Forwarding Setup
echo Starting VS Code with port forwarding enabled...

REM Open VS Code ports panel 
code --install-extension ms-vscode.remote-server
code --open-url "vscode://remote/Port-forward/5175"

echo.
echo Port forwarding hozir sozlanmoqda...
echo 5175 porti internet'ga ochiladi
echo.
pause

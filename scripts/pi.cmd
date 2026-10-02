@echo off
node "%~dp0..\stack-launcher\launch.mjs" %*
exit /b %ERRORLEVEL%

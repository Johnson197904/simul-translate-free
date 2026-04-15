@echo off
cd /d C:\Users\Administrator\Desktop\work\同声传译项目\simul_translate_free
npx -y cloudflared tunnel --url http://localhost:8765 > tunnel_url.txt 2>&1
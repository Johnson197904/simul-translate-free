# Render 自动化部署脚本
# 用法：python render_auto_deploy.py
# 或在 CI/CD 中调用

# -*- coding: utf-8 -*-
import json
import urllib.request
import urllib.error
import ssl
import sys

RENDER_API_KEY = "rnd_DtUKfA4GlSDrdTbcdb9zNhCRPlip"
SERVICE_ID = "srv-d7he6klckfvc73ei1op0"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api_call(method, url, data=None):
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30, context=ctx)
        resp_body = resp.read().decode("utf-8")
        return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(resp_body)
        except:
            return e.code, {"raw": resp_body}
    except Exception as e:
        return None, {"error": str(e)}

def trigger_deploy():
    print("Triggering Render deploy...")
    status, body = api_call(
        "POST",
        f"https://api.render.com/v1/services/{SERVICE_ID}/deploys"
    )
    if status in (200, 201):
        print(f"OK! Deploy ID: {body.get('id','')}")
        print(f"Dashboard: https://dashboard.render.com/web/{SERVICE_ID}/deploys")
        return True
    else:
        print(f"Failed: {status} {body}")
        return False

def get_service_status():
    status, body = api_call("GET", f"https://api.render.com/v1/services/{SERVICE_ID}")
    if status == 200:
        svc = body.get("service", body)
        print(f"Service: {svc.get('name')}")
        print(f"Branch: {svc.get('branch')}")
        print(f"AutoDeploy: {svc.get('autoDeploy')}")
        return svc
    return None

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        get_service_status()
    else:
        trigger_deploy()

import sys
sys.path.insert(0, r"C:\Users\Administrator\Desktop\work\同声传译项目\simul_translate_free")
try:
    import wsgi
    print("WSGI module imported OK")
    print("app:", type(wsgi.app))
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

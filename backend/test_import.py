try:
    import main
    print("Import OK")
except Exception as e:
    print(f"Import error: {e}")
    import traceback
    traceback.print_exc()

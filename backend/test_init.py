import asyncio
from init_data import init_demo_data

async def test():
    print("Testing init_demo_data...")
    try:
        await init_demo_data()
        print("init_demo_data OK")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())

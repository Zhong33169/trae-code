import asyncio
from database import async_session
from models.user import User
from sqlalchemy import select
from schemas.user import UserResponse

async def test():
    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalars().first()
        
        if user:
            print(f'User: {user.username}')
            print(f'Role: {user.role}')
            print(f'Role label type: {type(user.role_label)}')
            print(f'Role label: {user.role_label}')
            
            try:
                response = UserResponse.model_validate(user)
                print(f'Response OK: {response.role_label}')
            except Exception as e:
                print(f'Error: {e}')
                import traceback
                traceback.print_exc()

asyncio.run(test())

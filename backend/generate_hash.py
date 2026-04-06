from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

print("admin:", pwd_context.hash("admin123"))
print("user:", pwd_context.hash("user123"))

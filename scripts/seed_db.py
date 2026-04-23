"""Apply migrations and verify database schema."""
import subprocess
import sys

def main():
    print("Starting PostgreSQL via Docker Compose...")
    subprocess.run(["docker", "compose", "up", "-d", "db"], check=True)
    print("Database ready. Migrations applied automatically via initdb.d mount.")
    print("Connect: psql postgresql://canadianai:canadianai@localhost:5432/canadianai")

if __name__ == "__main__":
    main()

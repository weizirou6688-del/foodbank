#!/bin/bash
# Initialize PostgreSQL database for the Food Bank application
# Run this script with: bash scripts/init_db.sh

set -e

echo "🗄️  Initializing PostgreSQL database..."

# 1. Create user (if doesn't exist)
echo "Creating PostgreSQL user 'foodbank'..."
sudo -u postgres psql << EOF
DO
\$\$
BEGIN
    CREATE USER foodbank WITH PASSWORD 'foodbank';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'User foodbank already exists';
END
\$\$;
EOF

# 2. Create database owned by foodbank user
echo "Creating database 'foodbank'..."
sudo -u postgres psql << EOF
DO
\$\$
BEGIN
    CREATE DATABASE foodbank OWNER foodbank;
EXCEPTION WHEN duplicate_database THEN
    RAISE NOTICE 'Database foodbank already exists';
END
\$\$;
EOF

# 3. Grant privileges
echo "Granting privileges..."
sudo -u postgres psql << EOF
GRANT ALL PRIVILEGES ON DATABASE foodbank TO foodbank;
GRANT ALL PRIVILEGES ON SCHEMA public TO foodbank;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO foodbank;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO foodbank;
EOF

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. cd /workspaces/foodbank/backend"
echo "2. alembic upgrade head"
echo ""

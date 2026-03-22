#!/bin/sh
set -e

echo "🚀 Starting Mediqux Backend..."

# Default values for user/group IDs
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create group if it doesn't exist
if ! getent group $PGID > /dev/null 2>&1; then
    groupadd -g $PGID appgroup
fi

# Create user if it doesn't exist
if ! getent passwd $PUID > /dev/null 2>&1; then
    useradd -u $PUID -g $PGID -M appuser
fi

# Get the actual user and group names
USER_NAME=$(getent passwd $PUID | cut -d: -f1)
GROUP_NAME=$(getent group $PGID | cut -d: -f1)

# Ensure upload directories exist and have correct permissions
mkdir -p /app/uploads/lab-reports
mkdir -p /app/uploads/diagnostic-studies
chown -R $USER_NAME:$GROUP_NAME /app/uploads

# Run database migrations automatically on startup
echo "🔍 Running database migrations..."
if gosu $USER_NAME npm run db:migrate; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

echo "✅ Starting Node.js server..."
# Switch to the user and run the command
exec gosu $USER_NAME "$@"

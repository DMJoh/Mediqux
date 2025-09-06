#!/bin/sh

# Default values
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create group if it doesn't exist
if ! getent group $PGID > /dev/null 2>&1; then
    addgroup -g $PGID appgroup
fi

# Create user if it doesn't exist
if ! getent passwd $PUID > /dev/null 2>&1; then
    adduser -D -u $PUID -G $(getent group $PGID | cut -d: -f1) appuser
fi

# Get the actual user and group names
USER_NAME=$(getent passwd $PUID | cut -d: -f1)
GROUP_NAME=$(getent group $PGID | cut -d: -f1)

# Change ownership of app directory
chown -R $USER_NAME:$GROUP_NAME /app/uploads /app/logs

# Switch to the user and run the command
exec su-exec $USER_NAME "$@"
#!/bin/bash

# Define paths
KEY_PATH="/Users/rahul/Documents/animal-rescue/animal-rescue-key.pem"
SERVER_USER="ubuntu"
SERVER_IP="13.200.250.49"
FRONTEND_DIR="/Users/rahul/Documents/animal-rescue/animal-rescue-frontend"
BACKEND_DIR="/Users/rahul/Documents/animal-rescue/animal-rescue-backend"

echo "Building Frontend..."
cd "$FRONTEND_DIR"
npm run build

echo "Preparing Server Directories..."
ssh -i "$KEY_PATH" "$SERVER_USER@$SERVER_IP" "sudo mkdir -p /var/www/animal-rescue-frontend && sudo chown -R $SERVER_USER:$SERVER_USER /var/www/animal-rescue-frontend"

echo "Deploying Frontend Assets..."
scp -i "$KEY_PATH" -r dist/* "$SERVER_USER@$SERVER_IP":/var/www/animal-rescue-frontend/

echo "Updating Nginx Configuration..."
scp -i "$KEY_PATH" "$BACKEND_DIR/nginx.conf" "$SERVER_USER@$SERVER_IP":/tmp/nginx.conf
ssh -i "$KEY_PATH" "$SERVER_USER@$SERVER_IP" "sudo mv /tmp/nginx.conf /etc/nginx/sites-available/animalnow.club && sudo systemctl reload nginx"

echo "Deployment Complete! Visit https://animalnow.club"

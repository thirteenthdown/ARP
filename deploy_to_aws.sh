#!/bin/bash

# --- CONFIGURATION ---
EC2_IP="13.200.250.49"
PEM_FILE="animal-rescue-key.pem"
DB_HOST="animal-rescue-db.c3s66iaaosv6.ap-south-1.rds.amazonaws.com"
DB_USER="postgres"
DB_PASS="AnimalRescue2024!" # Should match what user created
DB_NAME="animal_rescue_prod"

# Local Paths
FRONTEND_DIR="./animal-rescue-frontend"
BACKEND_DIR="./animal-rescue-backend"

echo "=== STARTING DEPLOYMENT TO $EC2_IP ==="

# 1. Ask for .pem file location if not found
if [ ! -f "$PEM_FILE" ]; then
    echo "Error: $PEM_FILE not found in current directory."
    echo "Please copy your .pem file here or update the script."
    exit 1
fi
chmod 400 "$PEM_FILE"

# 2. Build Frontend Locally
echo ">>> Building Frontend..."
cd "$FRONTEND_DIR"
# Use relative API path /api so Nginx can proxy it. 
# This is crucial for fixing the "hardcoded IP" issue if IP changes.
export VITE_API_URL="/api"
npm install
npm run build
cd ..

# 3. Prepare Backend Environment File
echo ">>> Creating production .env..."
cat <<EOF > .env.production
PORT=3000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME
JWT_SECRET=super_secret_production_key_change_this
BCRYPT_SALT_ROUNDS=12
GEOHASH_PRECISION=6
# Cloudinary (Update these if you have them)
CLOUDINARY_NAME=
CLOUDINARY_KEY=
CLOUDINARY_SECRET=

# Email Services (Gmail)
EMAIL_USER=rahulcr777bvp@gmail.com
EMAIL_PASS="xvny slmq nzok qrmd"
EOF

# 4. ZIP Artifacts
echo ">>> Zipping files for transfer..."
tar -czf deployment_package.tar.gz \
    "$BACKEND_DIR/package.json" \
    "$BACKEND_DIR/package-lock.json" \
    "$BACKEND_DIR/index.js" \
    "$BACKEND_DIR/force_schema_sync.js" \
    "$BACKEND_DIR/ecosystem.config.js" \
    "$BACKEND_DIR/src" \
    "$BACKEND_DIR/migrations" \
    "$BACKEND_DIR/uploads" \
    ".env.production" \
    "$FRONTEND_DIR/dist"

# 5. Transfer to EC2
echo ">>> Transferring to EC2 (this may take a minute)..."
scp -i "$PEM_FILE" -o StrictHostKeyChecking=no deployment_package.tar.gz ubuntu@$EC2_IP:/home/ubuntu/

# 6. Remote Setup & Install
echo ">>> Running Setup on EC2..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'

    # Update & Install Dependencies
    echo "--> Installing System Deps..."
    sudo apt-get update -y
    sudo apt-get install -y nginx nodejs npm zip

    # Install Global Node Tools
    sudo npm install -g pm2 n
    sudo n 18 # Use Node v18

    # Extract Files
    echo "--> Extracting Files..."
    rm -rf app
    mkdir -p app/backend
    tar -xzf deployment_package.tar.gz -C app/

    # Move Backend
    mv app/animal-rescue-backend/* app/backend/
    mv app/.env.production app/backend/.env

    # Setup Backend
    echo "--> Setting up Backend..."
    cd app/backend
    npm install --production
    
    # Run Schema Sync (Repair Mode)
    echo "--> Synchronizing Database Schema..."
    node force_schema_sync.js

    # Ensure uploads directory is writable
    mkdir -p app/backend/uploads
    chmod 777 app/backend/uploads

    # Start with PM2
    pm2 stop animal-rescue-backend || true
    pm2 start ecosystem.config.js --env production
    pm2 save

    # Setup Frontend (Nginx)
    echo "--> Setting up Nginx..."
    sudo rm -rf /var/www/html/*
    sudo cp -r ../animal-rescue-frontend/dist/* /var/www/html/

    # Write Nginx Config with Reverse Proxy
    # This proxies /api -> localhost:3000 and serves static files
    sudo bash -c 'cat <<EOF > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    # Increase upload size limit
    client_max_body_size 50M;

    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        # Rewrite /api/foo to /foo
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Socket.IO Proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF'

    # Restart Nginx
    sudo systemctl restart nginx

    echo "=== DEPLOYMENT COMPLETE ==="
ENDSSH

echo ""
echo "Deployment Finished!"
echo "Visit your site at: http://$EC2_IP"
echo "Note: The database password in script is set to 'AnimalRescue2024!'. If yours is different, you must update the .env on the server."

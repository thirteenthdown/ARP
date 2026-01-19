#!/bin/bash

# Update and install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Remove default nginx config if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

# Copy the new configuration
sudo cp nginx.conf /etc/nginx/sites-available/animalnow.club

# Enable the site
sudo ln -sf /etc/nginx/sites-available/animalnow.club /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx to apply changes
sudo systemctl reload nginx

# Obtain SSL certificate
# NOTE: Replace admin@animalnow.club with your actual email if you prefer
sudo certbot --nginx -d animalnow.club --non-interactive --agree-tos -m admin@animalnow.club --redirect

echo "Setup complete! https://animalnow.club should now be active."

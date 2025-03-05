#!/bin/bash
echo "Running deployment script..."
npm install
npm run migrate
npm run seed
pm2 restart trader7
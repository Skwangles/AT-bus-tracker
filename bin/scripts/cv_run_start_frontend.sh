#!/bin/bash

echo "Starting the front-end"
cd "$CV_HOME_DIR"/Apps/campusvirtual-backend
cp "$CV_HOME_DIR"/.env .
npm run build
npm run start

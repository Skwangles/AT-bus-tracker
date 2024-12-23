cd Config

echo "This system is now mostly designed around SQLite3 - You will need to dump and import that to serve it on Postgres (and make the UI use it)"
sudo apt install libpqxx-dev

docker-compose --env-file ../.env up -d

cd ..
echo "Note: You will have to change the credentials in all db.ts files in Apps/ to match - Goodluck!"
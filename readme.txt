cd ~
apk update && apk add git python3 openssl

# Якщо папка раптом існує, видалимо її для чистоти експерименту
rm -rf ish-maps-server

# Клонуємо ваш репозиторій з GitHub
git clone https://github.com/LORG1996/ish-maps-server.git

# Робимо завантажений скрипт виконуваним
chmod +x ~/ish-maps-server/setup.sh


nano ~/.profile

sh ~/ish-maps-server/setup.sh

cd ~/ish-maps-server && git pull && chmod +x setup.sh
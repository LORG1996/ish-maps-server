#!/bin/sh

# Переходимо в папку проєкту
cd ~/ish-maps-server

# Запускаємо утримання фонового режиму через геолокацію (щоб iOS не присипляла iSH)
if [ -e /dev/location ]; then
    cat /dev/location > /dev/null 2>&1 &
    echo "Фоновий режим (Location) активовано."
fi

# Зупиняємо попередній сервер (якщо висів) і запускаємо новий
pkill -f server.py
python3 server.py &

echo "Сервер запущено у фоні на https://localhost:8443"

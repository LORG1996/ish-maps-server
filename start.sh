#!/bin/sh

# Переходимо в папку проєкту
cd ~/ish-maps-server

# Зупиняємо попередній сервер (якщо висів) і миттєво запускаємо новий
pkill -f server.py
python3 server.py &
#!/bin/sh

# Переходимо в паку проєкту
cd ~/ish-maps-server

# Генеруємо SSL-сертифікат, якщо його ще немає
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost" > /dev/null 2>&1
fi

# Створюємо Python-скрипт сервера, якщо він відсутній у репозиторії
if [ ! -f "server.py" ]; then
    cat << 'EOF' > server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

server_address = ('0.0.0.0', 8443)
httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print("Сервер запущено на https://localhost:8443")
httpd.serve_forever()
EOF
fi

# Зупиняємо попередній сервер і запускаємо новий у фоні з локальних файлів
pkill -f server.py
python3 server.py &
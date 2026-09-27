from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

server_address = ('127.0.0.1', 8443)
httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print("Сервер запущено на https://localhost:8443")
httpd.serve_forever()
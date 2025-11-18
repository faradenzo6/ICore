#!/bin/sh
# Генерация самоподписанного SSL сертификата для контейнера

CERT_DIR="/app/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -days 365 \
  -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:0.0.0.0"

echo "SSL certificate generated in $CERT_DIR"


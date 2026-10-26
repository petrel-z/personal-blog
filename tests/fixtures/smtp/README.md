These certificate and key files are public, disposable fixtures for loopback-only SMTP tests.
They are not production credentials. Only test child processes trust this certificate through
NODE_EXTRA_CA_CERTS; production TLS verification is never disabled or configured to trust it.

Regenerate from the repository root when the certificate expires:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -keyout tests/fixtures/smtp/localhost-key.pem -out tests/fixtures/smtp/localhost-cert.pem -days 3650 -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```

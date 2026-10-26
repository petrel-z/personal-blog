import net, { type Socket } from 'node:net'
import tls from 'node:tls'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Minimal loopback SMTP fixture: messages stay in this test process, never relayed. */
export async function startCaptureSmtp(mode: 'tls' | 'starttls' | 'plaintext') {
  const sockets = new Set<Socket>()
  const messages: string[] = []
  const commands: string[] = []
  const credentials = {
    key: readFileSync(resolve('tests/fixtures/smtp/localhost-key.pem')),
    cert: readFileSync(resolve('tests/fixtures/smtp/localhost-cert.pem')),
  }
  function track(socket: Socket) {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
  }
  function attach(socket: Socket, encrypted: boolean, greeting: boolean) {
    track(socket)
    let buffer = ''
    let data: string[] | null = null
    if (greeting) socket.write('220 localhost SMTP test fixture\r\n')
    socket.on('data', chunk => {
      buffer += chunk.toString()
      let end: number
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (data) {
          if (line === '.') {
            messages.push(data.join('\r\n'))
            data = null
            socket.write('250 Message captured\r\n')
          } else data.push(line.replace(/^\.\./, '.'))
          continue
        }
        const command = line.split(' ')[0].toUpperCase()
        commands.push(command) // Never store authentication payloads.
        switch (command) {
          case 'EHLO':
          case 'HELO':
            socket.write(`250-localhost\r\n${!encrypted && mode === 'starttls' ? '250-STARTTLS\r\n' : ''}250 AUTH PLAIN\r\n`)
            break
          case 'STARTTLS':
            if (mode !== 'starttls' || encrypted) { socket.write('502 TLS unavailable\r\n'); break }
            socket.removeAllListeners('data')
            socket.write('220 Ready for TLS\r\n')
            attach(new tls.TLSSocket(socket, { isServer: true, secureContext: tls.createSecureContext(credentials) }), true, false)
            return
          case 'AUTH': socket.write('235 Authenticated\r\n'); break
          case 'MAIL':
          case 'RCPT': socket.write('250 OK\r\n'); break
          case 'DATA': data = []; socket.write('354 End with dot\r\n'); break
          case 'QUIT': socket.end('221 Goodbye\r\n'); break
          default: socket.write('250 OK\r\n')
        }
      }
    })
  }
  const server = mode === 'tls'
    ? tls.createServer(credentials, socket => attach(socket, true, true))
    : net.createServer(socket => attach(socket, false, true))
  server.on('connection', track)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  return {
    port: (server.address() as net.AddressInfo).port,
    messages,
    commands,
    async close() {
      sockets.forEach(socket => socket.destroy())
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}

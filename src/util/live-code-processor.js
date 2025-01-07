_STD_.ws.open(
  [
    'wss://websocket-proxy-1.prod.gke.acurast.com/',
    'wss://websocket-proxy-2.prod.gke.acurast.com/',
  ],
  () => {
    print('open: success')
    _STD_.ws.registerPayloadHandler((payload) => {
      const toHex = (type, data) => {
        return Buffer.from(JSON.stringify({ type, data }), 'utf8').toString(
          'hex'
        )
      }

      const respond = (recipient, data) => {
        _STD_.ws.send(recipient, data)
      }

      try {
        const code = Buffer.from(payload.payload, 'hex').toString('utf8')

        respond(payload.sender, toHex('start', ''))

        console.log = (...args) => {
          print(args)
          respond(payload.sender, toHex('log', args))
        }

        const wrapped = `(() => { ${code} })()`

        const evalResult = eval(wrapped)

        Promise.resolve(evalResult).then((res) => {
          print('Sending back response')
          print(res)
          respond(payload.sender, toHex('success', res))
        })
      } catch (err) {
        print('Sending back error')
        print(err)
        respond(payload.sender, toHex('error', err.message))
      }
    })
  },
  (err) => {
    print('open: error ' + err)
  }
)

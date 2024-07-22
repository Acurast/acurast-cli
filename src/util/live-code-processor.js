_STD_.ws.open(
    ["wss://websocket-proxy-1.prod.gke.acurast.com/", "wss://websocket-proxy-2.prod.gke.acurast.com/"],
    () => {
        print("open: success")
        _STD_.ws.registerPayloadHandler((payload) => {
            const pack = (type, data) => {
                return _STD_.chains.tezos.encoding.pack(JSON.stringify({ type, data }))
            }

            const respond = (recipient, data) => {
                _STD_.ws.send(recipient, data)
            }

            try {
                const unpacked = _STD_.chains.tezos.encoding.unpack(payload.payload)

                print(unpacked);

                console.log = (...args) => {
                    print(args)
                    respond(payload.sender, pack("log", args))
                }

                const evalResult = eval(unpacked);

                Promise.resolve(evalResult).then(res => {
                    print("Sending back response");
                    print(res);
                    respond(payload.sender, pack("success", res))
                })
            } catch (err) {
                print("Sending back error");
                print(err)
                respond(payload.sender, pack("error", err.message))
            }
        })
    },
    (err) => {
        print("open: error " + err)
    }
);
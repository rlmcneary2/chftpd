"use strict";


const FtpDataConnection = require("./FtpDataConnection");
const log = require("../logging/logger");
const tcpAsync = require("../tcp/tcpAsync");
const TcpServer = require("../tcp/TcpServer");


class FtpPassiveServer extends TcpServer {

    constructor() {
        super();
        this._clientSocketId = null;

        let self = this;
        this._accepted = new Promise(resolve => {
            self.addListener("accept", info => {
                if (self._clientSocketId !== null) {
                    log.warning("FtpPassiveServer - already accepted a connection. Only one connection will be accepted.");
                    tcpAsync.tcpClose(info.clientSocketId);
                    return;
                }

                self._clientSocketId = info.clientSocketId;
                resolve();
            });
        });
    }

    createConnection() {
        const fdc = new FtpDataConnection();
        return fdc;
    }

    get connection() {
        let self = this;
        return this._accepted
            .then(() => {
                return self._connections.get(self._clientSocketId);
            });
    }
}

module.exports = FtpPassiveServer;

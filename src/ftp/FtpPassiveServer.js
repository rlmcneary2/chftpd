"use strict";


const FtpDataConnection = require("./FtpDataConnection");
const tcpAsync = require("../tcp/tcpAsync");
const TcpServer = require("../tcp/TcpServer");


class FtpPassiveServer extends TcpServer {

    constructor() {
        super();
        this._accepted = false;

    }

    createConnection() {
        return new FtpDataConnection();
    }

    get acceptHandler() {
        if (this._acceptHandler === null) {
            let sah = super.acceptHandler;
            this._acceptHandler = function(info) {
                if (this._socketId !== info.socketId) {
                    return;
                }

                if (this._accepted) {
                    tcpAsync.tcpClose(info.socketId);
                    return;
                }

                this._accepted = true;
                
                sah(info);

            }.bind(this);
        }

        return this._acceptHandler;
    }

}

module.exports = FtpPassiveServer;

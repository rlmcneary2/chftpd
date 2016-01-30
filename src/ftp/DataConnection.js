"use strict";


var CommandHandler = require("./CommandHandler");
var logger = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


/**
 * This is used to send data to a client using a passive connection.
 */
class DataConnection extends TcpServer {

    constructor() {
        super();
        this._commandHandler = new CommandHandler();
    }

    // Override base.
    startListening(address) {
        this.once("accept", evt => {
            logger.verbose(`DataConnection.js accept handler() - accept event: ${JSON.stringify(evt) }`);
        });

        this.on("receive", evt => {
            var dataView = new DataView(evt.data);
            var request = _textDecoder.decode(dataView);
            console.log(`DataConnection.js receive handler() - request [${request.trim() }]`);

            this._commandHandler.handleRequest(this, null, request, message => {
                console.log(`DataConnection.js receive handler() - response [${message.trim() }]`);
                var encodedMessage = _sendEncoder.encode(message);
                return this.send(evt.clientSocketId, encodedMessage.buffer);
            });
        });

        return super.startListening(address);
    }

}

module.exports = DataConnection;

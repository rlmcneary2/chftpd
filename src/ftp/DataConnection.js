"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


/**
 * This is used to send data to a client using a passive connection.
 */
class DataConnection extends TcpServer {

    constructor() {
        super();

        this._clientSocketId;
        this._sendEncoder;
        this._textDecoder;
    }

    set clientSocketId(id) {
        this._clientSocketId = id;
    }

    set sendEncoder(encoder) {
        this._sendEncoder = encoder;
    }
    
    set textDecoder(decoder){
        this._textDecoder = decoder;
    }

    list(server, state, command) {
        // Get the current directory.
        return Promise.resolve(fileSystem.getFileSystemEntry(state.currentDirectoryEntryId))
            .then(currentDirectory => {
                // Get a list of files and directories.
                return Promise.resolve(fileSystem.getDirectoryEntries(currentDirectory));
            })
            .then(entries => {
                // TODO: make a file system metadata request to get information about each entry such as the size etc.
                
                // If the command has an argument "-a" ignore it (always return all the entries).
                // Convert to "EPLF" (hopefully all clients accept it?)
                const lsEntries = entries.map(entry => {
                    let fileSize = "         100"; // 10 chars
                    let month = "Jan";
                    let day = " 1"; // 2 chars
                    let hour = "01";
                    let minute = "01";
                    if (entry.isDirectory) {
                        //return `+/,\t${entry.name}\r\n`;
                        fileSize = "           0"; // 10 chars
                        return `drwxr-xr-x 1 owner group ${fileSize} ${month} ${day} ${hour}:${minute} ${entry.name}/\r\n`;
                    } else if (entry.isFile) {
                        //return `+r,\t${entry.name}\r\n`;
                        return `-rw-r--r-- 1 owner group ${fileSize} ${month} ${day} ${hour}:${minute} ${entry.name}\r\n`;
                    }
                });
                
                // Join the strings. Send the response.
                const message = lsEntries.join("");
                return send.call(this, message);
            })
            .then(() => {
                return "226 Transfer complete\r\n";
            });
    }

    // Override base.
    startListening(address) {
        this.once("accept", evt => {
            logger.verbose(`DataConnection.js accept handler() - accept event: ${JSON.stringify(evt) }`);
        });

        this.on("receive", evt => {
            if (this._textDecoder) {
                const dataView = new DataView(evt.data);
                const request = this._textDecoder.decode(dataView);
                logger.info(`DataConnection.js receive handler() - request [${request.trim() }]`);
            }
        });

        return super.startListening(address);
    }

}


module.exports = DataConnection;


function send(message) {
    logger.verbose(`DataConnection.js send() - message [${message.trim()}]`);
    const response = this._sendEncoder.encode(message);
    return Promise.resolve(this.send(this._clientSocketId, response.buffer))
        .then(result => {
            logger.verbose(`DataConnection.js send() - result [${JSON.stringify(result)}].`);
        });
}

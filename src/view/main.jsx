"use strict";


var ftpServer = require("../ftp/ftpServer");
const log = require("../logging/logger");
const NetworkInterfaces = require("./NetworkInterfacesContainer.jsx");
var React = require("react");
var ServerConfiguration = require("../model/ServerConfiguration");


module.exports = React.createClass({

    getInitialState() {
        return { selectedInterfaceIndex: -1, ftpPort: "-", interfaces: null, rootEntryName: "choose...", output: "waiting..." };
    },

    componentDidMount() {
        componentMounted.bind(this)();
    },

    render() {
        var interfaces = null;
        var selectedName = null;
        if (this.state.interfaces !== null && 0 < this.state.interfaces.length) {
            interfaces = this.state.interfaces.map(function (ni) {
                return (
                    <option key={ni.name} value={ni.name}>{ni.address}</option>
                );
            });

            selectedName = this.state.selectedInterfaceIndex < 0 ? "" : this.state.interfaces[this.state.selectedInterfaceIndex].name;
        }

        var select = (
            <select value={selectedName} onChange={interfaceSelected.bind(this) }>{interfaces}</select>
        );

        // return (
        //     <div>
        //         <section>
        //             <span>Available network interfaces</span>{select}
        //             <p><span>port: {this.state.ftpPort}</span></p>
        //             <button onClick={selectRootDirectory.bind(this)}>Root</button><span> {this.state.rootEntryName}</span><br />
        //             <button onClick={startServer.bind(this)}>Start</button>
        //         </section>
        //         <pre>{this.state.output}</pre>
        //     </div>
        // );
        return (
            <div>
                <section>
                    <NetworkInterfaces id="network-interfaces" />
                    <p><span>port: {this.state.ftpPort}</span></p>
                    <button onClick={selectRootDirectory.bind(this) }>Root</button><span> {this.state.rootEntryName}</span><br />
                    <button onClick={startServer.bind(this) }>Start</button>
                </section>
                <pre>{this.state.output}</pre>
            </div>
        );
    }

});


var _serverConfiguration = null;


function componentMounted() {
    var self = this;

    _serverConfiguration = new ServerConfiguration();
    ftpServer.getRootDirectoryEntry()
        .then(function (entry) {
            return Promise.resolve(_serverConfiguration.getRootEntryFullPath(entry));
        })
        .then(function (path) {
            if (path) {
                self.setState({ rootEntryName: path });
            }
        })
        .catch(err => {
            log.error(`main.jsx componentMounted - error getting root directory entry. ${err.message || JSON.stringify(err)}`);
        });

    ftpServer.getNetworkInterfaces()
        .then(function (interfaces) {
            self.setState({ interfaces, selectedInterfaceIndex: 0 });
        });

    ftpServer.on("command-arrived", responseArrivedHandler, this);
}

function responseArrivedHandler(request) {
    this.setState({ output: this.state.output + request });
}

function interfaceSelected(evt) {
    if (evt.target.selectedIndex < 0) {
        return;
    }

    this.setState({ selectedInterfaceIndex: evt.target.selectedIndex });
}

function selectRootDirectory() {
    var self = this;
    chrome.fileSystem.chooseEntry({ type: "openDirectory" }, function (entry) {
        if (!entry) {
            return;
        }

        var id = chrome.fileSystem.retainEntry(entry);

        ftpServer.setRootDirectoryEntryId(id)
            .then(function () {
                return Promise.resolve(_serverConfiguration.getRootEntryFullPath(entry));
            })
            .then(function (path) {
                self.setState({ rootEntryName: path });
            });
    });
}

function startServer() {
    if (this.state.selectedInterfaceIndex < 0) {
        return;
    }

    this.setState({ output: "" });

    var address = this.state.interfaces[this.state.selectedInterfaceIndex].address;
    var self = this;
    Promise.resolve(ftpServer.listen(address))
        .then(function () {
            var message = self.state.output;
            message += `address: ${ftpServer.address}:${ftpServer.port}\r\n`;
            self.setState({ ftpPort: ftpServer.port, output: message });
        })
        .catch(function (err) {
            console.error(`ftpServer error: ${err}.`);
        });
}
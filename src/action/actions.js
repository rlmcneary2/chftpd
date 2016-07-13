"use strict";


const ftpServer = require("../ftp/ftpServer");
const log = require("../logging/logger");


module.exports = {

    actions: Object.freeze({
        interfaceGetAllEnd: "INTERFACE-GET-ALL-END",
        interfaceGetAllStart: "INTERFACE-GET-ALL-START",
        interfaceSelectionChanged: "INTERFACE-SELECTION-CHANGED"
    }),

    interfaceGetAll() {
        log.verbose("actions.js interfaceGetAll");
        return dispatch => {
            dispatch(this.interfaceGetAllStart());

            const self = this;
            ftpServer.getNetworkInterfaces()
                .then(result => {
                    const interfaces = [...result];
                    interfaces.forEach(item => {
                        item.selected = false;
                    });
                    dispatch(self.interfaceGetAllEnd(interfaces));
                });
        };
    },

    interfaceGetAllEnd(interfaces) {
        log.verbose(`actions.js interfaceGetAllEnd - interfaces=${interfaces}`);
        return { interfaces, type: this.actions.interfaceGetAllEnd };
    },

    interfaceGetAllStart() {
        log.verbose("actions.js interfaceGetAllStart");
        return { type: this.actions.interfaceGetAllStart };
    },

    interfaceSelectionChanged(address, selected) {
        log.verbose(`actions.js interfaceSelectionChanged - address=${address}, selected=${selected}`);
        return { address, selected, type: this.actions.interfaceSelectionChanged };
    }

};

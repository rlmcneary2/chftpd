"use strict";


const actions = require("../action/actions").actions;


/*
{
    interfaceAction: "",
    interfaces: [
        {
            address: "192.168.1.1",
            name: "{GUID}",
            prefixLength: 0,
            selected: false
        }
    ],
}
*/

module.exports = (state = {}, action) => {

    let nextState = state;
    switch (action.type) {

        case actions.interfaceGetAllEnd: {
            nextState = copyState(state, "interfaceAction");
            nextState.interfaces = action.interfaces;
            break;
        }

        case actions.interfaceGetAllStart: {
            nextState = Object.assign({}, state);
            nextState.interfaceAction = action.type;
            break;
        }

        case actions.interfaceSelectionChanged: {
            nextState = Object.assign({}, state);
            nextState.interfaces = [...state.interfaces];
            const a = nextState.interfaces.find(item => {
                return item.address === action.address;
            });
            if (a) {
                a.selected = action.selected;
            }
            break;
        }

    }

    return nextState;
};

function copyState(state, ignore) {
    let arrIgnore;
    if (!ignore) {
        arrIgnore = [];
    } else {
        if (Array.isArray(ignore)) {
            arrIgnore = ignore;
        } else {
            arrIgnore = [ignore];
        }
    }

    const nextState = {};
    for (let prop in state) {
        if (arrIgnore.includes(prop)) {
            continue;
        }

        nextState[prop] = state[prop];
    }

    return nextState;
}

"use strict";


const action = require("../action/actions");
const {connect} = require("react-redux");
const NetworkInterfaces = require("./NetworkInterfaces.jsx");


module.exports = connect(mapStateToProps, mapDispatchToProps, mergeProps)(NetworkInterfaces);


function mapStateToProps(state) {
    return Object.assign({}, state.server);
}

function mapDispatchToProps(dispatch) {
    return {

        interfaceGetAll() {
            dispatch(action.interfaceGetAll());
        },

        interfaceSelectionChanged(address, selected) {
            dispatch(action.interfaceSelectionChanged(address, selected));
        }

    };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
    const modStateProps = {};
    for (let prop in stateProps) {
        if (prop === "interfaces" || prop === "interfaceAction") {
            continue;
        }

        modStateProps[prop] = stateProps[prop];
    }

    const props = Object.assign({}, ownProps, modStateProps, dispatchProps);

    if (!stateProps.interfaces && !stateProps.interfaceAction) {
        setTimeout(() => {
            props.interfaceGetAll();
        });
    }

    if (stateProps.interfaces) {
        props.interfaces = [];
        stateProps.interfaces.forEach(item => {
            props.interfaces.push({
                address: item.address,
                onChange: evt => { props.interfaceSelectionChanged(item.address, evt.target.checked); },
                name: item.name,
                value: item.selected
            });
        });
    }

    return props;
}

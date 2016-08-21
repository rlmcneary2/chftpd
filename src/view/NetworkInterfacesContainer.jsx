"use strict";


const action = require("../action/actions");
const {connect} = require("react-redux");
const NetworkInterfaces = require("./NetworkInterfaces.jsx");


let _gettingInterfaces = false;


module.exports = connect(mapStateToProps, mapDispatchToProps, mergeProps)(NetworkInterfaces);


function mapStateToProps(state) {
    return Object.assign({}, state.server);
}

function mapDispatchToProps(dispatch) {
    return {

        interfaceGetAll() {
            dispatch(action.interfaceGetAll());
        },

        interfaceSelectionChanged(name, selected) {
            dispatch(action.interfaceSelectionChanged(name, selected));
        }

    };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
    const props = Object.assign({}, ownProps, stateProps, dispatchProps);

    if (!props.interfaces && !_gettingInterfaces) {
        _gettingInterfaces = true;
        setTimeout(() => {
            dispatchProps.interfaceGetAll();
        });
    } else {
        _gettingInterfaces = false;
    }

    return props;
}

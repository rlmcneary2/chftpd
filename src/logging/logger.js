"use strict";


module.exports = {

    level: 0,
    
    levels: Object.freeze({
        error: 0,
        warning: 1,
        info: 2,
        debug: 3,
        verbose: 4
    }),

    /**
     * Pass a string containing an informational message.
     */
    info() {
        if (this.levels.info < this.level){
            return;
        }

        var message = arguments[0];
        console.log(message);
    },
    
    /**
     * Pass a string containing a message.
     */
    verbose() {
        if (this.levels.verbose < this.level){
            return;
        }

        var message = arguments[0];
        console.log("%c" + message, "color:#BEBEBE; font-style:italic");
    },
    
    /**
     * Pass a string containing a warning message.
     */
    warning(){
        if (this.levels.warning < this.level){
            return;
        }

        var message = arguments[0];
        console.log("%c" + message, "color:#998C2C; font-style:bold");
    }
};

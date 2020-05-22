import { showSnackBar } from "../components/snackbar/snackbar";

/**
 *  show Queue of messages with a delay between each message
 *  and a delay before showing the first message
 *
 *  @returns void
 */
export const showMsg = {

   _msgQueue: [],
   _msgHandle: null,

   _invokedForFirstTime: true,

   _defaultStartDelay: 10000, // in ms (default 10 seconds)
   _defaultShowTimeout: 2000, // in ms (default 2 seconds)
   _defaultLabel: "SpartanLync Alert",

   /**
    *  UI Display Handler
    *
    *  @returns void
    */
   show: function (msg) {
      showSnackBar(msg);
      console.log(msg);
   },

   /**
    *  Prefix Message with a Label
    *
    *  @returns void
    */
   alert: function (msg, showTimeout, labelTxt) {
      const me = this;
      const alertMsg = (labelTxt || me._defaultLabel) + ": " + msg;
      me.msg(alertMsg, showTimeout);
   },

   /**
    *  Recursivly Queue Message(s)
    *
    *  @returns void
    */
   msg: function (msg, showTimeout, selfCalling) {
      const me = this;
      const showtime = showTimeout || me._defaultShowTimeout;
      const callingMyself = selfCalling || false;

      if (me._invokedForFirstTime) {
         me._invokedForFirstTime = false;
         this._msgHandle = setTimeout(function () {
            me.showAndWait(msg, showtime);
         }, me._defaultStartDelay);
      }
      else if (me._msgHandle === null || callingMyself) {
         me.showAndWait(msg, showtime);
      }
      else {
         me._msgQueue.push({ m: msg, s: showtime });
      }
   },

   /**
    *  Handler for showing Message, then pausing before quiting or showing next message
    *
    *  @returns void
    */
   showAndWait: function (msg, delay) {
      const me = this;
      me.show(msg);
      this._msgHandle = setTimeout(function () {
         if (me._msgQueue.length) {
            const itm = me._msgQueue.shift();
            me.msg(itm.m, itm.s, true);
         }
         else {
            me._msgHandle = null;
         }
      }, delay);
   },

   /**
    *  Getters/Setters for _defaultStartDelay (delay - in seconds)
    */
   get defaultStartDelay() {
      const me = this;
      return parseInt(me._defaultStartDelay) / 1000;
   },
   set defaultStartDelay(delay) {
      const me = this;
      if (parseInt(delay) >= 1) {
         me._defaultStartDelay = parseInt(delay) * 1000;
      }
   }
};
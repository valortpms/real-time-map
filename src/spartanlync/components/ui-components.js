import { showSnackBar } from "../../components/snackbar/snackbar";
import splSrv from "../services";
import splCfg from "../config";
import storage from "../../dataStore";
import ReactTooltip from "react-tooltip";
import { manageSensorDataContentUI } from "./ui-vehicles-config";

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
   _defaultLabel: splSrv.alertsDefaultLabelPrefix,

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

      me.defaultStartDelay = splSrv.alertsDefaultStartupDelay;
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

/**
 *  Perform page-redirect navigation to SpartanLync Tools Add-in
 *
 *  @returns void
 */
window.navigateToSplTools = (vehId, vehName) => {
   const splToolsPageName = splSrv.splStore.splMap.toolsPageName;
   console.log("----- Navigating to SpartanLync Tools Add-in [ " + splToolsPageName + " ] to view Vehicle [ " + vehName + " ]");

   if (splCfg.appEnv === "prod") {
      if (splSrv.state.hasAccessToPage(splToolsPageName)) {
         switchToSplTools(vehId, vehName);
      }
      else {
         const msgAlert = "SplMap Error: Your MyGeotab Account does not have sufficient permissions to allow switching to SpartanLync Tools...Please run SpartanLync Tools manually.";
         showMsg.alert(msgAlert);
      }
   }
   else {
      switchToSplTools(vehId, vehName);
   }
};

/**
 *  Handler for navigateToSplTools() to page re-direct in DEV or PROD environements
 *
 *  @returns void
 */
export function switchToSplTools(vehId, vehName) {
   const splToolsPageName = splSrv.splStore.splMap.toolsPageName;

   // close popups on Map or ConfigView panel
   manageSensorDataContentUI.close();
   storage.map.closePopup();

   // Perform page redirection in Browser or MyGeotab
   if (splCfg.appEnv === "prod") {
      splSrv.state.gotoPage(splToolsPageName, {
         switchToVehId: vehId,
         switchToVehName: vehName
      });
   }
   else {
      const url = splToolsPageName + "?q=switchToVehId:" + vehId + ",switchToVehName:" + encodeURI(vehName);
      location.href = url;
   }
};

/**
 *  Dynamic popups call Utility Function to rescan DOM for new tooltip content
 *
 *  @returns void
 */
window.refreshSplTooltips = () => {
   setTimeout(() => {
      ReactTooltip.rebuild();
   }, 1000);
};


/**
*
*  Checks performed looking for communication instructions from SplTools
*
*/
export const splToolsHelper = {

   _msgQueue: [],
   _msgHandle: null,


   /**
    * Scan environment for query parameters (passed by SplTools) intended for execution by SplMap
    *
    *  @returns void
    */
   scanForInstructions: function () {
      const me = this;
      const cmds = me.getCmds();

      cmds.get.map(cmd => {
         switch (cmd) {
            case "flyToVehId":
               const name = cmds.val("flyToVehName") ? cmds.val("flyToVehName") : cmds.val("flyToVehId");
               setTimeout(() => {
                  // Remove page redirect query parameters from browser URL
                  me.resetBrowserUrlHistory();

                  // Fly to current vehicle location
                  showMsg.msg("Flying To Vehicle '", name, "'");
                  flyToDevice(cmds.val("flyToVehId"));

               }, 5000);
               break;

            default:
         }
      });
   },

   /**
   * Remove page redirect query parameters from browser URL
   *
   *  @returns void
   */
   resetBrowserUrlHistory: function () {
      window.history.replaceState({}, document.title, splSrv._splMapUrl);
   },

   /**
    * Scan environment for query parameters
    *
    *  @returns object
    */
   getCmds: function () {
      const cmds = {
         get: [],
         data: {},
         val: function (k) {
            const me = this;
            return typeof me.data[k] !== "undefined" && me.data[k] ? me.data[k] : "";
         }
      };

      if (splCfg.appEnv === "prod") {
         const queryParams = splSrv.state.getState();
         for (const prop of Object.keys(queryParams)) {
            if (typeof queryParams[prop] !== "undefined" && queryParams[prop]) {
               cmds.data[prop] = queryParams[prop];
               cmds.get.push(prop);
            }
         }
      }
      else {
         let queryParams = window.location.search;
         if (queryParams.indexOf("q=") > -1) {
            queryParams = queryParams.split("q=")[1];
            if (queryParams.indexOf(",") > -1) {
               queryParams = queryParams.split(",");
               queryParams.map(q => {
                  const cmd = q.indexOf(":") > -1 ? q.split(":")[0] : q;
                  const val = q.indexOf(":") > -1 ? decodeURIComponent(q.split(":")[1]) : "";
                  cmds.data[cmd] = val;
                  cmds.get.push(cmd);
               });
            }
         }
      }
      return cmds;
   }

};

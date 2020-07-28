/* eslint-disable one-var */
import moment from "moment-timezone";

const SpartanLyncServices = {

   /**
    *  Settings
    */

   debug: false,                                            // Enable detailed debugging to Console on API calls

   splHumanTimeFormat: "dd MMM DD, YYYY LT z",              // moment() format for converting from UNIX timestamp to Human format in User's Timezone
   splStoreSyncRetry: 60000,                                // (Default: 1 min) How frequently to retry saving storage object to remote server

   sensorDataLifetime: 180,                                 // (Default: 180 seconds) Afer this period, cached vehicle sensor data is refreshed from API (in seconds)
   sensorDataNotFoundMsg: "No Sensors Found",               // Message shows when no SpartanLync sensors were found for a vehicle search
   onErrorCloseUIDelay: 5,                                  // (In seconds) How many seconds to delay before closing Sensor Data Window showing error message

   sensorSearchRetryRangeInDays: [1, 2, 7, 30, 60, 90],     // Days from now to search for sensors (on App Start)
   sensorSearchTimeRangeForRepeatSearchesInSeconds: 3600,   // (Default: 1 Hour) 3600 Seconds from now to use for repeating sensor search's

   splToolsNotInstalledErrorMsg: "The SpartanLync Tools Add-In was not found. Please install and run to enable SpartanLync Temptrac / TPMS features",
   splToolsSearchRetry: 60000,                              // (Default: 1 min) How often to poll backend for SplTools Add-In configured for this user in this database

   alertsDefaultStartupDelay: 8,                            // (Default: 8 seconds) UI will start showing alerts XX seconds after App loads in Browser
   alertsDefaultLabelPrefix: "SpartanLync Alert",           // Using showMsg.alert(); Unles overidden, what message to prefix the specified alert

   buildMetadataFilename: "build.meta",                     // Filename residing in deployment directory containg build metadata, shown when hovering over SpartanLync Map Watermark

   vehComponents: {                                         // Id's and Description's of supported Vehicles components
      "tractor": "Tractor",
      "trailer1": "Trailer 1",
      "trailer2": "Dolly",
      "trailer3": "Trailer 2"
   },

   splLanguages: {                                          // Languages supported by SpartanLync Tools
      "en": "English",
      "fr": "Fran&#231;ais",
      "es": "Espa&#241;ol"
   },

   splDeeperAddIn: {                                         // Widget Configuration Settings for the MyGeotab Map SpartanLync Deeper Add-In
      name: "SplGeotabMap",
      json: "{\"name\":\"SplGeotabMap\",\"supportEmail\":\"lmitchell@spartanlync.com\",\"version\":\"1.0.1.01\",\"items\":[{\"page\":\"map\",\"mapScript\":{\"url\":\"https://help.spartansense.com/geotab/splgeotabmap/splgeotabmap.html\"}}],\"isSigned\":false}",
      msgs: {
         initMsg: "Checking Installation Status",
         successMsg: "Successfully {op} SpartanLync {intofrom} MyGeotab Map",
         installBtnLbl: "Install SpartanLync into MyGeotab Map",
         unInstallBtnLbl: "Remove SpartanLync from MyGeotab Map",
         cannotInstallBtnLbl: "Cannot Add/Remove SpartanLync from MyGeotab Map",
         cannotInstallBtnSubLbl: "Not enough priviliges...Please have your database Owner/Admin use this buttom",

         addInInstalledMsg: "--- SpartanLync Deeper Add-In for Geotab Map Installed",
         addInNotInstalledMsg: "--- SpartanLync Deeper Add-In for Geotab Map NOT Installed",

         failureMsg: "Failed to {op} SpartanLync {tofrom} MyGeotab Map",
         initFailureMsg: "Failed to Initialize SpartanLync in MyGeotab Map",
         errFetchUserDataMsg: "Missing user account data after Fetching from Geotab API",
         errFetchSystemDataMsg: "Missing System Settings data after Fetching from Geotab API",

         featurePreviewEnabledForUser: "--- Feature Preview already Enabled for [ {username} ]",
         featurePreviewOpSuccessMsg: "--- Successfully {op} Feature Preview for [ {username} ]",
         featurePreviewOpFailureMsg: "Failed to {op} Feature Preview for user [ {username} ]"
      }
   },


   /**
    *  Private Variables
    */

   sessionMgr: null,
   goLib: null,
   sdataTools: null,

   state: null,
   _api: null,
   _credentials: {
      db: "",
      username: "",
      server: "",
      sessionId: "",
   },

   _splToolsInstalled: false,
   _splStore: null,
   _splMapUrl: null,
   _dbDeviceIds: null,
   _timeZone: null,

   /**
    *  Getters/Setters for _splStore
    */
   get splStore() {
      const me = this;
      return me._splStore;
   },
   set splStore(store) {
      const me = this;
      me._splStore = store;

      // Set timestamp of local Storage object to NOW
      me._splStore.timestamp = moment().utc().format();

      // Save Remotely
      me.sessionMgr.syncSettings(me._splStore, me._dbDeviceIds,
         (accepted) => {
            // If accepted by Remote, remoteStore = localStore
            // If rejected by Remote, remoteStore should be saved to local browser
            if (accepted) {
               console.log("SplMapService: Successfully updated SplStore Remotely");
            }
            else {
               const retryTimeoutInSeconds = parseInt(me.splStoreSyncRetry / 1000);
               console.log("SplMapService: Failed to updated SplStore remotely...Will Retry in " + retryTimeoutInSeconds + " seconds");
               setTimeout(function () {
                  me.splStore = me._splStore;
               }, me.splStoreSyncRetry);
            }
         },
         // Error Handler
         (errMsg) => {
            console.log("SplMapService: Failed to updated SplStore remotely...Reason: " + errMsg);
         });
   },

   /**
    * Register callbacks to event(s) and execute those callbacks when event(s) occur
    */
   events: {

      _events: {},

      /**
      * Register callbacks to event array
      *
      * @param {string}   event        - Name of Event (Required)
      * @param {function} callback     - Callback executed when this event occurs
      * @param {boolean}  execOnceOnly - Execute Callback once, then remove from Event Array (Optional - Default: true)
      *
      * @returns void
      */
      register: function (event, callback, execOnceOnly) {
         const me = this;
         const execOneTime = typeof execOnceOnly !== "undefined" && execOnceOnly === false ? false : true;

         if (event !== null && typeof event !== "undefined" && typeof callback === "function") {
            if (typeof me._events[event] === "undefined") {
               me._events[event] = [{
                  func: callback,
                  execOnce: execOneTime
               }];
            }
            else {
               me._events[event].push({
                  func: callback,
                  execOnce: execOneTime
               });
            }
         }
      },

      /**
      * Invoke registered callbacks (if any) on a event(s) array
      *
      * @param {string} event - Name of Event Array to execute stored callbacks (Required)
      *
      * @returns void
      */
      exec: function (event) {
         const me = this;
         if (event !== null &&
            typeof event !== "undefined" &&
            typeof me._events[event] !== "undefined" &&
            Array.isArray(me._events[event]) &&
            me._events[event].length
         ) {
            me._events[event] = me._events[event].filter((callee, EvtIdx) => {
               if (typeof callee.func === "function") {
                  callee.func();
               }
               return !callee.execOnce;
            });
         }
      }
   },

   /**
    * Convert from Unix timestamp to Human-readable time
    * eg. Sa Aug 17, 2020 7:00 PM EDT
    *
    *  @returns string
    */
   convertUnixToTzHuman: function (unixTime) {
      const me = this;
      return isNaN(unixTime) ? null : moment.unix(unixTime).format(me.splHumanTimeFormat);
   }
};

export default SpartanLyncServices;
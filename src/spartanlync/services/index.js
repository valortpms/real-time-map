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
               console.log("SplMapServices: Successfully updated SplStore Remotely");
            }
            else {
               const retryTimeoutInSeconds = parseInt(me.splStoreSyncRetry / 1000);
               console.log("SplMapServices: Failed to updated SplStore remotely...Will Retry in " + retryTimeoutInSeconds + " seconds");
               setTimeout(function () {
                  me.splStore = me._splStore;
               }, me.splStoreSyncRetry);
            }
         },
         // Error Handler
         (errMsg) => {
            console.log("SplMapServices: Failed to updated SplStore remotely...Reason: " + errMsg);
         });
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
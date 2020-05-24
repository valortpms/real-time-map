/* eslint-disable one-var */
import splCfg from "../config";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { InitSplAPI, InitSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "../services/api//temptrac-tpms";
import { showMsg } from "../ui-components";
import moment from "moment";

const SpartanLyncServices = {

   debug: false,

   splStoreSyncRetry: 60000,  // (Default: 1 min) How frequently to retry saving storage object to remote server

   sensorSearchRetryRangeInDays: [1, 2, 7, 30, 60, 90],    // Days from now to search for sensors (on App Start)
   sensorSearchTimeRangeForRepeatSearchesInSeconds: 3600,  // 3600 Seconds from now to use for repeating sensor search's (default: 1 Hour)

   splToolsNotInstalledErrorMsg: "The SpartanLync Tools Add-In was not found. Please install and run to enable SpartanLync Temptrac / TPMS features",
   splToolsSearchRetry: 60000,  // (Default: 1 min) How often to poll backend for SplTools Add-In configured for this user in this database
   _splToolsInstalled: false,
   _splStore: null,
   _dbDeviceIds: null,

   _api: null,
   state: null,
   sessionMgr: null,
   goLib: null,

   _credentials: {
      db: "",
      username: "",
      server: "",
      sessionId: "",
   },

   init: function () {
      const me = this;
      me.debug = splCfg.appEnv === "dev" ? true : false;

      me._credentials.db = userInfo.database;
      me._credentials.username = userInfo.userName;
      me._credentials.server = userInfo.server;
      me._credentials.sessionId = userInfo.sessionId;

      me.state = apiConfig.state;
      me._api = new InitSplAPI(splCfg.splApiUrl);
      me.sessionMgr = new InitSplSessionMgr(me._api, me._credentials);
      me.goLib = INITGeotabTpmsTemptracLib(
         me._api,
         me.sensorSearchRetryRangeInDays,
         me.sensorSearchTimeRangeForRepeatSearchesInSeconds
      );

      showMsg.defaultStartDelay = 8; // Start showing messages 8 seconds after browser load)
   },

   checkForSplTools: function () {
      const me = this;
      me.sessionMgr.getSettings((remoteStore, dbDeviceIds) => {
         if (remoteStore === null || typeof remoteStore.splMap === "undefined") {
            showMsg.alert(me.splToolsNotInstalledErrorMsg);
            setTimeout(function () {
               me.checkForSplTools();
            }, me.splToolsSearchRetry);
            return;
         }
         me._splToolsInstalled = true;
         me._dbDeviceIds = dbDeviceIds;
         remoteStore.splMap.found = true;
         remoteStore.splMap.mapsPageName = splCfg.appEnv === "dev" ? window.location.href : window.location.hash.replace("#", "");
         me.splStore = remoteStore;
      });
   },

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
         (accepted, remoteStore, dbDeviceIds) => {
            // If accepted by Remote, remoteStore = localStore
            // If rejected by Remote, remoteStore should be saved to local browser
            if (accepted) {
               console.log("Successfully updated SplStore Remotely");
            }
            else {
               const retryTimeoutInSeconds = parseInt(me.splStoreSyncRetry / 1000);
               console.log("Failed to updated SplStore remotely...Will Retry in " + retryTimeoutInSeconds + " seconds");
               setTimeout(function () {
                  me.splStore = me._splStore;
               }, me.splStoreSyncRetry);
            }
         },
         // Error Handler
         (errMsg) => {
            console.log("Failed to updated SplStore remotely...Reason: " + errMsg);
         });
   }
};

export default SpartanLyncServices;

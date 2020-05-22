/* eslint-disable one-var */
import splCfg from "../config";
import { userInfo } from "../../dataStore/api-config";
import { InitSplAPI, InitSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "../services/api//temptrac-tpms";
import { showMsg } from "../ui-components";

const SpartanLyncServices = {

   debug: false,

   sensorSearchRetryRangeInDays: [1, 2, 7, 30, 60, 90],    // Days from now to search for sensors (on App Start)
   sensorSearchTimeRangeForRepeatSearchesInSeconds: 3600,  // 3600 Seconds from now to use for repeating sensor search's (default: 1 Hour)

   splToolsNotInstalledErrorMsg: "The SpartanLync Tools Add-In was not found. Please install and run to enable SpartanLync Temptrac / TPMS features",
   splToolsSearchRetry: 60000,  // (Default: 1 min) How often to poll backend for SplTools Add-In configured for this user in this database
   _splToolsInstalled: false,

   _api: null,
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
         if (remoteStore === null) {
            showMsg.alert(me.splToolsNotInstalledErrorMsg);
            setTimeout(function () {
               me.checkForSplTools();
            }, me.splToolsSearchRetry);
            return;
         }
         me._splToolsInstalled = true;
         console.log("----- remoteStore -----");
         console.log(remoteStore);
         console.log("----- dbDeviceIds -----");
         console.log(dbDeviceIds);
      });
   },

};

export default SpartanLyncServices;
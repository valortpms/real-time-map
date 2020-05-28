import moment from "moment-timezone";
import splCfg from "../config";
import splSrv from "../services";
import { InitSplAPI, InitSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "./api/temptrac-tpms";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { showMsg } from "../components/ui-components";
import { splSensorDb } from "../components/ui-maps";

/**
 *
 *  Tools for initialing / kickstarting SpartanLync Services
 *
 */
const SpartanLyncServiceTools = {

   initServices: function () {
      splSrv._credentials.db = userInfo.database;
      splSrv._credentials.username = userInfo.userName;
      splSrv._credentials.server = userInfo.server;
      splSrv._credentials.sessionId = userInfo.sessionId;

      splSrv.state = apiConfig.state;
      splSrv._api = new InitSplAPI(splCfg.splApiUrl);
      splSrv.sessionMgr = new InitSplSessionMgr(splSrv._api, splSrv._credentials);
      splSrv.sessionMgr.enableDebug(splCfg.appEnv === "dev" && splSrv.debug ? true : false);
      splSrv.goLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds
      );
      splSensorDb.sensorDataLifetimeInSec = splSrv.sensorDataLifetime;
   },

   checkForSplTools: function () {
      const me = this;
      splSrv.sessionMgr.getSettings((remoteStore, dbDeviceIds) => {
         if (remoteStore === null || typeof remoteStore.splMap === "undefined") {
            showMsg.alert(splSrv.splToolsNotInstalledErrorMsg);
            setTimeout(function () {
               me.checkForSplTools();
            }, splSrv.splToolsSearchRetry);
            return;
         }
         splSrv._splToolsInstalled = true;
         splSrv._dbDeviceIds = dbDeviceIds;

         // Update moment() with User-defined Timezone
         splSrv._timeZone = remoteStore.timezone;
         moment.tz.setDefault(splSrv._timeZone);

         // Update shared Store object with SplMaps Add-In PageName and Sync with SplTools Add-In
         remoteStore.splMap.found = true;
         remoteStore.splMap.mapsPageName = splCfg.appEnv === "dev" ? window.location.href : window.location.hash.replace("#", "");
         splSrv.splStore = remoteStore;

         showMsg.msg("SpartanLync Map Services Started Successfully");
      });
   }
};

export default SpartanLyncServiceTools;
import moment from "moment-timezone";
import splCfg from "../config";
import splSrv from "../services";
import { INITSplAPI, INITSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "./api/temptrac-tpms";
import { INITSplSensorDataTools } from "./sensor-data-tools";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { showMsg } from "../components/ui-components";

/**
 *
 *  Initialing / kickstarting / bootstrapping SpartanLync Services
 *
 */
const SpartanLyncServiceTools = {

   /**
   *
   *  INIT Services at Application Start
   *
   */
   initServices: function () {
      splSrv._credentials.db = userInfo.database;
      splSrv._credentials.username = userInfo.userName;
      splSrv._credentials.server = userInfo.server;
      splSrv._credentials.sessionId = userInfo.sessionId;

      splSrv.state = apiConfig.state;
      splSrv._api = new INITSplAPI(splCfg.splApiUrl);
      splSrv.sessionMgr = new INITSplSessionMgr(splSrv._api, splSrv._credentials);
      splSrv.sessionMgr.enableDebug(splCfg.appEnv === "dev" && splSrv.debug ? true : false);
      splSrv.goLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds
      );

      splSrv.sdataTools = new INITSplSensorDataTools(splSrv.goLib);
      splSrv.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);
   },

   /**
   *
   *  Start Services after Application Components have successfully Loaded
   *
   */
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

         // Update sensorDataLifetime, based on "sensorInfoRefreshRate" user setting in SplTools
         splSrv.sensorDataLifetime = remoteStore.sensorInfoRefreshRate;
         splSrv.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);

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
// eslint-disable-next-line no-unused-vars
import React, { Component, Fragment } from "react";
import ReactTooltip from "react-tooltip";
import splSrv from "../services";
import splCfg from "../config";
import { apiConfig } from "../../dataStore/api-config";
import { INITSplSensorDataTools, splSensorDataParser } from "../services/sensor-data-tools";
import { fetchVehSensorDataAsync, fetchVehFaultsAndIgnitionAsync } from "../services/api/temptrac-tpms/utils";
import { INITGeotabTpmsTemptracLib } from "../services/api/temptrac-tpms";

/**
 * Renders a SpartanLync Sensor Data Button / Content window
 * meant to insert into a Vehicle List Item within Vehicle Configuration Panel
 *
 *  @returns JSX object
 */
export class SplSensorDataTypesButton extends Component {

   constructor(props) {
      super(props);

      this.init = this.init.bind(this);
      this.onClickHandler = this.onClickHandler.bind(this);
      this.renderSplButton = this.renderSplButton.bind(this);
      this.onCloseContentHandler = this.onCloseContentHandler.bind(this);
      this.locExistsInSensorData = this.locExistsInSensorData.bind(this);

      this.state = {
         components: [],
         buttons: [],
         html: "",
         loading: false
      };

      this.vehId = this.props.id;
      this.vehName = this.props.name.trim();
      this.faultAlertEventHandlerId = null;
      this.sdataCache = null;

      this.goLib = null;
      this.sdataTools = null;
      this.contentRefreshTimerHandle = null;
   }

   componentDidMount() {
      const me = this;

      // Prevent duplicate Initial Invocation(s)
      splCfg.shouldSplSensorDataButtonUpdate = false;
      setTimeout(() => {
         splCfg.shouldSplSensorDataButtonUpdate = true;
      }, 50);

      // Initialize if SpartanLync Services is Loaded
      if (splSrv._splToolsInstalled) {
         me.init();
      }
      // Otherwise Defer
      else {
         splSrv.events.register("onLoadSplServices", me.init);
      }
   }
   componentWillUnmount() {
      const me = this;
      me.onCloseContentHandler();
   }

   /**
    * Init by
    * 1. Creating ASync instance of Geotab sensor data Lib
    * 2. Fetching sensor data types installed on a vehicle
    *
    *  @returns void
    */
   init() {
      const me = this;

      // Init SpartanLync sensor data services / tools
      me.goLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
         splSrv.faultSearchRetryRangeInDays,
         splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
      );
      me.sdataTools = new INITSplSensorDataTools(me.goLib);
      me.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);
      me.sdataTools.setSensorDataNotFoundMsg(splSrv.sensorDataNotFoundMsg);
      me.sdataTools.setVehComponents(splSrv.vehCompTr.toEn);

      // Set Language-specific sensor data search messages
      me.sdataTools.setSensorSearchInProgressResponseMsg(splmap.tr("sensor_search_busy_msg"));

      // Fetch SpartanLync Sensor Types installed into vehicle
      me.fetchSensorTypes();
   }

   // eslint-disable-next-line no-unused-vars
   shouldComponentUpdate(nextProps, nextState) {
      // Handler for preventing duplicate Initial Invocation(s)
      return splCfg.shouldSplSensorDataButtonUpdate;
   }

   /**
    * Fetch vehicle fault + ignition data from API
    * Parse results and store in cache for initiating alerts
    *
    *  @returns void
    */
   fetchFaultsAndIgnitionData() {
      const me = this;

      //Splunk for fault & ignition data for specific vehicle
      fetchVehFaultsAndIgnitionAsync(me.vehId)
         .then(([faults, vehIgnitionInfo]) => {

            // Update Fault & Ignition data caches
            splSrv.cache.storeFaultData(me.vehId, faults);
            splSrv.cache.storeIgnData(me.vehId, vehIgnitionInfo);
            console.log("---------------------------- faults[" + me.vehId + "] = ", JSON.stringify(faults));
            console.log("---------------------------- vehIgnitionInfo[" + me.vehId + "] = ", JSON.stringify(vehIgnitionInfo));

            // Update Faults cache with new ignition data
            if (typeof vehIgnitionInfo !== "undefined" && vehIgnitionInfo !== null &&
               typeof vehIgnitionInfo === "object" && typeof vehIgnitionInfo["on-latest"] !== "undefined" &&
               vehIgnitionInfo["on-latest"]) {
               splSrv.cache.updateFaultStatusUsingIgnData(me.vehId);
            }

            // Invoke New Fault event handlers by throwing a New Fault Event
            if (typeof faults !== "undefined" && faults !== null && Array.isArray(faults) && faults.length) {
               splSrv.events.exec("onFaultAlert", me.vehId, me);
            }
         })
         .catch((reason) => {
            console.log("---- Error while searching for FAULTS on VehicleID [ " + me.vehId + " ] named [ " + me.vehName + " ]: ", reason);
         });
   }

   /**
    * Fetch vehicle sensor data from API
    * Parse results and update state on sensor types & components of vehicle
    *
    *  @returns void
    */
   fetchSensorTypes() {
      const me = this;

      //Splunk for presence of sensor data types & vehicle components
      fetchVehSensorDataAsync(me.vehId)
         .then((sdata) => {
            const btn = [];

            me.sdataCache = sdata; // Save this Sensor data for later filtering of alerts

            if (typeof sdata.vehCfg.ids !== "undefined" && Array.isArray(sdata.vehCfg.ids)) {
               const stypes = [];
               sdata.vehCfg.ids.forEach(function (comp) {
                  const compSdata = sdata.vehCfg.compsdata[comp];
                  if (Object.keys(compSdata.temptrac).length) {
                     stypes.push("temptrac");
                  }
                  if (Object.keys(compSdata.tpmspress).length || Object.keys(compSdata.tpmstemp).length) {
                     stypes.push("tpms");
                  }
               });
               if (stypes.includes("temptrac")) {
                  btn.push("temptrac");
               }
               if (stypes.includes("tpms")) {
                  btn.push("tpms");
               }
            }
            else {
               if (Object.keys(sdata.temptrac).length) {
                  btn.push("temptrac");
               }
               if (Object.keys(sdata.tpmspress).length || Object.keys(sdata.tpmstemp).length) {
                  btn.push("tpms");
               }
            }
            me.setState({
               components: sdata.vehCfg.ids.length > 1 ? sdata.vehCfg.ids : [],
               buttons: btn
            });
         })
         .catch((reason) => {
            if (reason === splSrv.sensorDataNotFoundMsg) {
               console.log("---- NO SENSORS FOUND for VehicleID [ " + me.vehId + " ] named [ " + me.vehName + " ]");
            }
         })
         .finally(() => {

            // Fetch vehicle faults and ignition data for Alert cache(s)
            me.fetchFaultsAndIgnitionData();
         });
   }

   /**
    * Check for existence of sensor location object in cahced sensor data
    * Return TRUE if found, otherwise FALSE if not found or error
    *
    *  @returns boolean
    */
   locExistsInSensorData(locType, locObj) {
      const me = this;
      if (!locType || !locObj) {
         return false;
      }
      const sdataType = locType === "Tire Temperature Fault" ? "tpmstemp" : "tpmspress";
      const locId = (locType === "Tire Temperature Fault" ? "tiretemp_axle" : "tirepress_axle") + locObj.axle + "tire" + locObj.tire;

      if (me.sdataCache && typeof me.sdataCache.vehCfg !== "undefined" && typeof me.sdataCache.vehCfg.compsdata !== "undefined" &&
         typeof locObj.vehComp !== "undefined" && locObj.vehComp && typeof me.sdataCache.vehCfg.compsdata[locObj.vehComp] !== "undefined") {
         const sdata = me.sdataCache.vehCfg.compsdata[locObj.vehComp];
         for (const sdataLocId in sdata[sdataType]) {
            const sdataLocObj = sdata[sdataType][sdataLocId];
            if (sdataLocObj.id === locId) {
               return true;
            }
         }
      }
      return false;
   }

   /**
    * Click Handler, invoked once there are sensor types to display
    *
    *  @returns void
    */
   onClickHandler() {
      const me = this;
      let splHtmlOut = "";

      if (manageSensorDataContentUI.register(me.vehId, me.onCloseContentHandler)) {

         // Set the Loading Page
         me.setState({
            html: "<strong class='loading'>" + splmap.tr("sensor_search_busy_getting_data_msg") + "</strong>",
            loading: true
         });

         //Splunk for sensor data
         me.sdataTools.resetCache();
         me.sdataTools.fetchCachedSensorData(me.vehId, me.vehName)
            .then(sensorData => {
               splHtmlOut = splSensorDataParser.generateSensorDataHtml(sensorData, me.vehId, me.sdataTools);
               me.startContentRefresh();  // Start content update timer

               // Register Handler for showing changes to vehicle Alert Status
               me.faultAlertEventHandlerId = splSrv.events.register("onFaultAlert", (vehId) => {
                  console.log("----------- Sensor Data Panel: onFaultAlert OCCURRED for vehId =", vehId); //DEBUG
                  if (vehId === me.vehId) {
                     console.log("----------- Sensor Data Panel: Update UI for vehId =", vehId); //DEBUG
                     me.updateSensorDataContent();
                  }
               }, false);
            })
            .catch(reason => {
               splHtmlOut = reason;
            })
            .finally(() => {
               if (manageSensorDataContentUI.confirmed(me.vehId)) {
                  me.setState({
                     html: splHtmlOut,
                     loading: false
                  });
               }
            });
      }
   }

   /**
    * Close Handler, invoked once UI is closed
    *
    *  @returns void
    */
   onCloseContentHandler() {
      const me = this;
      manageSensorDataContentUI.cleanup(me.vehId);
      me.stopContentRefresh();
      me.setState({ html: "" });
      splSrv.events.delete("onFaultAlert", me.faultAlertEventHandlerId);
      me.faultAlertEventHandlerId = null;
   }

   /**
    * Update sensor data content
    *
    *  @returns void
    */
   updateSensorDataContent() {
      const me = this;
      let splHtmlOut = "";
      me.sdataTools.fetchCachedSensorData(me.vehId, me.vehName)
         .then((sensorData) => {
            splHtmlOut = splSensorDataParser.generateSensorDataHtml(sensorData, me.vehId, me.sdataTools);
         })
         .catch((reason) => {
            splHtmlOut = reason;
            setTimeout(() => {
               // on Error, close content UI after a short time for user to read the error
               me.onCloseContentHandler();
            }, (splSrv.onErrorCloseUIDelay * 1000));
         })
         .finally(() => {
            if (splHtmlOut) {
               me.setState({
                  html: splHtmlOut
               });
            }
         });
   }

   /**
    * Start/Stop sensor data refresh process
    *
    *  @returns void
    */
   startContentRefresh() {
      const me = this;
      me.contentRefreshTimerHandle = setInterval(
         () => me.updateSensorDataContent(),
         (splSrv.sensorDataLifetime * 1000)
      );
   }
   stopContentRefresh() {
      const me = this;
      clearInterval(me.contentRefreshTimerHandle);
   }

   /**
    * Renders Temptrac or TPMS button for UI
    *
    *  @returns JSX
    */
   renderSplButton(type) {
      return (
         <div className={`spl-vehcfg-sensor-data-button-item ${type}`} key={type}>
            {type === "temptrac" ? "TempTrac" : "TPMS"}
         </div>
      );
   }

   render() {
      const me = this;
      const sensorContentWrapperClass = me.state.html ? (me.state.loading ? "loading" : "") : "hidden";
      const sensorContentBtnCloseClass = me.state.loading ? "hidden" : "";
      const sensorBtnWrapperClass = me.state.buttons.length && me.state.html ? "hidden" : "";
      const sensorBtnComponentsClass = me.state.components.length && me.state.buttons.length ?
         (me.state.buttons.length > 1 ?
            "both-sensors" : "") : "hidden";
      const sensorBtnHandleClass = me.state.buttons.length ?
         (me.state.buttons.length > 1 ?
            "both-sensors" : "") : "hidden";
      const vehicleComponentsTitle = splmap.tr("splmap_vehpanel_component_title");
      const viewSensorDataTooltip = splmap.tr("splmap_vehpanel_splsensors_btn_tooltip");

      if (me.state.buttons.length) {
         setTimeout(() => {
            ReactTooltip.rebuild();
         }, 1000);
      }
      return (
         <Fragment>
            <span
               className={`spl-vehcfg-sensor-data-btn-wrapper ${sensorBtnWrapperClass}`}
               {...(me.state.buttons.length && {
                  "onClick": me.onClickHandler,
                  "data-tip": viewSensorDataTooltip,
                  "data-for": "splTooltip"
               })}>
               <div className="spl-vehcfg-sensor-data-button">
                  {me.state.buttons.length ? me.state.buttons.map(type => me.renderSplButton(type)) : ""}
               </div>
               <span className={`btn-handle ${sensorBtnHandleClass}`}></span>
               <div className={`btn-components ${sensorBtnComponentsClass}`}
                  {...(me.state.components.length && {
                     "data-tip":
                        "<div class='veh-components-popup'><span>" + vehicleComponentsTitle + "</span>" +
                        me.state.components.map(component => "<li>" + splmap.tr(splSrv.vehCompTr.toTr[component]) + "</li>").join("") +
                        "</div>",
                     "data-for": "splTooltip"
                  })}>
                  {me.state.components.length ? me.state.components.length : ""}
               </div>
            </span >
            <div className={`btn-content-wrapper ${sensorContentWrapperClass}`}>
               <button className={`btn-content-close ${sensorContentBtnCloseClass}`} onClick={me.onCloseContentHandler}>×</button>
               <div className="btn-content" dangerouslySetInnerHTML={{ __html: me.state.html }}></div>
            </div>
         </Fragment>
      );
   }
};

/**
 *  Manage which SplSensorDataTypesButton sibling is showing Sensor Data in UI
 */
export const manageSensorDataContentUI = {

   _settings: {
      veh: null,
      confirmed: false,
      closeHandler: null
   },

   /**
    * Register button that wants to invoke content in UI
    *
    *  @returns boolean TRUE - Registration successful, now waiting for confirmation
    *                   FALSE - Registration failed, BUSY with another registration
    */
   register: function (vehId, closeFuncHandler) {
      const me = this;

      if (typeof closeFuncHandler !== "function") {
         return false;
      }
      if (me._settings.veh === null) {
         me._settings.veh = vehId;
         me._settings.confirmed = false;
         me._settings.closeHandler = closeFuncHandler;
         return true;
      }
      else if (me._settings.veh === vehId) {
         return false;
      }
      else {
         if (!me._settings.confirmed) {
            return false;
         }
         else {
            const oldFunc = me._settings.closeHandler;
            me._settings.veh = vehId;
            me._settings.confirmed = false;
            me._settings.closeHandler = closeFuncHandler;
            oldFunc();
            return true;
         }
      }
   },

   /**
    * Confirmed Registration, Resource now in use, but allowing override by another registration
    * Must provide the same vehId as Registration
    *
    *  @returns boolean TRUE - Confirmation successful, allowing another registration
    *                   FALSE - Wrong VehId supplied for confirmation
    */
   confirmed: function (vehId) {
      const me = this;
      if (me._settings.veh === vehId) {
         me._settings.confirmed = true;
         return true;
      }
      return false;
   },

   /**
    * Cleanup / Close registration as all popup are now closed
    *
    *  @returns void
    */
   cleanup: function (vehId) {
      const me = this;
      if (me._settings.veh === vehId) {
         me._settings.veh = null;
         me._settings.confirmed = false;
         me._settings.closeHandler = null;
      }
   },
   close: function () {
      const me = this;
      if (typeof me._settings.closeHandler === "function") {
         me._settings.closeHandler();
      }
   }
};